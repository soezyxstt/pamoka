<?php

namespace App\Http\Controllers\Auth;

use App\Enums\AdminProfileStatus;
use App\Http\Controllers\Controller;
use App\Models\AdminProfile;
use App\Models\OAuthAccount;
use App\Models\User;
use App\Services\AuthorizationService;
use App\Services\GoogleOAuthClient;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class GoogleAuthenticationController extends Controller
{
    public function showLogin(): Response
    {
        return Inertia::render('Admin/Login', [
            'googleAuthUrl' => route('auth.google.redirect'),
            'googleConfigured' => filled(config('services.google.client_id'))
                && filled(config('services.google.client_secret')),
        ]);
    }

    public function redirectToGoogle(Request $request, GoogleOAuthClient $client): RedirectResponse
    {
        $state = Str::random(64);
        $request->session()->put('google_oauth_state', $state);

        return redirect()->away($client->authorizationUrl($state));
    }

    public function handleGoogleCallback(
        Request $request,
        GoogleOAuthClient $client,
        AuthorizationService $authorization,
    ): RedirectResponse {
        $expectedState = $request->session()->pull('google_oauth_state');
        $providedState = $request->string('state')->toString();
        if (! is_string($expectedState) || $expectedState === '' || ! hash_equals($expectedState, $providedState)) {
            abort(419, 'Google OAuth state is invalid.');
        }

        $code = $request->string('code')->toString();
        if ($code === '') {
            abort(422, 'Google OAuth authorization code is missing.');
        }

        $identity = $client->identityFromCode($code);
        if (! $identity->emailVerified) {
            abort(403, 'Google account email is not verified.');
        }

        $user = DB::transaction(function () use ($identity): User {
            $account = OAuthAccount::query()
                ->where('provider', 'google')
                ->where('provider_account_id', $identity->providerAccountId)
                ->first();

            $user = $account?->user ?? User::query()->where('email', $identity->email)->first();
            if ($user === null) {
                $user = User::query()->create([
                    'name' => $identity->name,
                    'email' => $identity->email,
                    'email_verified_at' => now(),
                    'password' => Hash::make(Str::random(64)),
                ]);
            } else {
                $user->forceFill([
                    'name' => $identity->name,
                    'email_verified_at' => $identity->emailVerified ? ($user->email_verified_at ?? now()) : $user->email_verified_at,
                ])->save();
            }

            $account ??= new OAuthAccount([
                'provider' => 'google',
                'provider_account_id' => $identity->providerAccountId,
            ]);
            $account->fill([
                'user_id' => $user->id,
                'access_token' => $identity->accessToken,
                'refresh_token' => $identity->refreshToken ?? $account->refresh_token,
                'access_token_expires_at' => $identity->accessTokenExpiresIn === null
                    ? null
                    : now()->addSeconds($identity->accessTokenExpiresIn),
            ])->save();

            $profile = AdminProfile::query()->firstOrCreate(
                ['user_id' => $user->id],
                ['status' => AdminProfileStatus::Pending],
            );
            $profile->forceFill(['last_signed_in_at' => now()])->save();

            return $user;
        });

        Auth::login($user, true);
        $request->session()->regenerate();

        return $user->adminProfile?->status === AdminProfileStatus::Active
            && $authorization->has($user, 'admin.view')
            ? redirect()->route('admin.dashboard')
            : redirect()->route('admin.request-access');
    }

    public function logout(Request $request): RedirectResponse
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('home');
    }
}

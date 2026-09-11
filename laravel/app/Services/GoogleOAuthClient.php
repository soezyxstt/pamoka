<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use RuntimeException;

final class GoogleOAuthClient
{
    public function authorizationUrl(string $state): string
    {
        $clientId = (string) config('services.google.client_id');
        if ($clientId === '') {
            throw new RuntimeException('GOOGLE_CLIENT_ID is not configured.');
        }

        $query = http_build_query([
            'client_id' => $clientId,
            'redirect_uri' => $this->redirectUri(),
            'response_type' => 'code',
            'scope' => 'openid email profile',
            'state' => $state,
            'access_type' => 'offline',
            'prompt' => 'select_account',
        ], '', '&', PHP_QUERY_RFC3986);

        return 'https://accounts.google.com/o/oauth2/v2/auth?'.$query;
    }

    public function identityFromCode(string $code): GoogleIdentity
    {
        $clientId = (string) config('services.google.client_id');
        $clientSecret = (string) config('services.google.client_secret');
        if ($clientId === '' || $clientSecret === '') {
            throw new RuntimeException('Google OAuth credentials are not configured.');
        }

        $token = Http::asForm()
            ->post('https://oauth2.googleapis.com/token', [
                'code' => $code,
                'client_id' => $clientId,
                'client_secret' => $clientSecret,
                'redirect_uri' => $this->redirectUri(),
                'grant_type' => 'authorization_code',
            ])
            ->throw()
            ->json();

        $accessToken = $token['access_token'] ?? null;
        if (! is_string($accessToken) || $accessToken === '') {
            throw new RuntimeException('Google OAuth token response did not contain an access token.');
        }

        $profile = Http::withToken($accessToken)
            ->acceptJson()
            ->get('https://www.googleapis.com/oauth2/v3/userinfo')
            ->throw()
            ->json();

        $providerAccountId = $profile['sub'] ?? null;
        $name = $profile['name'] ?? null;
        $email = $profile['email'] ?? null;
        if (! is_string($providerAccountId) || ! is_string($name) || ! is_string($email)) {
            throw new RuntimeException('Google OAuth profile is incomplete.');
        }

        return new GoogleIdentity(
            providerAccountId: $providerAccountId,
            name: $name,
            email: $email,
            emailVerified: ($profile['email_verified'] ?? false) === true,
            avatarUrl: is_string($profile['picture'] ?? null) ? $profile['picture'] : null,
            accessToken: $accessToken,
            refreshToken: is_string($token['refresh_token'] ?? null) ? $token['refresh_token'] : null,
            accessTokenExpiresIn: is_int($token['expires_in'] ?? null) ? $token['expires_in'] : null,
        );
    }

    private function redirectUri(): string
    {
        return (string) (config('services.google.redirect') ?: route('auth.google.callback'));
    }
}

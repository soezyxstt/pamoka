<?php

namespace App\Http\Controllers;

use App\Enums\AdminProfileStatus;
use App\Models\AdminProfile;
use App\Models\User;
use App\Services\AuthorizationService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AdminProfileController extends Controller
{
    public function __invoke(Request $request, AuthorizationService $authorization): Response
    {
        /** @var User $user */
        $user = $request->user();
        $profile = AdminProfile::query()->firstOrCreate(
            ['user_id' => $user->id],
            ['status' => AdminProfileStatus::Pending],
        );
        $profile->forceFill(['last_signed_in_at' => now()])->save();

        return Inertia::render('Admin/Profile', [
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
            ],
            'profileStatus' => $profile->status->value,
            'roles' => $user->roles()
                ->orderBy('label')
                ->get(['roles.slug', 'roles.label'])
                ->map(fn ($role): array => ['slug' => $role->slug, 'label' => $role->label])
                ->values()
                ->all(),
            'permissions' => $authorization->effectivePermissions($user),
        ]);
    }
}

<?php

namespace App\Services;

use App\Enums\AdminProfileStatus;
use App\Enums\PermissionEffect;
use App\Models\User;

final class AuthorizationService
{
    public function has(User $user, string $permission): bool
    {
        if ($user->adminProfile?->status !== AdminProfileStatus::Active) {
            return false;
        }

        if ($user->roles()->where('slug', 'super_admin')->exists()) {
            return true;
        }

        $override = $user->permissionOverrides()
            ->where('permission_key', $permission)
            ->first();
        if ($override !== null) {
            return $override->effect === PermissionEffect::Allow;
        }

        return $user->roles()
            ->whereHas('permissions', fn ($query) => $query->where('permissions.key', $permission))
            ->exists();
    }
}

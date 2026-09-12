<?php

namespace App\Services;

use App\Enums\AdminProfileStatus;
use App\Enums\PermissionEffect;
use App\Models\Permission;
use App\Models\User;

final class AuthorizationService
{
    /**
     * @return list<string>
     */
    public function effectivePermissions(User $user): array
    {
        if ($user->adminProfile?->status !== AdminProfileStatus::Active) {
            return [];
        }

        $roles = $user->roles()->with('permissions')->get();
        if ($roles->contains(fn ($role): bool => $role->slug === 'super_admin')) {
            return Permission::query()->orderBy('key')->pluck('key')->values()->all();
        }

        $effective = [];
        foreach ($roles as $role) {
            foreach ($role->permissions as $permission) {
                $effective[$permission->key] = true;
            }
        }

        foreach ($user->permissionOverrides as $override) {
            if ($override->effect === PermissionEffect::Deny) {
                unset($effective[$override->permission_key]);
            } else {
                $effective[$override->permission_key] = true;
            }
        }

        ksort($effective);

        return array_keys($effective);
    }

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

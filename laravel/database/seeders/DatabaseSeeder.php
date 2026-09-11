<?php

namespace Database\Seeders;

use App\Enums\PermissionKey;
use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        foreach (PermissionKey::cases() as $permission) {
            Permission::query()->updateOrCreate(
                ['key' => $permission->value],
                [
                    'label' => $permission->value,
                    'description' => 'Akses untuk '.$permission->value.'.',
                ],
            );
        }

        $rolePermissions = [
            'super_admin' => PermissionKey::cases(),
            'content_editor' => [
                PermissionKey::AdminView,
                PermissionKey::ContentView,
                PermissionKey::ContentEdit,
                PermissionKey::MediaView,
                PermissionKey::NewsManage,
                PermissionKey::SponsorsManage,
                PermissionKey::PeopleManage,
                PermissionKey::ParticipantsManage,
                PermissionKey::EventsManage,
                PermissionKey::GalleryManage,
            ],
            'content_publisher' => [
                PermissionKey::AdminView,
                PermissionKey::ContentView,
                PermissionKey::ContentEdit,
                PermissionKey::ContentPublish,
                PermissionKey::MediaView,
                PermissionKey::MediaManage,
                PermissionKey::NewsManage,
                PermissionKey::SponsorsManage,
                PermissionKey::PeopleManage,
                PermissionKey::ParticipantsManage,
                PermissionKey::EventsManage,
                PermissionKey::GalleryManage,
            ],
            'voting_operator' => [PermissionKey::AdminView, PermissionKey::VotingView, PermissionKey::VotingTally],
            'voting_manager' => [PermissionKey::AdminView, PermissionKey::VotingView, PermissionKey::VotingManage, PermissionKey::VotingTally, PermissionKey::VotingResultsPublish],
            'role_administrator' => [PermissionKey::AdminView, PermissionKey::UsersView, PermissionKey::AccessApprove, PermissionKey::AccessManage],
            'auditor' => [PermissionKey::AdminView, PermissionKey::AuditView, PermissionKey::AuditExport],
        ];

        foreach ($rolePermissions as $slug => $permissions) {
            $role = Role::query()->updateOrCreate(
                ['slug' => $slug],
                [
                    'label' => str_replace('_', ' ', ucfirst($slug)),
                    'description' => 'Role sistem '.$slug.'.',
                    'is_system' => true,
                ],
            );

            $role->permissions()->sync(array_map(
                static fn (PermissionKey $permission): string => $permission->value,
                $permissions,
            ));
        }
    }
}

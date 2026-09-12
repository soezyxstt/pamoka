<?php

namespace Tests\Feature;

use App\Enums\AdminProfileStatus;
use App\Enums\PermissionKey;
use App\Models\AdminProfile;
use App\Models\AuditLog;
use App\Models\Edition;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class AdminWorkspaceTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_read_audit_profile_and_content_workspace(): void
    {
        $admin = $this->adminWith(PermissionKey::AuditView, PermissionKey::ContentView);
        $edition = Edition::factory()->create(['year' => 2025, 'lifecycle' => 'active']);
        AuditLog::create([
            'actor_user_id' => $admin->id,
            'actor_label' => $admin->email,
            'action' => 'media.folder.create',
            'resource_type' => 'media_folder',
            'resource_id' => 'folder-test',
            'resource_label' => 'Foto kegiatan',
            'before_json' => null,
            'after_json' => ['name' => 'Foto kegiatan'],
            'changed_fields_json' => ['name'],
            'source' => 'test',
            'created_at' => now(),
        ]);

        $this->actingAs($admin)
            ->get(route('admin.audit'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Admin/Audit')
                ->has('logs', 1)
                ->where('logs.0.action', 'media.folder.create'));

        $this->actingAs($admin)
            ->get(route('admin.profile'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Admin/Profile')
                ->where('profileStatus', AdminProfileStatus::Active->value)
                ->has('permissions')
                ->has('roles', 1));

        $this->actingAs($admin)
            ->get(route('admin.content.index'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Admin/Content/Index')
                ->has('modules', 9)
                ->where('edition.id', $edition->id));
    }

    public function test_legacy_content_aliases_redirect_to_laravel_replacements(): void
    {
        $admin = $this->adminWith(PermissionKey::ContentView);

        $this->actingAs($admin)
            ->get(route('admin.content.pages'))
            ->assertRedirect(route('admin.site-assets.index'));

        $this->actingAs($admin)
            ->get(route('admin.content.people'))
            ->assertRedirect(route('admin.organization.index'));
    }

    public function test_audit_workspace_requires_audit_view_permission(): void
    {
        $admin = $this->adminWith(PermissionKey::ContentView);

        $this->actingAs($admin)
            ->get(route('admin.audit'))
            ->assertForbidden();
    }

    private function adminWith(PermissionKey ...$permissions): User
    {
        $user = User::factory()->create();
        AdminProfile::create(['user_id' => $user->id, 'status' => AdminProfileStatus::Active]);
        $role = Role::create([
            'slug' => 'workspace-test-role-'.$user->id,
            'label' => 'Workspace Test Role',
            'description' => 'Role untuk pengujian workspace admin.',
        ]);
        $permissionKeys = collect([PermissionKey::AdminView, ...$permissions])
            ->unique()
            ->map(fn (PermissionKey $permission): string => Permission::firstOrCreate(
                ['key' => $permission->value],
                ['label' => $permission->value, 'description' => 'Permission test.'],
            )->key)
            ->all();
        $role->permissions()->attach($permissionKeys);
        $user->roles()->attach($role->id, ['granted_at' => now()]);

        return $user;
    }
}

<?php

namespace Tests\Feature;

use App\Enums\PermissionKey;
use App\Models\AccessRequest;
use App\Models\AdminProfile;
use App\Models\AuditLog;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use LogicException;
use Tests\TestCase;

class AdminAccessApprovalTest extends TestCase
{
    use RefreshDatabase;

    public function test_role_administrator_can_approve_a_pending_access_request(): void
    {
        $reviewer = $this->roleAdministrator();
        $target = User::factory()->create(['email' => 'editor@example.com']);
        AdminProfile::create([
            'user_id' => $target->id,
            'status' => 'pending',
        ]);
        $accessRequest = AccessRequest::create([
            'user_id' => $target->id,
            'status' => 'open',
            'reason' => 'Saya perlu mengelola berita dan galeri kegiatan.',
            'requested_areas_json' => ['content'],
        ]);
        $role = Role::create([
            'slug' => 'content_editor',
            'label' => 'Editor Konten',
            'description' => 'Mengelola konten yang ditugaskan.',
        ]);

        $this->actingAs($reviewer)
            ->post(route('admin.access-requests.approve', $accessRequest), [
                'role' => $role->slug,
                'note' => 'Akses konten disetujui.',
            ])
            ->assertRedirect(route('admin.users'));

        $this->assertDatabaseHas('admin_profiles', [
            'user_id' => $target->id,
            'status' => 'active',
            'status_reason' => 'Akses konten disetujui.',
        ]);
        $this->assertDatabaseHas('access_requests', [
            'id' => $accessRequest->id,
            'status' => 'approved',
            'reviewed_by_user_id' => $reviewer->id,
        ]);
        $this->assertDatabaseHas('user_roles', [
            'user_id' => $target->id,
            'role_id' => $role->id,
            'granted_by_user_id' => $reviewer->id,
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'actor_user_id' => $reviewer->id,
            'action' => 'access.request.approve',
            'resource_id' => $accessRequest->id,
        ]);
    }

    public function test_super_admin_cannot_be_assigned_from_the_access_approval_form(): void
    {
        $reviewer = $this->roleAdministrator();
        $target = User::factory()->create();
        AdminProfile::create([
            'user_id' => $target->id,
            'status' => 'pending',
        ]);
        $accessRequest = AccessRequest::create([
            'user_id' => $target->id,
            'status' => 'open',
            'reason' => 'Permintaan akses untuk mengelola konten.',
            'requested_areas_json' => ['content'],
        ]);

        $this->actingAs($reviewer)
            ->from(route('admin.users'))
            ->post(route('admin.access-requests.approve', $accessRequest), [
                'role' => 'super_admin',
            ])
            ->assertSessionHasErrors('role');

        $this->assertDatabaseHas('access_requests', [
            'id' => $accessRequest->id,
            'status' => 'open',
        ]);
        $this->assertDatabaseHas('admin_profiles', [
            'user_id' => $target->id,
            'status' => 'pending',
        ]);
    }

    public function test_role_administrator_can_view_open_access_requests(): void
    {
        $reviewer = $this->roleAdministrator();

        $this->actingAs($reviewer)
            ->get(route('admin.users'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Admin/Users')
                ->has('openRequests')
            );
    }

    public function test_audit_records_are_immutable(): void
    {
        $audit = AuditLog::create([
            'actor_label' => 'test@example.com',
            'action' => 'test.action',
            'resource_type' => 'test',
            'source' => 'test',
            'created_at' => now(),
        ]);

        $this->expectException(LogicException::class);
        $audit->update(['reason' => 'Tidak boleh diubah.']);
    }

    private function roleAdministrator(): User
    {
        $user = User::factory()->create();
        AdminProfile::create([
            'user_id' => $user->id,
            'status' => 'active',
        ]);
        $permissions = collect([
            PermissionKey::AdminView,
            PermissionKey::AccessApprove,
            PermissionKey::AccessManage,
        ])->mapWithKeys(fn (PermissionKey $permission): array => [
            $permission->value => Permission::create([
                'key' => $permission->value,
                'label' => $permission->value,
                'description' => 'Permission test.',
            ]),
        ]);
        $role = Role::create([
            'slug' => 'role_administrator',
            'label' => 'Role Administrator',
            'description' => 'Mengelola akses admin.',
        ]);
        $role->permissions()->attach($permissions->keys()->all());
        $user->roles()->attach($role->id, ['granted_at' => now()]);

        return $user;
    }
}

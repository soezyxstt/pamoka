<?php

namespace Tests\Feature;

use App\Enums\AdminProfileStatus;
use App\Enums\CategoryCode;
use App\Enums\PermissionKey;
use App\Models\AdminProfile;
use App\Models\Category;
use App\Models\Edition;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class AdminEditionAuthoringTest extends TestCase
{
    use RefreshDatabase;

    public function test_editor_can_create_category_and_activate_an_edition(): void
    {
        $admin = $this->adminWith(PermissionKey::ContentView, PermissionKey::SettingsManage, PermissionKey::ParticipantsManage);
        $oldEdition = Edition::factory()->create(['year' => 2025, 'lifecycle' => 'active']);
        $draft = Edition::factory()->create(['year' => 2026, 'lifecycle' => 'draft']);

        $this->actingAs($admin)
            ->get(route('admin.editions.index'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Admin/Content/Editions/Index')
                ->has('editions', 2)
                ->where('canCreateEdition', true)
                ->where('canCreateCategory', true)
                ->where('canActivate', true));

        $this->actingAs($admin)
            ->post(route('admin.editions.store'), ['year' => 2027, 'name' => 'Pasanggiri 2027'])
            ->assertRedirect(route('admin.editions.index'));
        $newEdition = Edition::query()->where('year', 2027)->firstOrFail();
        $this->assertSame('2027', $newEdition->slug);
        $this->assertSame('draft', $newEdition->lifecycle);

        $this->actingAs($admin)
            ->post(route('admin.editions.categories.store'), [
                'edition_id' => $draft->id,
                'code' => 'jd',
                'slug' => 'mojang-dewasa',
                'label' => 'Mojang Dewasa',
            ])
            ->assertRedirect(route('admin.editions.index'));
        $this->assertDatabaseHas('categories', [
            'edition_id' => $draft->id,
            'code' => CategoryCode::JD->value,
            'slug' => 'mojang-dewasa',
        ]);

        $this->actingAs($admin)
            ->post(route('admin.editions.activate', $draft->id), ['reason' => 'Edisi siap dipakai'])
            ->assertRedirect(route('admin.editions.index'));
        $this->assertSame('active', $draft->refresh()->lifecycle);
        $this->assertSame('archived', $oldEdition->refresh()->lifecycle);
        $this->assertDatabaseHas('audit_logs', ['action' => 'edition.create', 'resource_id' => $newEdition->id]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'category.create', 'resource_id' => Category::query()->where('edition_id', $draft->id)->value('id')]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'edition.activate', 'resource_id' => $draft->id]);
    }

    public function test_edition_and_category_validation_preserves_fixed_category_codes(): void
    {
        $admin = $this->adminWith(PermissionKey::ContentView, PermissionKey::SettingsManage, PermissionKey::ParticipantsManage);
        $edition = Edition::factory()->create(['year' => 2025]);

        $this->actingAs($admin)
            ->post(route('admin.editions.categories.store'), [
                'edition_id' => $edition->id,
                'code' => 'XX',
                'slug' => 'kode-tidak-valid',
                'label' => 'Kode tidak valid',
            ])
            ->assertSessionHasErrors('code');

        $this->actingAs($admin)
            ->post(route('admin.editions.store'), ['year' => 2025, 'name' => 'Duplikat tahun'])
            ->assertSessionHasErrors('year');

        $this->actingAs($admin)
            ->post(route('admin.editions.activate', $edition->id), ['reason' => 'singkat'])
            ->assertSessionHasErrors('reason');
    }

    public function test_edition_writes_require_their_specific_permissions(): void
    {
        $viewer = $this->adminWith(PermissionKey::ContentView);

        $this->actingAs($viewer)
            ->get(route('admin.editions.index'))
            ->assertOk();

        $this->actingAs($viewer)
            ->post(route('admin.editions.store'), ['year' => 2027, 'name' => 'Tidak boleh'])
            ->assertForbidden();
    }

    private function adminWith(PermissionKey ...$permissions): User
    {
        $user = User::factory()->create();
        AdminProfile::create(['user_id' => $user->id, 'status' => AdminProfileStatus::Active]);
        $role = Role::create([
            'slug' => 'edition-test-role-'.$user->id,
            'label' => 'Edition Test Role',
            'description' => 'Role untuk pengujian authoring edisi.',
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

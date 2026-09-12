<?php

namespace Tests\Feature;

use App\Enums\PermissionKey;
use App\Models\AdminProfile;
use App\Models\Edition;
use App\Models\MediaAsset;
use App\Models\MediaFolder;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class AdminMediaTest extends TestCase
{
    use RefreshDatabase;

    public function test_media_manager_can_browse_folders_update_metadata_and_move_assets(): void
    {
        $manager = $this->adminWith(PermissionKey::MediaView, PermissionKey::MediaManage);
        $edition = Edition::factory()->create(['year' => 2025, 'lifecycle' => 'active']);
        $otherEdition = Edition::factory()->create(['year' => 2026, 'lifecycle' => 'draft']);
        $global = MediaFolder::factory()->create(['name' => 'Global Asset', 'slug' => 'global-asset']);
        $editionFolder = MediaFolder::factory()->create(['edition_id' => $edition->id, 'name' => 'Edisi 2025', 'slug' => 'edisi-2025']);
        $asset = MediaAsset::factory()->create(['folder_id' => $global->id, 'filename' => 'hero.webp', 'alt' => 'Hero lama']);

        $this->actingAs($manager)
            ->get(route('admin.media.index', ['folder_scope' => 'edition', 'edition_id' => $edition->id]))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Admin/Media/Index')
                ->has('assets')
                ->has('folders', 2)
                ->where('activeEditionId', $edition->id)
                ->where('canManage', true));

        $this->actingAs($manager)
            ->post(route('admin.media.folders.store'), [
                'name' => '  Foto   Acara  ',
                'parent_id' => $editionFolder->id,
                'edition_id' => $edition->id,
            ])
            ->assertRedirect(route('admin.media.index'));
        $folder = MediaFolder::query()->where('name', 'Foto Acara')->firstOrFail();

        $this->actingAs($manager)
            ->put(route('admin.media.folders.update', $folder->id), [
                'name' => 'Foto Utama',
                'edition_id' => $edition->id,
            ])
            ->assertRedirect(route('admin.media.index'));

        $this->actingAs($manager)
            ->put(route('admin.media.assets.update', $asset->id), [
                'alt' => 'Hero beranda 2025',
                'decorative' => false,
            ])
            ->assertRedirect(route('admin.media.index'));
        $this->assertDatabaseHas('media_assets', ['id' => $asset->id, 'alt' => 'Hero beranda 2025', 'decorative' => 0]);

        $this->actingAs($manager)
            ->put(route('admin.media.assets.move', $asset->id), ['folder_id' => $folder->id])
            ->assertRedirect(route('admin.media.index'));
        $this->assertDatabaseHas('media_assets', ['id' => $asset->id, 'folder_id' => $folder->id]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'media.folder.create', 'resource_id' => $folder->id]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'media.asset.metadata.update', 'resource_id' => $asset->id]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'media.asset.move', 'resource_id' => $asset->id]);
        $this->assertNotNull($otherEdition->refresh());
    }

    public function test_media_folder_names_and_duplicate_slugs_are_validated(): void
    {
        $manager = $this->adminWith(PermissionKey::MediaView, PermissionKey::MediaManage);
        $this->actingAs($manager)
            ->post(route('admin.media.folders.store'), ['name' => 'Materi Foto'])
            ->assertRedirect(route('admin.media.index'));

        $this->actingAs($manager)
            ->post(route('admin.media.folders.store'), ['name' => 'Materi-Foto'])
            ->assertSessionHasErrors('name');

        $this->actingAs($manager)
            ->post(route('admin.media.folders.store'), ['name' => '---'])
            ->assertSessionHasErrors('name');
    }

    public function test_media_writes_require_media_manage_permission(): void
    {
        $viewer = $this->adminWith(PermissionKey::MediaView);

        $this->actingAs($viewer)
            ->get(route('admin.media.index'))
            ->assertOk();

        $this->actingAs($viewer)
            ->post(route('admin.media.folders.store'), ['name' => 'Tidak boleh'])
            ->assertForbidden();
    }

    private function adminWith(PermissionKey ...$permissions): User
    {
        $user = User::factory()->create();
        AdminProfile::create(['user_id' => $user->id, 'status' => 'active']);
        $role = Role::create([
            'slug' => 'media-test-role-'.$user->id,
            'label' => 'Media Test Role',
            'description' => 'Role untuk pengujian pustaka media.',
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

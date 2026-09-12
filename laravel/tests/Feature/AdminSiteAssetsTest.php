<?php

namespace Tests\Feature;

use App\Enums\PermissionKey;
use App\Models\AdminProfile;
use App\Models\Edition;
use App\Models\MediaAsset;
use App\Models\Permission;
use App\Models\Role;
use App\Models\SiteAssetBinding;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class AdminSiteAssetsTest extends TestCase
{
    use RefreshDatabase;

    public function test_editor_can_bind_and_unbind_manifest_slots_for_the_selected_edition(): void
    {
        $editor = $this->adminWith(PermissionKey::ContentView, PermissionKey::ContentEdit);
        $edition = Edition::factory()->create(['year' => 2025, 'lifecycle' => 'active']);
        $otherEdition = Edition::factory()->create(['year' => 2026, 'lifecycle' => 'draft']);
        $image = MediaAsset::factory()->create(['lifecycle' => 'ready', 'mime_type' => 'image/jpeg']);

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->get(route('admin.site-assets.index'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Admin/SiteAssets/Index')
                ->has('slots', 24)
                ->where('editionName', $edition->name)
                ->where('canEdit', true));

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.site-assets.bind', 'home.hero.bg'), [
                'media_id' => $image->id,
                'alt_override' => 'Hero edisi 2025',
                'focal_x' => 120,
                'focal_y' => -20,
            ])
            ->assertRedirect(route('admin.site-assets.index'));
        $binding = SiteAssetBinding::query()->where('edition_id', $edition->id)->firstOrFail();
        $this->assertDatabaseHas('site_asset_bindings', [
            'id' => $binding->id,
            'slot_key' => 'home.hero.bg',
            'media_id' => $image->id,
            'alt_override' => 'Hero edisi 2025',
            'focal_x' => 100,
            'focal_y' => 0,
            'version' => 1,
        ]);

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.site-assets.bind', 'home.hero.bg'), [
                'media_id' => '',
                'alt_override' => '',
                'focal_x' => 50,
                'focal_y' => 50,
                'version' => 1,
            ])
            ->assertRedirect(route('admin.site-assets.index'));
        $this->assertDatabaseHas('site_asset_bindings', ['id' => $binding->id, 'media_id' => null, 'version' => 2]);

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->delete(route('admin.site-assets.unbind', 'home.hero.bg'), ['version' => 2])
            ->assertRedirect(route('admin.site-assets.index'));
        $this->assertDatabaseHas('site_asset_bindings', ['id' => $binding->id, 'media_id' => null, 'version' => 2]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'site_asset.bind', 'resource_id' => $binding->id]);
        $this->assertNotNull($otherEdition->refresh());
    }

    public function test_site_asset_slots_validate_manifest_media_type_and_permission(): void
    {
        $editor = $this->adminWith(PermissionKey::ContentView, PermissionKey::ContentEdit);
        $edition = Edition::factory()->create(['year' => 2025, 'lifecycle' => 'active']);
        $video = MediaAsset::factory()->create(['lifecycle' => 'ready', 'mime_type' => 'video/mp4']);

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.site-assets.bind', 'home.hero.bg'), ['media_id' => $video->id])
            ->assertSessionHasErrors('media_id');

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.site-assets.bind', 'slot.tidak.terdaftar'), ['media_id' => $video->id])
            ->assertSessionHasErrors('slot_key');

        $viewer = $this->adminWith(PermissionKey::ContentView);
        $this->actingAs($viewer)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.site-assets.bind', 'home.hero.bg'), ['media_id' => null])
            ->assertForbidden();
    }

    private function adminWith(PermissionKey ...$permissions): User
    {
        $user = User::factory()->create();
        AdminProfile::create(['user_id' => $user->id, 'status' => 'active']);
        $role = Role::create([
            'slug' => 'site-assets-test-role-'.$user->id,
            'label' => 'Site Assets Test Role',
            'description' => 'Role untuk pengujian aset situs.',
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

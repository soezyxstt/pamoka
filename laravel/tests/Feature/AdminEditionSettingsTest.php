<?php

namespace Tests\Feature;

use App\Enums\PermissionKey;
use App\Models\AdminProfile;
use App\Models\Edition;
use App\Models\EditionProgram;
use App\Models\MediaAsset;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class AdminEditionSettingsTest extends TestCase
{
    use RefreshDatabase;

    public function test_editor_can_manage_identity_and_programs_for_the_selected_edition(): void
    {
        $editor = $this->adminWith(PermissionKey::ContentView, PermissionKey::ContentEdit);
        $edition = Edition::factory()->create(['year' => 2025, 'lifecycle' => 'active']);
        $otherEdition = Edition::factory()->create(['year' => 2026, 'lifecycle' => 'draft']);
        $logo = MediaAsset::factory()->create(['lifecycle' => 'ready', 'mime_type' => 'image/png']);

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->get(route('admin.edition-settings.index'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Admin/EditionSettings/Index')
                ->where('edition.id', $edition->id)
                ->has('programs', 0)
                ->where('canEdit', true));

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->put(route('admin.edition-settings.update'), [
                'logo_media_id' => $logo->id,
                'slogan' => 'Nu Nyunda Tur Nyakola 2025',
                'version' => 1,
            ])
            ->assertRedirect(route('admin.edition-settings.index'));
        $this->assertDatabaseHas('editions', [
            'id' => $edition->id,
            'logo_media_id' => $logo->id,
            'slogan' => 'Nu Nyunda Tur Nyakola 2025',
            'version' => 2,
        ]);

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.edition-settings.programs.store'), [
                'title' => 'Pasanggiri Mojang Jajaka',
                'description' => 'Program unggulan edisi ini.',
                'display_order' => 0,
                'active' => true,
            ])
            ->assertRedirect(route('admin.edition-settings.index'));
        $program = EditionProgram::query()->where('edition_id', $edition->id)->firstOrFail();

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->put(route('admin.edition-settings.programs.update', $program->id), [
                'title' => 'Pasanggiri Mojang Jajaka Garut',
                'description' => 'Program utama edisi 2025.',
                'display_order' => 1,
                'active' => false,
            ])
            ->assertRedirect(route('admin.edition-settings.index'));
        $this->assertDatabaseHas('edition_programs', [
            'id' => $program->id,
            'title' => 'Pasanggiri Mojang Jajaka Garut',
            'active' => 0,
        ]);

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.edition-settings.programs.reorder'), [
                'program_ids' => [$program->id],
            ])
            ->assertRedirect(route('admin.edition-settings.index'));

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->delete(route('admin.edition-settings.programs.destroy', $program->id))
            ->assertRedirect(route('admin.edition-settings.index'));
        $this->assertDatabaseMissing('edition_programs', ['id' => $program->id]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'edition.settings.update', 'resource_id' => $edition->id]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'edition.program.delete', 'resource_id' => $program->id]);
        $this->assertNotNull($otherEdition->refresh());
    }

    public function test_identity_changes_reject_stale_versions_and_non_image_logos(): void
    {
        $editor = $this->adminWith(PermissionKey::ContentView, PermissionKey::ContentEdit);
        $edition = Edition::factory()->create(['year' => 2025, 'lifecycle' => 'active', 'version' => 3]);
        $video = MediaAsset::factory()->create(['lifecycle' => 'ready', 'mime_type' => 'video/mp4']);

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->put(route('admin.edition-settings.update'), [
                'logo_media_id' => $video->id,
                'slogan' => 'Slogan tidak valid',
                'version' => 3,
            ])
            ->assertSessionHasErrors('logo_media_id');

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->put(route('admin.edition-settings.update'), [
                'logo_media_id' => '',
                'slogan' => 'Benturan versi',
                'version' => 2,
            ])
            ->assertSessionHasErrors('version');
        $this->assertDatabaseHas('editions', ['id' => $edition->id, 'version' => 3, 'slogan' => $edition->slogan]);
    }

    public function test_edition_settings_writes_require_content_edit_permission(): void
    {
        $viewer = $this->adminWith(PermissionKey::ContentView);
        $edition = Edition::factory()->create(['year' => 2025, 'lifecycle' => 'active']);

        $this->actingAs($viewer)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->put(route('admin.edition-settings.update'), ['slogan' => 'Tidak diizinkan', 'version' => 1])
            ->assertForbidden();
    }

    private function adminWith(PermissionKey ...$permissions): User
    {
        $user = User::factory()->create();
        AdminProfile::create(['user_id' => $user->id, 'status' => 'active']);
        $role = Role::create([
            'slug' => 'edition-settings-test-role-'.$user->id,
            'label' => 'Edition Settings Test Role',
            'description' => 'Role untuk pengujian identitas edisi.',
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

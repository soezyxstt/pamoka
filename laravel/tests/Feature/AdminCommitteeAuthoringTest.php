<?php

namespace Tests\Feature;

use App\Enums\PermissionKey;
use App\Models\AdminProfile;
use App\Models\CommitteeAssignment;
use App\Models\CommitteeUnit;
use App\Models\Edition;
use App\Models\MediaAsset;
use App\Models\Permission;
use App\Models\Person;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class AdminCommitteeAuthoringTest extends TestCase
{
    use RefreshDatabase;

    public function test_committee_workspace_is_edition_scoped_and_units_can_be_authored(): void
    {
        $editor = $this->adminWith(PermissionKey::ContentView, PermissionKey::ContentEdit);
        $edition = Edition::factory()->create(['year' => 2025, 'lifecycle' => 'active']);
        $otherEdition = Edition::factory()->create(['year' => 2026, 'lifecycle' => 'draft']);

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->get(route('admin.committee.index'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Admin/Committee/Index')
                ->where('editionName', $edition->name)
                ->has('units', 0)
                ->has('members', 0)
                ->where('canEdit', true));

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.committee.units.store'), [
                'name' => 'Panitia Inti',
                'parent_id' => null,
                'display_order' => 0,
                'active' => true,
            ])
            ->assertRedirect(route('admin.committee.index'));
        $root = CommitteeUnit::query()->where('edition_id', $edition->id)->where('name', 'Panitia Inti')->firstOrFail();

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.committee.units.store'), [
                'name' => 'Divisi Acara',
                'parent_id' => $root->id,
                'display_order' => 0,
                'active' => true,
            ])
            ->assertRedirect(route('admin.committee.index'));
        $child = CommitteeUnit::query()->where('edition_id', $edition->id)->where('name', 'Divisi Acara')->firstOrFail();

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $otherEdition->id)
            ->post(route('admin.committee.units.store'), [
                'name' => 'Edisi Lain',
                'display_order' => 0,
            ])
            ->assertRedirect(route('admin.committee.index'));

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->put(route('admin.committee.units.update', $child->id), [
                'name' => 'Divisi Acara Utama',
                'parent_id' => $root->id,
                'display_order' => 1,
                'active' => false,
            ])
            ->assertRedirect(route('admin.committee.index'));
        $this->assertDatabaseHas('committee_units', [
            'id' => $child->id,
            'name' => 'Divisi Acara Utama',
            'active' => 0,
        ]);

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->delete(route('admin.committee.units.destroy', $child->id))
            ->assertRedirect(route('admin.committee.index'));
        $this->assertDatabaseMissing('committee_units', ['id' => $child->id]);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'committee.unit.delete',
            'resource_id' => $child->id,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'committee.unit.create',
            'resource_id' => $root->id,
        ]);
        $this->assertDatabaseHas('committee_units', [
            'edition_id' => $otherEdition->id,
            'name' => 'Edisi Lain',
        ]);
    }

    public function test_tree_reorder_and_depth_validation_are_enforced(): void
    {
        $editor = $this->adminWith(PermissionKey::ContentView, PermissionKey::ContentEdit);
        $edition = Edition::factory()->create(['year' => 2025, 'lifecycle' => 'active']);
        $parent = null;
        $units = [];

        foreach (['Tingkat 1', 'Tingkat 2', 'Tingkat 3', 'Tingkat 4'] as $name) {
            $this->actingAs($editor)
                ->withCookie('pamoka_admin_edition_id', $edition->id)
                ->post(route('admin.committee.units.store'), [
                    'name' => $name,
                    'parent_id' => $parent,
                    'display_order' => count($units),
                    'active' => true,
                ])
                ->assertRedirect();
            $unit = CommitteeUnit::query()->where('edition_id', $edition->id)->where('name', $name)->firstOrFail();
            $units[] = $unit;
            $parent = $unit->id;
        }

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.committee.units.store'), [
                'name' => 'Tingkat 5',
                'parent_id' => $parent,
                'display_order' => 0,
                'active' => true,
            ])
            ->assertSessionHasErrors('parent_id');

        $first = $units[0];
        $second = CommitteeUnit::create([
            'edition_id' => $edition->id,
            'name' => 'Unit Kedua',
            'display_order' => 1,
            'active' => true,
        ]);

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.committee.units.reorder'), [
                'items' => [
                    ['id' => $second->id, 'display_order' => 0],
                    ['id' => $first->id, 'display_order' => 1],
                ],
            ])
            ->assertRedirect(route('admin.committee.index'));
        $this->assertDatabaseHas('committee_units', ['id' => $second->id, 'display_order' => 0]);
        $this->assertDatabaseHas('committee_units', ['id' => $first->id, 'display_order' => 1]);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'committee.unit.reorder',
            'resource_id' => $edition->id,
        ]);
    }

    public function test_assignments_and_quick_people_are_edition_scoped_and_versioned(): void
    {
        $editor = $this->adminWith(PermissionKey::ContentView, PermissionKey::ContentEdit);
        $edition = Edition::factory()->create(['year' => 2025, 'lifecycle' => 'active']);
        $otherEdition = Edition::factory()->create(['year' => 2026, 'lifecycle' => 'draft']);
        $unit = CommitteeUnit::create([
            'edition_id' => $edition->id,
            'name' => 'Panitia Inti',
            'display_order' => 0,
            'active' => true,
        ]);
        $person = Person::factory()->create(['name' => 'Nia Panitia']);
        $media = MediaAsset::factory()->create(['lifecycle' => 'ready', 'mime_type' => 'image/jpeg']);

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.committee.people.store'), [
                'name' => 'Raka Quick Create',
                'short_bio' => 'Profil panitia.',
                'portrait_media_id' => $media->id,
            ])
            ->assertRedirect(route('admin.committee.index'));
        $quickPerson = Person::query()->where('name', 'Raka Quick Create')->firstOrFail();
        $this->assertSame($media->id, $quickPerson->portrait_media_id);

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.committee.assignments.store'), [
                'unit_id' => $unit->id,
                'person_id' => $person->id,
                'title' => 'Ketua Pelaksana',
                'display_order' => 0,
                'active' => true,
            ])
            ->assertRedirect(route('admin.committee.index'));
        $assignment = CommitteeAssignment::query()->where('edition_id', $edition->id)->firstOrFail();

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->put(route('admin.committee.assignments.update', $assignment->id), [
                'unit_id' => $unit->id,
                'person_id' => $quickPerson->id,
                'title' => 'Ketua Panitia',
                'display_order' => 2,
                'active' => false,
                'version' => 1,
            ])
            ->assertRedirect(route('admin.committee.index'));
        $this->assertDatabaseHas('committee_assignments', [
            'id' => $assignment->id,
            'person_id' => $quickPerson->id,
            'title' => 'Ketua Panitia',
            'active' => 0,
            'version' => 2,
        ]);

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $otherEdition->id)
            ->put(route('admin.committee.assignments.update', $assignment->id), [
                'unit_id' => $unit->id,
                'person_id' => $person->id,
                'title' => 'Tidak boleh lintas edisi',
                'display_order' => 0,
                'active' => true,
                'version' => 2,
            ])
            ->assertNotFound();

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->delete(route('admin.committee.assignments.destroy', $assignment->id), ['version' => 1])
            ->assertSessionHasErrors('version');

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->delete(route('admin.committee.assignments.destroy', $assignment->id), ['version' => 2])
            ->assertRedirect(route('admin.committee.index'));
        $this->assertDatabaseMissing('committee_assignments', ['id' => $assignment->id]);

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'committee.assignment.update',
            'resource_id' => $assignment->id,
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'committee.assignment.delete',
            'resource_id' => $assignment->id,
        ]);
    }

    public function test_committee_writes_require_content_edit_permission(): void
    {
        $viewer = $this->adminWith(PermissionKey::ContentView);
        $edition = Edition::factory()->create(['year' => 2025, 'lifecycle' => 'active']);

        $this->actingAs($viewer)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.committee.units.store'), [
                'name' => 'Tidak diizinkan',
                'display_order' => 0,
            ])
            ->assertForbidden();
    }

    private function adminWith(PermissionKey ...$permissions): User
    {
        $user = User::factory()->create();
        AdminProfile::create(['user_id' => $user->id, 'status' => 'active']);
        $role = Role::create([
            'slug' => 'committee-test-role-'.$user->id,
            'label' => 'Committee Test Role',
            'description' => 'Role untuk pengujian authoring panitia.',
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

<?php

namespace Tests\Feature;

use App\Enums\PermissionKey;
use App\Models\AdminProfile;
use App\Models\Edition;
use App\Models\OrganizationAssignment;
use App\Models\OrganizationMembership;
use App\Models\OrganizationPeriod;
use App\Models\OrganizationUnit;
use App\Models\Permission;
use App\Models\Person;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class AdminOrganizationAuthoringTest extends TestCase
{
    use RefreshDatabase;

    public function test_periods_are_authored_and_edition_reassignment_requires_explicit_confirmation(): void
    {
        $editor = $this->adminWith(PermissionKey::ContentView, PermissionKey::PeopleManage);
        $sourcePeriod = OrganizationPeriod::factory()->create(['label' => 'Periode lama']);
        $targetPeriod = OrganizationPeriod::factory()->create(['label' => 'Periode baru']);
        $edition = Edition::factory()->create(['organization_period_id' => $sourcePeriod->id]);

        $this->actingAs($editor)
            ->post(route('admin.organization.periods.store'), [
                'label' => 'Periode tambahan',
                'start_year' => 2030,
                'end_year' => 2032,
                'vision' => 'Visi tambahan',
                'missions' => ['Misi pertama', 'Misi kedua'],
                'lifecycle' => 'draft',
            ])
            ->assertRedirect(route('admin.organization.index'));

        $created = OrganizationPeriod::query()->where('label', 'Periode tambahan')->firstOrFail();
        $this->assertSame(['Misi pertama', 'Misi kedua'], $created->mission_json);

        $this->actingAs($editor)
            ->get(route('admin.organization.index'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Admin/Organization/Index')
                ->has('periods', 3)
                ->has('people'));

        $this->actingAs($editor)
            ->post(route('admin.organization.periods.editions', $targetPeriod->id), [
                'period_version' => $targetPeriod->version,
                'edition_ids' => [$edition->id],
                'confirmed_reassignment_ids' => [],
            ])
            ->assertSessionHasErrors('edition_ids');

        $targetPeriod->refresh();
        $this->assertSame($sourcePeriod->id, $edition->refresh()->organization_period_id);
        $this->assertSame(1, $targetPeriod->version);

        $this->actingAs($editor)
            ->post(route('admin.organization.periods.editions', $targetPeriod->id), [
                'period_version' => $targetPeriod->version,
                'edition_ids' => [$edition->id],
                'confirmed_reassignment_ids' => [$edition->id],
            ])
            ->assertRedirect(route('admin.organization.periods.show', $targetPeriod->id));

        $this->assertSame($targetPeriod->id, $edition->refresh()->organization_period_id);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'organization.period.editions.update',
            'resource_id' => $targetPeriod->id,
        ]);
    }

    public function test_period_tree_memberships_and_legacy_mapping_are_available_through_admin_seams(): void
    {
        $editor = $this->adminWith(PermissionKey::ContentView, PermissionKey::PeopleManage);
        $period = OrganizationPeriod::factory()->create(['label' => 'Periode struktur']);
        $person = Person::factory()->create(['name' => 'Siti Organisasi']);

        $this->actingAs($editor)
            ->post(route('admin.organization.units.store'), [
                'organization_period_id' => $period->id,
                'parent_id' => null,
                'name' => 'Dewan Pembina',
                'display_order' => 0,
                'active' => true,
            ])
            ->assertRedirect(route('admin.organization.periods.show', $period->id));
        $root = OrganizationUnit::query()->where('organization_period_id', $period->id)->firstOrFail();

        $this->actingAs($editor)
            ->post(route('admin.organization.units.store'), [
                'organization_period_id' => $period->id,
                'parent_id' => $root->id,
                'name' => 'Pengurus Harian',
                'display_order' => 0,
                'active' => true,
            ])
            ->assertRedirect(route('admin.organization.periods.show', $period->id));
        $child = OrganizationUnit::query()->where('name', 'Pengurus Harian')->firstOrFail();

        $this->actingAs($editor)
            ->put(route('admin.organization.units.update', $root->id), [
                'organization_period_id' => $period->id,
                'parent_id' => $child->id,
                'name' => $root->name,
                'display_order' => 0,
                'active' => true,
            ])
            ->assertSessionHasErrors('parent_id');

        $this->actingAs($editor)
            ->post(route('admin.organization.memberships.store'), [
                'organization_period_id' => $period->id,
                'organization_unit_id' => $child->id,
                'person_id' => $person->id,
                'title' => 'Ketua',
                'display_order' => 0,
                'active' => true,
            ])
            ->assertRedirect(route('admin.organization.periods.show', $period->id));

        $membership = OrganizationMembership::query()->where('person_id', $person->id)->firstOrFail();
        $legacy = OrganizationAssignment::factory()->create([
            'person_id' => $person->id,
            'title' => 'Sekretaris lama',
            'group' => 'leadership',
        ]);

        $this->actingAs($editor)
            ->post(route('admin.organization.legacy.map'), [
                'legacy_assignment_id' => $legacy->id,
                'organization_period_id' => $period->id,
                'organization_unit_id' => $root->id,
            ])
            ->assertRedirect(route('admin.organization.periods.show', $period->id));

        $this->actingAs($editor)
            ->get(route('admin.organization.periods.show', $period->id))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Admin/Organization/Period')
                ->has('units', 2)
                ->has('members', 2)
                ->where('members.0.personId', $person->id));

        $this->assertDatabaseHas('organization_memberships', [
            'id' => $membership->id,
            'title' => 'Ketua',
        ]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'organization.legacy.map']);
    }

    public function test_people_social_links_are_validated_versioned_and_visible_in_directory(): void
    {
        $editor = $this->adminWith(PermissionKey::ContentView, PermissionKey::PeopleManage);

        $this->actingAs($editor)
            ->post(route('admin.organization.people.store'), [
                'name' => 'Nia Direktori',
                'slug' => 'nia-direktori',
                'short_bio' => 'Profil pengurus.',
                'social_links' => [
                    ['platform' => 'instagram', 'url' => 'https://instagram.com/nia', 'label' => null, 'display_order' => 0],
                ],
            ])
            ->assertRedirect(route('admin.organization.index'));

        $person = Person::query()->where('slug', 'nia-direktori')->firstOrFail();

        $this->actingAs($editor)
            ->post(route('admin.organization.people.store'), [
                'name' => 'URL Tidak Aman',
                'social_links' => [['platform' => 'instagram', 'url' => 'http://instagram.com/unsafe']],
            ])
            ->assertSessionHasErrors('social_links.0.url');

        $this->actingAs($editor)
            ->put(route('admin.organization.people.update', $person->id), [
                'name' => 'Nia Direktori Diperbarui',
                'slug' => 'nia-direktori-diperbarui',
                'short_bio' => 'Bio baru.',
                'version' => $person->version,
                'social_links' => [
                    ['platform' => 'website', 'url' => 'https://pamoka.test/nia', 'label' => null, 'display_order' => 0],
                ],
            ])
            ->assertRedirect(route('admin.organization.index'));

        $this->actingAs($editor)
            ->get(route('admin.organization.index'))
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Admin/Organization/Index')
                ->where('people.0.name', 'Nia Direktori Diperbarui')
                ->where('people.0.socialLinks.0.platform', 'website'));
    }

    public function test_organization_writes_require_people_manage_permission(): void
    {
        $viewer = $this->adminWith(PermissionKey::ContentView);

        $this->actingAs($viewer)
            ->post(route('admin.organization.periods.store'), [
                'label' => 'Tidak diizinkan',
                'start_year' => 2030,
                'end_year' => 2031,
                'missions' => [],
            ])
            ->assertForbidden();
    }

    private function adminWith(PermissionKey ...$permissions): User
    {
        $user = User::factory()->create();
        AdminProfile::create(['user_id' => $user->id, 'status' => 'active']);
        $role = Role::create([
            'slug' => 'organization-test-role-'.$user->id,
            'label' => 'Organization Test Role',
            'description' => 'Role untuk pengujian authoring organisasi.',
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

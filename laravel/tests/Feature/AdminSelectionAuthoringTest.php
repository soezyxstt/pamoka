<?php

namespace Tests\Feature;

use App\Enums\PermissionKey;
use App\Enums\StageDecision;
use App\Models\AdminProfile;
use App\Models\Category;
use App\Models\Edition;
use App\Models\EditionTitle;
use App\Models\Participant;
use App\Models\ParticipantStageEntry;
use App\Models\Permission;
use App\Models\Role;
use App\Models\SelectionStage;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class AdminSelectionAuthoringTest extends TestCase
{
    use RefreshDatabase;

    public function test_stage_workspace_is_edition_scoped_and_stages_can_be_authored(): void
    {
        $editor = $this->adminWith(PermissionKey::ContentView, PermissionKey::ParticipantsManage);
        $edition = Edition::factory()->create(['year' => 2025, 'lifecycle' => 'active']);
        $otherEdition = Edition::factory()->create(['year' => 2026, 'lifecycle' => 'draft']);
        $first = SelectionStage::factory()->create([
            'edition_id' => $edition->id,
            'name' => 'Seleksi berkas',
            'slug' => 'seleksi-berkas',
            'display_order' => 0,
            'target_participant_count' => 20,
        ]);
        $second = SelectionStage::factory()->create([
            'edition_id' => $edition->id,
            'name' => 'Semifinal',
            'slug' => 'semifinal',
            'display_order' => 1,
            'target_participant_count' => 10,
        ]);
        $otherStage = SelectionStage::factory()->create([
            'edition_id' => $otherEdition->id,
            'name' => 'Tahap lain',
            'slug' => 'tahap-lain',
        ]);

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->get(route('admin.selection.stages.index'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Admin/Participants/Stages/Index')
                ->has('stages', 2)
                ->where('stages.0.name', 'Seleksi berkas'));

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.selection.stages.store'), [
                'name' => 'Final',
                'target_participant_count' => 5,
                'final_stage' => true,
            ])
            ->assertRedirect(route('admin.selection.stages.index'));
        $final = SelectionStage::query()->where('edition_id', $edition->id)->where('slug', 'final')->firstOrFail();
        $this->assertSame(2, $final->display_order);
        $this->assertTrue($final->final_stage);

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->put(route('admin.selection.stage.update', $second->id), [
                'name' => 'Semifinal utama',
                'target_participant_count' => 10,
                'final_stage' => false,
                'version' => 1,
            ])
            ->assertRedirect(route('admin.selection.stages.index'));
        $this->assertDatabaseHas('selection_stages', ['id' => $second->id, 'name' => 'Semifinal utama', 'version' => 2]);

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.selection.stages.reorder'), [
                'items' => [
                    ['id' => $second->id, 'version' => 2],
                    ['id' => $first->id, 'version' => 1],
                    ['id' => $final->id, 'version' => 1],
                ],
            ])
            ->assertRedirect(route('admin.selection.stages.index'));
        $this->assertDatabaseHas('selection_stages', ['id' => $second->id, 'display_order' => 0, 'version' => 3]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'selection_stage.reorder', 'resource_id' => $edition->id]);

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->get(route('admin.selection.stage.workspace', $first->id))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Admin/Participants/Stages/Workspace')
                ->where('stage.id', $first->id));

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $otherEdition->id)
            ->get(route('admin.selection.stage.workspace', $first->id))
            ->assertNotFound();
        $this->assertNotNull($otherStage->refresh());
    }

    public function test_stage_decisions_close_forward_participants_and_reopen_restores_the_previous_stage(): void
    {
        $editor = $this->adminWith(PermissionKey::ContentView, PermissionKey::ParticipantsManage);
        $edition = Edition::factory()->create(['year' => 2025, 'lifecycle' => 'active']);
        $category = Category::factory()->create(['edition_id' => $edition->id]);
        $first = SelectionStage::factory()->create([
            'edition_id' => $edition->id,
            'name' => 'Audisi',
            'slug' => 'audisi',
            'display_order' => 0,
            'lifecycle' => 'active',
            'target_participant_count' => 1,
        ]);
        $next = SelectionStage::factory()->create([
            'edition_id' => $edition->id,
            'name' => 'Final',
            'slug' => 'final',
            'display_order' => 1,
            'target_participant_count' => 1,
            'final_stage' => true,
        ]);
        $participant = Participant::factory()->create([
            'edition_id' => $edition->id,
            'category_id' => $category->id,
            'stage' => $first->slug,
            'current_stage_id' => $first->id,
            'number' => 11,
        ]);
        $entry = ParticipantStageEntry::factory()->create([
            'participant_id' => $participant->id,
            'stage_id' => $first->id,
        ]);

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.selection.stage.decisions', $first->id), [
                'decision' => StageDecision::Advanced->value,
                'reason' => 'Lolos verifikasi berkas',
                'entries' => [['id' => $entry->id, 'version' => 1]],
            ])
            ->assertRedirect(route('admin.selection.stage.workspace', $first->id));
        $this->assertDatabaseHas('participant_stage_entries', ['id' => $entry->id, 'decision' => StageDecision::Advanced->value, 'version' => 2]);

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.selection.stage.close', $first->id), ['version' => 1])
            ->assertRedirect(route('admin.selection.stage.workspace', $first->id));
        $participant->refresh();
        $this->assertSame($next->id, $participant->current_stage_id);
        $this->assertSame('active', $participant->selection_status);
        $nextEntry = ParticipantStageEntry::query()->where('participant_id', $participant->id)->where('stage_id', $next->id)->firstOrFail();
        $this->assertSame(StageDecision::Pending, $nextEntry->decision);
        $this->assertDatabaseHas('selection_stages', ['id' => $next->id, 'lifecycle' => 'active']);

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.selection.stage.reopen', $first->id), [
                'version' => 2,
                'reason' => 'Perlu pemeriksaan ulang',
            ])
            ->assertRedirect(route('admin.selection.stage.workspace', $first->id));
        $participant->refresh();
        $this->assertSame($first->id, $participant->current_stage_id);
        $this->assertDatabaseHas('selection_stages', ['id' => $first->id, 'lifecycle' => 'active', 'version' => 3]);
        $this->assertDatabaseHas('selection_stages', ['id' => $next->id, 'lifecycle' => 'draft', 'version' => 3]);
        $this->assertDatabaseMissing('participant_stage_entries', ['id' => $nextEntry->id]);
    }

    public function test_stage_rollback_requires_an_active_stage_and_a_reason(): void
    {
        $editor = $this->adminWith(PermissionKey::ContentView, PermissionKey::ParticipantsManage);
        $edition = Edition::factory()->create(['year' => 2025, 'lifecycle' => 'active']);
        $category = Category::factory()->create(['edition_id' => $edition->id]);
        $stage = SelectionStage::factory()->create(['edition_id' => $edition->id, 'lifecycle' => 'active']);
        $participant = Participant::factory()->create(['edition_id' => $edition->id, 'category_id' => $category->id, 'current_stage_id' => $stage->id, 'stage' => $stage->slug]);
        $entry = ParticipantStageEntry::factory()->create(['participant_id' => $participant->id, 'stage_id' => $stage->id, 'decision' => StageDecision::Eliminated, 'version' => 1]);

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.selection.stage.rollback', [$stage->id, $entry->id]), ['version' => 1, 'reason' => 'tid'])
            ->assertSessionHasErrors('reason');

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.selection.stage.rollback', [$stage->id, $entry->id]), ['version' => 1, 'reason' => 'Koreksi keputusan'])
            ->assertRedirect(route('admin.selection.stage.workspace', $stage->id));
        $this->assertDatabaseHas('participant_stage_entries', ['id' => $entry->id, 'decision' => StageDecision::Pending->value, 'version' => 2]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'participant_stage_entry.rollback', 'resource_id' => $entry->id]);
    }

    public function test_titles_are_capacity_limited_and_only_final_participants_can_receive_them(): void
    {
        $editor = $this->adminWith(PermissionKey::ContentView, PermissionKey::ParticipantsManage);
        $edition = Edition::factory()->create(['year' => 2025, 'lifecycle' => 'active']);
        $category = Category::factory()->create(['edition_id' => $edition->id]);
        $final = SelectionStage::factory()->create(['edition_id' => $edition->id, 'slug' => 'final', 'final_stage' => true]);
        $otherStage = SelectionStage::factory()->create(['edition_id' => $edition->id, 'slug' => 'audisi', 'display_order' => 1, 'final_stage' => false]);
        $finalist = Participant::factory()->create(['edition_id' => $edition->id, 'category_id' => $category->id, 'current_stage_id' => $final->id, 'stage' => $final->slug, 'number' => 1]);
        $secondFinalist = Participant::factory()->create(['edition_id' => $edition->id, 'category_id' => $category->id, 'current_stage_id' => $final->id, 'stage' => $final->slug, 'number' => 2]);
        $notFinal = Participant::factory()->create(['edition_id' => $edition->id, 'category_id' => $category->id, 'current_stage_id' => $otherStage->id, 'stage' => $otherStage->slug, 'number' => 3]);

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->get(route('admin.selection.titles.index'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Admin/Participants/Titles/Index')
                ->where('finalStage.name', $final->name)
                ->has('finalists', 2));

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.selection.titles.store'), ['name' => 'Mojang Pinilih', 'capacity' => 1, 'description' => 'Gelar utama'])
            ->assertRedirect(route('admin.selection.titles.index'));
        $title = EditionTitle::query()->where('edition_id', $edition->id)->firstOrFail();

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.selection.title.assign', $title->id), ['participant_id' => $finalist->id, 'version' => 1])
            ->assertRedirect(route('admin.selection.titles.index'));
        $title->refresh();
        $this->assertSame(2, $title->version);
        $this->assertDatabaseHas('participant_title_assignments', ['edition_title_id' => $title->id, 'participant_id' => $finalist->id]);

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.selection.title.assign', $title->id), ['participant_id' => $secondFinalist->id, 'version' => 2])
            ->assertSessionHasErrors('title');
        $this->assertDatabaseMissing('participant_title_assignments', ['edition_title_id' => $title->id, 'participant_id' => $secondFinalist->id]);

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.selection.title.assign', $title->id), ['participant_id' => $notFinal->id, 'version' => 2])
            ->assertSessionHasErrors('participant_id');

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->put(route('admin.selection.title.update', $title->id), ['name' => 'Mojang Pinilih', 'description' => 'Gelar utama', 'capacity' => 0, 'version' => 2])
            ->assertSessionHasErrors('capacity');

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.selection.title.unassign', $title->id), ['participant_id' => $finalist->id, 'version' => 2])
            ->assertRedirect(route('admin.selection.titles.index'));
        $this->assertDatabaseMissing('participant_title_assignments', ['edition_title_id' => $title->id, 'participant_id' => $finalist->id]);
    }

    public function test_selection_writes_require_participants_manage_permission(): void
    {
        $viewer = $this->adminWith(PermissionKey::ContentView);
        $edition = Edition::factory()->create(['year' => 2025, 'lifecycle' => 'active']);

        $this->actingAs($viewer)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.selection.stages.store'), ['name' => 'Tidak diizinkan', 'target_participant_count' => 1])
            ->assertForbidden();

        $this->actingAs($viewer)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.selection.titles.store'), ['name' => 'Tidak diizinkan', 'capacity' => 1])
            ->assertForbidden();
    }

    private function adminWith(PermissionKey ...$permissions): User
    {
        $user = User::factory()->create();
        AdminProfile::create(['user_id' => $user->id, 'status' => 'active']);
        $role = Role::create([
            'slug' => 'selection-test-role-'.$user->id,
            'label' => 'Selection Test Role',
            'description' => 'Role untuk pengujian seleksi.',
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

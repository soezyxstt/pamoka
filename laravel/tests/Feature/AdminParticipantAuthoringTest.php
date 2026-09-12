<?php

namespace Tests\Feature;

use App\Enums\PermissionKey;
use App\Enums\SocialPlatform;
use App\Enums\StageDecision;
use App\Models\AdminProfile;
use App\Models\Category;
use App\Models\Edition;
use App\Models\MediaAsset;
use App\Models\Participant;
use App\Models\ParticipantStageEntry;
use App\Models\Permission;
use App\Models\Role;
use App\Models\SelectionStage;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class AdminParticipantAuthoringTest extends TestCase
{
    use RefreshDatabase;

    public function test_participant_creation_is_edition_scoped_and_enters_the_first_stage(): void
    {
        $editor = $this->adminWith(PermissionKey::ContentView, PermissionKey::ParticipantsManage);
        $edition = Edition::factory()->create(['year' => 2025, 'lifecycle' => 'active']);
        $otherEdition = Edition::factory()->create(['year' => 2026, 'lifecycle' => 'draft']);
        $category = Category::factory()->create(['edition_id' => $edition->id, 'code' => 'JD', 'slug' => 'jajaka-dewasa', 'label' => 'Jajaka Dewasa']);
        Category::factory()->create(['edition_id' => $otherEdition->id, 'code' => 'JD', 'slug' => 'jajaka-dewasa', 'label' => 'Jajaka Dewasa']);
        $stage = SelectionStage::factory()->create(['edition_id' => $edition->id, 'name' => 'Pendaftaran', 'slug' => 'pendaftaran']);

        $response = $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.participants.store'), [
                'category_id' => $category->id,
                'number' => 7,
                'name' => 'Nia Garut',
                'slug' => 'nia-garut',
                'bio' => 'Profil pendaftar.',
            ]);

        $participant = Participant::query()->where('slug', 'nia-garut')->firstOrFail();
        $response->assertRedirect(route('admin.participants.edit', $participant->id));
        $this->assertSame($edition->id, $participant->edition_id);
        $this->assertSame($category->id, $participant->category_id);
        $this->assertSame($stage->id, $participant->current_stage_id);
        $this->assertSame('registered', $participant->selection_status);
        $this->assertDatabaseHas('participant_stage_entries', [
            'participant_id' => $participant->id,
            'stage_id' => $stage->id,
            'decision' => StageDecision::Pending->value,
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'participant.create',
            'resource_id' => $participant->id,
        ]);

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->get(route('admin.participants.index'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Admin/Participants/Index')
                ->has('participants', 1)
                ->where('participants.0.name', 'Nia Garut')
                ->where('participants.0.currentStageName', 'Pendaftaran'));

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $otherEdition->id)
            ->get(route('admin.participants.edit', $participant->id))
            ->assertNotFound();
    }

    public function test_profile_relations_require_ready_images_and_use_optimistic_versioning(): void
    {
        $editor = $this->adminWith(
            PermissionKey::ContentView,
            PermissionKey::ParticipantsManage,
            PermissionKey::MediaManage,
        );
        $edition = Edition::factory()->create(['year' => 2025, 'lifecycle' => 'active']);
        $category = Category::factory()->create(['edition_id' => $edition->id]);
        $stage = SelectionStage::factory()->create(['edition_id' => $edition->id]);
        $participant = Participant::factory()->create([
            'edition_id' => $edition->id,
            'category_id' => $category->id,
            'current_stage_id' => $stage->id,
            'stage' => $stage->slug,
        ]);
        ParticipantStageEntry::factory()->create([
            'participant_id' => $participant->id,
            'stage_id' => $stage->id,
        ]);
        $portrait = MediaAsset::factory()->create(['filename' => 'nia-closeup.webp', 'url' => '/participants/nia-closeup.webp']);
        $qris = MediaAsset::factory()->create(['filename' => 'nia-qris.webp', 'url' => '/participants/nia-qris.webp']);
        $notReady = MediaAsset::factory()->create(['lifecycle' => 'processing']);

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.participants.profile', $participant->id), [
                'version' => 1,
                'payment_url' => 'https://payments.example/nia',
                'qris_media_id' => $qris->id,
                'achievements' => [
                    ['text' => 'Juara pidato', 'display_order' => 0],
                ],
                'social_links' => [
                    ['platform' => SocialPlatform::Instagram->value, 'label' => null, 'url' => 'https://instagram.com/nia', 'display_order' => 0],
                ],
                'media' => [
                    ['role' => 'closeup', 'media_asset_id' => $portrait->id, 'caption' => 'Foto utama', 'display_order' => 0, 'active' => true],
                ],
            ])
            ->assertRedirect(route('admin.participants.edit', $participant->id));

        $participant->refresh();
        $this->assertSame(2, $participant->version);
        $this->assertSame($qris->id, $participant->qris_media_id);
        $this->assertDatabaseHas('participant_achievements', ['participant_id' => $participant->id, 'text' => 'Juara pidato']);
        $this->assertDatabaseHas('participant_social_links', ['participant_id' => $participant->id, 'platform' => SocialPlatform::Instagram->value]);
        $this->assertDatabaseHas('participant_media', ['participant_id' => $participant->id, 'media_asset_id' => $portrait->id, 'role' => 'closeup']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'participant.profile.update', 'resource_id' => $participant->id]);

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.participants.profile', $participant->id), [
                'version' => 1,
                'qris_media_id' => $notReady->id,
            ])
            ->assertSessionHasErrors('version');

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.participants.profile', $participant->id), [
                'version' => 2,
                'qris_media_id' => $notReady->id,
            ])
            ->assertSessionHasErrors('qris_media_id');

        $this->assertDatabaseHas('participants', ['id' => $participant->id, 'version' => 2, 'qris_media_id' => $qris->id]);
    }

    public function test_toggle_and_delete_allow_only_an_unprocessed_pending_applicant(): void
    {
        $editor = $this->adminWith(PermissionKey::ContentView, PermissionKey::ParticipantsManage);
        $edition = Edition::factory()->create(['year' => 2025, 'lifecycle' => 'active']);
        $category = Category::factory()->create(['edition_id' => $edition->id]);
        $stage = SelectionStage::factory()->create(['edition_id' => $edition->id]);

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.participants.store'), [
                'category_id' => $category->id,
                'number' => 3,
                'name' => 'Pendaftar Baru',
            ])
            ->assertRedirect();
        $fresh = Participant::query()->where('name', 'Pendaftar Baru')->firstOrFail();

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.participants.toggle', $fresh->id), ['version' => 1])
            ->assertRedirect(route('admin.participants.index'));
        $this->assertDatabaseHas('participants', ['id' => $fresh->id, 'active' => 0, 'version' => 2]);

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->delete(route('admin.participants.destroy', $fresh->id), ['version' => 2])
            ->assertRedirect(route('admin.participants.index'));
        $this->assertDatabaseMissing('participants', ['id' => $fresh->id]);

        $processed = Participant::factory()->create([
            'edition_id' => $edition->id,
            'category_id' => $category->id,
            'current_stage_id' => $stage->id,
            'stage' => $stage->slug,
            'number' => 4,
        ]);
        ParticipantStageEntry::factory()->create([
            'participant_id' => $processed->id,
            'stage_id' => $stage->id,
            'decision' => StageDecision::Advanced,
        ]);

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->delete(route('admin.participants.destroy', $processed->id), ['version' => 1])
            ->assertSessionHasErrors('participant');
        $this->assertDatabaseHas('participants', ['id' => $processed->id]);
    }

    public function test_write_operations_require_participants_manage_permission(): void
    {
        $viewer = $this->adminWith(PermissionKey::ContentView);
        $edition = Edition::factory()->create(['year' => 2025, 'lifecycle' => 'active']);
        $category = Category::factory()->create(['edition_id' => $edition->id]);
        SelectionStage::factory()->create(['edition_id' => $edition->id]);

        $this->actingAs($viewer)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.participants.store'), [
                'category_id' => $category->id,
                'number' => 1,
                'name' => 'Tidak Diizinkan',
            ])
            ->assertForbidden();
    }

    private function adminWith(PermissionKey ...$permissions): User
    {
        $user = User::factory()->create();
        AdminProfile::create(['user_id' => $user->id, 'status' => 'active']);
        $role = Role::create([
            'slug' => 'participant-test-role-'.$user->id,
            'label' => 'Participant Test Role',
            'description' => 'Role untuk pengujian peserta.',
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

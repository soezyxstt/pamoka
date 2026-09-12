<?php

namespace Tests\Feature;

use App\Enums\PermissionKey;
use App\Models\AdminProfile;
use App\Models\Category;
use App\Models\Edition;
use App\Models\MediaAsset;
use App\Models\Participant;
use App\Models\Permission;
use App\Models\Role;
use App\Models\SelectionStage;
use App\Models\User;
use App\Models\VoteDailyTally;
use App\Models\VotingCampaign;
use App\Models\VotingCampaignParticipant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class AdminVotingTest extends TestCase
{
    use RefreshDatabase;

    public function test_manager_can_create_configure_start_close_and_publish_a_campaign(): void
    {
        $manager = $this->adminWith(PermissionKey::VotingView, PermissionKey::VotingManage);
        $edition = Edition::factory()->create(['year' => 2025, 'lifecycle' => 'active']);
        $category = Category::factory()->create(['edition_id' => $edition->id, 'code' => 'MD', 'slug' => 'mojang-dewasa']);
        $stage = SelectionStage::factory()->create([
            'edition_id' => $edition->id,
            'name' => 'Final',
            'slug' => 'final',
            'lifecycle' => 'active',
            'final_stage' => true,
        ]);
        $otherStage = SelectionStage::factory()->create([
            'edition_id' => $edition->id,
            'name' => 'Final revisi',
            'slug' => 'final-revisi',
            'display_order' => 1,
            'lifecycle' => 'draft',
        ]);
        Participant::factory()->create([
            'edition_id' => $edition->id,
            'category_id' => $category->id,
            'current_stage_id' => $stage->id,
            'selection_status' => 'selected',
            'name' => 'Peserta Aktif',
        ]);
        Participant::factory()->create([
            'edition_id' => $edition->id,
            'category_id' => $category->id,
            'current_stage_id' => $stage->id,
            'selection_status' => 'eliminated',
            'name' => 'Peserta Tereliminasi',
        ]);

        $this->actingAs($manager)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->get(route('admin.voting.index'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Admin/Voting/Index')
                ->has('campaigns', 0)
                ->has('stages', 2)
                ->where('canManage', true)
                ->where('canTally', false));

        $this->actingAs($manager)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.voting.campaigns.store'), [
                'name' => 'Voting Kameumeut 2025',
                'slug' => 'voting-kameumeut-2025',
                'eligibility_stage_id' => $stage->id,
                'starts_at' => '2025-09-01T00:00',
                'ends_at' => '2025-09-30T23:59',
                'price_per_point' => 2000,
            ])
            ->assertRedirect(route('admin.voting.index'));
        $campaign = VotingCampaign::query()->where('edition_id', $edition->id)->firstOrFail();

        $this->actingAs($manager)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->put(route('admin.voting.campaigns.stage', $campaign->id), [
                'stage_id' => $otherStage->id,
                'version' => $campaign->version,
            ])
            ->assertRedirect(route('admin.voting.index'));
        $campaign->refresh();
        $this->assertSame($otherStage->id, $campaign->eligibility_stage_id);
        $this->assertSame(2, $campaign->version);

        $this->actingAs($manager)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.voting.campaigns.start', $campaign->id), [
                'confirmation' => $campaign->name,
                'reason' => 'Snapshot peserta sudah diperiksa.',
                'version' => $campaign->version,
            ])
            ->assertSessionHasErrors('stage_id');

        $campaign->forceFill(['eligibility_stage_id' => $stage->id, 'version' => 3])->save();
        $this->actingAs($manager)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.voting.campaigns.start', $campaign->id), [
                'confirmation' => $campaign->name,
                'reason' => 'Snapshot peserta sudah diperiksa.',
                'version' => 3,
            ])
            ->assertRedirect(route('admin.voting.index'));
        $campaign->refresh();
        $this->assertSame('active', $campaign->status);
        $this->assertSame(4, $campaign->version);
        $this->assertDatabaseCount('voting_campaign_participants', 1);

        $this->actingAs($manager)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.voting.campaigns.visibility', $campaign->id), [
                'visibility' => 'visible',
                'reason' => 'Hasil sudah siap diumumkan.',
                'version' => 4,
            ])
            ->assertRedirect(route('admin.voting.index'));
        $campaign->refresh();
        $this->assertSame('visible', $campaign->result_visibility);
        $this->assertSame(5, $campaign->version);

        $this->actingAs($manager)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.voting.campaigns.close', $campaign->id), [
                'confirmation' => $campaign->name,
                'reason' => 'Periode voting telah berakhir.',
                'version' => 5,
            ])
            ->assertRedirect(route('admin.voting.index'));
        $this->assertDatabaseHas('voting_campaigns', [
            'id' => $campaign->id,
            'status' => 'closed',
            'version' => 6,
        ]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'voting.campaign.create', 'resource_id' => $campaign->id]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'voting.campaign.start', 'resource_id' => $campaign->id]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'voting.campaign.visibility.update', 'resource_id' => $campaign->id]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'voting.campaign.close', 'resource_id' => $campaign->id]);
    }

    public function test_tally_operator_can_save_and_correct_daily_amounts_with_version_checks(): void
    {
        $operator = $this->adminWith(PermissionKey::VotingView, PermissionKey::VotingTally);
        $edition = Edition::factory()->create(['year' => 2025, 'lifecycle' => 'active']);
        $category = Category::factory()->create(['edition_id' => $edition->id, 'code' => 'JD', 'slug' => 'jajaka-dewasa']);
        $stage = SelectionStage::factory()->create(['edition_id' => $edition->id, 'lifecycle' => 'active']);
        $qris = MediaAsset::factory()->create(['lifecycle' => 'ready', 'mime_type' => 'image/png']);
        $participant = Participant::factory()->create([
            'edition_id' => $edition->id,
            'category_id' => $category->id,
            'current_stage_id' => $stage->id,
            'selection_status' => 'selected',
            'qris_media_id' => $qris->id,
        ]);
        $campaign = VotingCampaign::factory()->create([
            'edition_id' => $edition->id,
            'eligibility_stage_id' => $stage->id,
            'status' => 'active',
            'starts_at' => '2025-09-01 00:00:00',
            'ends_at' => '2025-09-30 23:59:00',
            'started_at' => '2025-09-01 00:00:00',
        ]);
        VotingCampaignParticipant::create([
            'campaign_id' => $campaign->id,
            'participant_id' => $participant->id,
            'source_stage_id' => $stage->id,
            'added_at' => now(),
        ]);

        $this->actingAs($operator)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->get(route('admin.voting.index'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('canManage', false)
                ->where('canTally', true)
                ->where('participants.0.qrisReady', true));

        $this->actingAs($operator)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.voting.tallies.store'), [
                'campaign_id' => $campaign->id,
                'participant_id' => $participant->id,
                'local_date' => '2025-09-15',
                'amount' => 4000,
                'version' => 0,
                'reason' => 'Rekap merchant pukul 16.00 WIB.',
            ])
            ->assertRedirect(route('admin.voting.index'));
        $tally = VoteDailyTally::query()->firstOrFail();
        $this->assertSame(4000, $tally->amount);
        $this->assertSame(1, $tally->version);

        $this->actingAs($operator)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.voting.tallies.store'), [
                'campaign_id' => $campaign->id,
                'participant_id' => $participant->id,
                'local_date' => '2025-09-15',
                'amount' => 6000,
                'version' => 1,
                'reason' => 'Koreksi setelah rekonsiliasi.',
            ])
            ->assertRedirect(route('admin.voting.index'));
        $this->assertDatabaseHas('vote_daily_tallies', ['id' => $tally->id, 'amount' => 6000, 'version' => 2]);

        $this->actingAs($operator)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.voting.tallies.store'), [
                'campaign_id' => $campaign->id,
                'participant_id' => $participant->id,
                'local_date' => '2025-09-15',
                'amount' => 8000,
                'version' => 1,
                'reason' => 'Versi lama.',
            ])
            ->assertSessionHasErrors('version');
        $this->assertDatabaseHas('audit_logs', ['action' => 'voting.tally.create', 'resource_id' => $tally->id]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'voting.tally.correct', 'resource_id' => $tally->id]);
    }

    public function test_voting_writes_require_the_specific_permission(): void
    {
        $viewer = $this->adminWith(PermissionKey::VotingView);
        $edition = Edition::factory()->create(['year' => 2025, 'lifecycle' => 'active']);
        $stage = SelectionStage::factory()->create(['edition_id' => $edition->id]);

        $this->actingAs($viewer)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.voting.campaigns.store'), [
                'name' => 'Tidak boleh',
                'slug' => 'tidak-boleh',
                'eligibility_stage_id' => $stage->id,
                'starts_at' => '2025-09-01T00:00',
                'ends_at' => '2025-09-02T00:00',
                'price_per_point' => 2000,
            ])
            ->assertForbidden();

        $tallyOnly = $this->adminWith(PermissionKey::VotingView, PermissionKey::VotingTally);
        $this->actingAs($tallyOnly)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.voting.campaigns.store'), [
                'name' => 'Juga tidak boleh',
                'slug' => 'juga-tidak-boleh',
                'eligibility_stage_id' => $stage->id,
                'starts_at' => '2025-09-01T00:00',
                'ends_at' => '2025-09-02T00:00',
                'price_per_point' => 2000,
            ])
            ->assertForbidden();
    }

    private function adminWith(PermissionKey ...$permissions): User
    {
        $user = User::factory()->create();
        AdminProfile::create(['user_id' => $user->id, 'status' => 'active']);
        $role = Role::create([
            'slug' => 'voting-test-role-'.$user->id,
            'label' => 'Voting Test Role',
            'description' => 'Role untuk pengujian operasi voting.',
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

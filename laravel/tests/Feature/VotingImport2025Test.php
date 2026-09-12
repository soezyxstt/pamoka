<?php

namespace Tests\Feature;

use App\Models\Participant;
use App\Models\VoteDailyTally;
use App\Models\VotingCampaign;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class VotingImport2025Test extends TestCase
{
    use RefreshDatabase;

    public function test_dry_run_validates_the_voting_snapshot_without_writing(): void
    {
        $this->artisan('moka:import-voting')
            ->assertExitCode(0);

        $this->assertDatabaseCount('voting_campaigns', 0);
        $this->assertDatabaseCount('voting_campaign_participants', 0);
        $this->assertDatabaseCount('vote_daily_tallies', 0);
    }

    public function test_apply_refuses_a_non_local_database_target(): void
    {
        Config::set('database.connections.mysql.host', 'database.example.test');

        $this->artisan('moka:import-voting', ['--apply' => true])
            ->assertExitCode(1);

        $this->assertDatabaseCount('voting_campaigns', 0);
    }

    public function test_apply_import_is_idempotent_and_feeds_public_voting_readers(): void
    {
        $this->artisan('moka:import-participants', ['--apply' => true])
            ->assertExitCode(0);
        $this->artisan('moka:import-voting', ['--apply' => true])
            ->assertExitCode(0);

        $this->assertDatabaseCount('voting_campaigns', 1);
        $this->assertDatabaseCount('voting_campaign_participants', 44);
        $this->assertDatabaseCount('vote_daily_tallies', 572);
        $this->assertDatabaseCount('media_assets', 104);
        $this->assertSame(44, Participant::query()->whereNotNull('qris_media_id')->count());
        $this->assertDatabaseHas('voting_campaigns', [
            'slug' => 'voting-kameumeut-2025',
            'status' => 'closed',
            'price_per_point' => 2000,
            'result_visibility' => 'hidden',
        ]);

        $this->artisan('moka:import-voting', ['--apply' => true])
            ->assertExitCode(0);

        $this->assertDatabaseCount('voting_campaigns', 1);
        $this->assertDatabaseCount('voting_campaign_participants', 44);
        $this->assertDatabaseCount('vote_daily_tallies', 572);
        $this->assertDatabaseCount('media_assets', 104);

        $indexResponse = $this->get(route('public.voting.index', ['category' => 'mojang-dewasa']));
        $indexResponse->assertOk();
        $indexResponse->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Public/Voting/Index')
            ->where('campaign.status', 'closed')
            ->where('campaign.pricePerPoint', 2000)
            ->where('voting.open', false)
            ->has('participants', 11)
            ->where('participants.0.name', 'Tiara Febrianti')
            ->where('participants.0.qrisImage', '/qr/MD/Tiara_Febrianti.jpg')
        );

        $candidateResponse = $this->get(route('public.voting.show', [
            'category' => 'mojang-dewasa',
            'name' => 'tiara-febrianti',
        ]));
        $candidateResponse->assertOk();
        $candidateResponse->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Public/Voting/Show')
            ->where('participant.name', 'Tiara Febrianti')
            ->where('participant.qrisImage', '/qr/MD/Tiara_Febrianti.jpg')
        );

        $resultsResponse = $this->get(route('public.voting.results', ['category' => 'mojang-dewasa']));
        $resultsResponse->assertOk();
        $resultsResponse->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Public/Voting/Results')
            ->where('hasPublishedResults', false)
            ->has('results', 11)
            ->where('results.0.percentage', 0)
            ->where('results.0.amount', null)
        );
    }

    public function test_visible_results_are_calculated_as_percentages_from_daily_amounts(): void
    {
        $this->artisan('moka:import-participants', ['--apply' => true]);
        $this->artisan('moka:import-voting', ['--apply' => true]);

        $campaign = VotingCampaign::query()->firstOrFail();
        $campaign->forceFill(['result_visibility' => 'visible'])->save();
        $first = Participant::query()->where('slug', 'tiara-febrianti')->firstOrFail();
        $second = Participant::query()->where('slug', 'zihan-nur-aulia')->firstOrFail();
        VoteDailyTally::query()
            ->where('campaign_id', $campaign->id)
            ->where('participant_id', $first->id)
            ->where('local_date', '2025-07-28')
            ->update(['amount' => 2000]);
        VoteDailyTally::query()
            ->where('campaign_id', $campaign->id)
            ->where('participant_id', $second->id)
            ->where('local_date', '2025-07-28')
            ->update(['amount' => 1000]);

        $response = $this->get(route('public.voting.results', ['category' => 'mojang-dewasa']));

        $response->assertOk();
        $response->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Public/Voting/Results')
            ->where('hasPublishedResults', true)
            ->where('summary.leader', 'Tiara Febrianti')
            ->where('results.0.name', 'Tiara Febrianti')
            ->where('results.0.percentage', 66.67)
            ->where('results.0.amount', 2000)
            ->where('results.1.name', 'Zihan Nur Aulia')
            ->where('results.1.percentage', 33.33)
            ->where('results.1.amount', 1000)
        );
    }
}

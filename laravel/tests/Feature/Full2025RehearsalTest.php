<?php

namespace Tests\Feature;

use App\Models\Edition;
use App\Models\Event;
use App\Models\GalleryItem;
use App\Models\NewsArticle;
use App\Models\Participant;
use App\Models\ParticipantAchievement;
use App\Models\ParticipantStageEntry;
use App\Models\Sponsor;
use App\Models\VotingCampaign;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class Full2025RehearsalTest extends TestCase
{
    use RefreshDatabase;

    public function test_dry_run_validates_the_complete_2025_snapshot_without_writing(): void
    {
        $this->artisan('moka:rehearse-2025')
            ->assertSuccessful()
            ->expectsOutputToContain('Rehearsal lengkap 2025 lulus.')
            ->expectsOutputToContain('Tidak ada perubahan database.');

        $this->assertDatabaseCount('editions', 0);
        $this->assertDatabaseCount('participants', 0);
        $this->assertDatabaseCount('news_articles', 0);
    }

    public function test_apply_loads_every_public_snapshot_and_is_idempotent(): void
    {
        $this->artisan('moka:rehearse-2025', ['--apply' => true])
            ->assertSuccessful()
            ->expectsOutputToContain('Rehearsal lengkap 2025 berhasil diterapkan.');

        $this->assertDatabaseCount('editions', 1);
        $this->assertDatabaseCount('categories', 4);
        $this->assertDatabaseCount('selection_stages', 2);
        $this->assertDatabaseCount('participants', 60);
        $this->assertDatabaseCount('participant_stage_entries', 104);
        $this->assertDatabaseCount('participant_achievements', 164);
        $this->assertDatabaseCount('news_articles', 3);
        $this->assertDatabaseCount('page_sections', 1);
        $this->assertDatabaseCount('events', 6);
        $this->assertDatabaseCount('gallery_items', 69);
        $this->assertDatabaseCount('sponsors', 68);
        $this->assertDatabaseCount('people', 19);
        $this->assertDatabaseCount('organization_assignments', 21);
        $this->assertDatabaseCount('voting_campaigns', 1);
        $this->assertDatabaseCount('voting_campaign_participants', 44);
        $this->assertDatabaseCount('vote_daily_tallies', 572);

        $this->assertSame('active', Edition::query()->where('year', 2025)->value('lifecycle'));
        $this->assertSame(44, Participant::query()->where('stage', 'final')->count());
        $this->assertSame(3, NewsArticle::query()->where('status', 'published')->count());
        $this->assertSame(6, Event::query()->where('active', true)->count());
        $this->assertSame(69, GalleryItem::query()->where('active', true)->count());
        $this->assertSame(68, Sponsor::query()->where('active', true)->count());
        $this->assertSame(164, ParticipantAchievement::query()->count());
        $this->assertSame(104, ParticipantStageEntry::query()->count());
        $this->assertSame('closed', VotingCampaign::query()->where('slug', 'voting-kameumeut-2025')->value('status'));

        $this->artisan('moka:rehearse-2025', ['--apply' => true])
            ->assertSuccessful();

        $this->assertDatabaseCount('editions', 1);
        $this->assertDatabaseCount('participants', 60);
        $this->assertDatabaseCount('news_articles', 3);
        $this->assertDatabaseCount('page_sections', 1);
        $this->assertDatabaseCount('events', 6);
        $this->assertDatabaseCount('gallery_items', 69);
        $this->assertDatabaseCount('sponsors', 68);
        $this->assertDatabaseCount('people', 19);
        $this->assertDatabaseCount('organization_assignments', 21);
        $this->assertDatabaseCount('voting_campaigns', 1);
        $this->assertDatabaseCount('vote_daily_tallies', 572);

        $this->get(route('home'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Home')
                ->has('news', 3)
            );

        $this->get(route('public.about'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Public/About')
                ->has('leadership', 16)
                ->has('pastLeaders', 5)
                ->has('videos', 9)
            );

        $this->get(route('public.events.show', ['event' => 'audisi']))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Public/Events/Show')
                ->where('event.slug', 'audisi')
                ->has('event.images', 10)
            );

        $this->get(route('public.news.show', ['slug' => 'press-release-semifinalis']))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Public/News/Show')
                ->where('article.slug', 'press-release-semifinalis')
            );

        $this->get(route('public.finalists.index', ['category' => 'mojang-dewasa']))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Public/Participants/Index')
                ->where('mode', 'finalists')
                ->has('participants', 11)
            );

        $this->get(route('public.voting.results', ['category' => 'mojang-dewasa']))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Public/Voting/Results')
                ->has('results', 11)
            );
    }

    public function test_apply_is_blocked_when_the_database_is_not_the_isolated_rehearsal_target(): void
    {
        config()->set('database.connections.mysql.database', 'pamoka');

        $this->artisan('moka:rehearse-2025', ['--apply' => true])
            ->assertFailed()
            ->expectsOutputToContain('pamoka_test');

        $this->assertDatabaseCount('editions', 0);
    }
}

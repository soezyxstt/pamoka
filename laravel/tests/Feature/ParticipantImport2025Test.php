<?php

namespace Tests\Feature;

use App\Models\Edition;
use App\Models\MediaAsset;
use App\Models\Participant;
use App\Models\ParticipantAchievement;
use App\Models\ParticipantMedia;
use App\Models\ParticipantStageEntry;
use App\Models\SelectionStage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class ParticipantImport2025Test extends TestCase
{
    use RefreshDatabase;

    public function test_dry_run_validates_the_snapshot_without_writing(): void
    {
        $this->artisan('moka:import-participants')
            ->assertExitCode(0);

        $this->assertDatabaseCount('editions', 0);
        $this->assertDatabaseCount('participants', 0);
    }

    public function test_apply_refuses_a_non_local_database_target(): void
    {
        Config::set('database.connections.mysql.host', 'database.example.test');

        $this->artisan('moka:import-participants', ['--apply' => true])
            ->assertExitCode(1);

        $this->assertDatabaseCount('editions', 0);
    }

    public function test_apply_import_is_idempotent_and_preserves_stage_membership(): void
    {
        $this->artisan('moka:import-participants', ['--apply' => true])
            ->assertExitCode(0);

        $this->assertDatabaseCount('editions', 1);
        $this->assertDatabaseCount('categories', 4);
        $this->assertDatabaseCount('selection_stages', 2);
        $this->assertDatabaseCount('participants', 60);
        $this->assertDatabaseCount('participant_stage_entries', 104);
        $this->assertDatabaseCount('participant_achievements', 164);
        $this->assertDatabaseCount('media_assets', 60);
        $this->assertDatabaseCount('participant_media', 60);
        $this->assertDatabaseCount('edition_titles', 0);
        $this->assertDatabaseHas('selection_stages', [
            'slug' => 'semifinalis',
            'target_participant_count' => 60,
        ]);
        $this->assertDatabaseHas('selection_stages', [
            'slug' => 'finalis',
            'target_participant_count' => 44,
            'final_stage' => 1,
        ]);
        $this->assertSame(44, ParticipantStageEntry::query()->where('decision', 'advanced')->count());
        $this->assertSame(16, ParticipantStageEntry::query()->where('decision', 'eliminated')->count());
        $this->assertSame(44, ParticipantStageEntry::query()->where('decision', 'pending')->count());

        $this->artisan('moka:import-participants', ['--apply' => true])
            ->assertExitCode(0);

        $this->assertDatabaseCount('participants', 60);
        $this->assertDatabaseCount('participant_stage_entries', 104);
        $this->assertDatabaseCount('participant_achievements', 164);
        $this->assertDatabaseCount('media_assets', 60);
        $this->assertDatabaseCount('participant_media', 60);

        $finalistResponse = $this->get(route('public.finalists.index', ['category' => 'mojang-rumaja']));
        $finalistResponse->assertInertia(fn (AssertableInertia $page) => $page
            ->where('edition.year', 2025)
            ->where('stage.slug', 'finalis')
            ->has('participants', 11)
            ->where('participants.0.name', 'Vina Faulina')
            ->where('participants.0.image', '/finalis/MR/MR01.webp')
        );

        $semifinalistResponse = $this->get(route('public.semifinalists.index', ['category' => 'mojang-rumaja']));
        $semifinalistResponse->assertInertia(fn (AssertableInertia $page) => $page
            ->where('stage.slug', 'semifinalis')
            ->has('participants', 16)
            ->where('participants.0.name', 'Vina Faulina')
        );

        $participant = Participant::query()->where('slug', 'vina-faulina')->firstOrFail();
        $this->assertSame('Mojang Rumaja', $participant->category->label);
        $this->assertSame('Finalis', $participant->currentStage->name);
        $this->assertSame('/finalis/MR/MR01.webp', $participant->media->firstOrFail()->mediaAsset->url);
        $this->assertSame('Juara 3 pidato', $participant->achievements->firstOrFail()->text);
        $this->assertTrue(Edition::query()->where('year', 2025)->exists());
        $this->assertTrue(SelectionStage::query()->where('slug', 'finalis')->exists());
        $this->assertTrue(MediaAsset::query()->where('provider_key', '/finalis/MR/MR01.webp')->exists());
        $this->assertTrue(ParticipantMedia::query()->where('participant_id', $participant->id)->exists());
        $this->assertTrue(ParticipantAchievement::query()->where('participant_id', $participant->id)->exists());
    }
}

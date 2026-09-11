<?php

namespace Tests\Feature;

use App\Enums\ParticipantMediaRole;
use App\Enums\SocialPlatform;
use App\Models\Category;
use App\Models\Edition;
use App\Models\EditionTitle;
use App\Models\MediaAsset;
use App\Models\Participant;
use App\Models\ParticipantAchievement;
use App\Models\ParticipantMedia;
use App\Models\ParticipantSocialLink;
use App\Models\SelectionStage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class PublicParticipantControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_finalist_index_renders_only_active_participants_for_the_active_edition(): void
    {
        $edition = Edition::factory()->create([
            'year' => 2025,
            'slug' => 'pasanggiri-2025',
            'lifecycle' => 'active',
        ]);
        $category = Category::factory()->for($edition)->create([
            'code' => 'MD',
            'slug' => 'mojang-dewasa',
            'label' => 'Mojang Dewasa',
        ]);
        $stage = SelectionStage::factory()->for($edition)->create([
            'name' => 'Final',
            'slug' => 'final',
            'lifecycle' => 'active',
            'final_stage' => true,
        ]);
        $semifinalStage = SelectionStage::factory()->for($edition)->create([
            'name' => 'Semifinal',
            'slug' => 'semifinal',
            'lifecycle' => 'active',
        ]);
        Participant::factory()->for($edition)->for($category)->for($stage, 'currentStage')->create([
            'stage' => 'final',
            'selection_status' => 'completed',
            'number' => 2,
            'name' => 'Budi Kedua',
            'slug' => 'budi-kedua',
            'display_order' => 2,
        ]);
        Participant::factory()->for($edition)->for($category)->for($stage, 'currentStage')->create([
            'stage' => 'final',
            'selection_status' => 'completed',
            'number' => 1,
            'name' => 'Ayu Pertama',
            'slug' => 'ayu-pertama',
            'display_order' => 1,
        ]);
        Participant::factory()->for($edition)->for($category)->for($stage, 'currentStage')->create([
            'stage' => 'final',
            'selection_status' => 'completed',
            'number' => 3,
            'name' => 'Tidak Aktif',
            'slug' => 'tidak-aktif',
            'active' => false,
            'display_order' => 3,
        ]);
        Participant::factory()->for($edition)->for($category)->for($semifinalStage, 'currentStage')->create([
            'stage' => 'final',
            'selection_status' => 'completed',
            'number' => 4,
            'name' => 'Tahap Saat Ini Semifinal',
            'slug' => 'tahap-saat-ini-semifinal',
            'display_order' => 4,
        ]);

        $response = $this->get(route('public.finalists.index', ['category' => 'mojang-dewasa']));

        $response->assertOk();
        $response->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Public/Participants/Index')
            ->where('mode', 'finalists')
            ->where('edition.year', 2025)
            ->where('category.code', 'MD')
            ->where('stage.slug', 'final')
            ->has('participants', 2)
            ->where('participants.0.name', 'Ayu Pertama')
            ->where('participants.1.name', 'Budi Kedua')
        );
    }

    public function test_semifinalist_index_uses_the_semifinal_stage_and_returns_empty_when_no_public_rows_exist(): void
    {
        $edition = Edition::factory()->create([
            'year' => 2025,
            'slug' => 'pasanggiri-2025',
            'lifecycle' => 'active',
        ]);
        Category::factory()->for($edition)->create([
            'code' => 'MR',
            'slug' => 'mojang-rumaja',
            'label' => 'Mojang Rumaja',
        ]);
        SelectionStage::factory()->for($edition)->create([
            'name' => 'Semifinal',
            'slug' => 'semifinal',
            'lifecycle' => 'active',
        ]);

        $response = $this->get(route('public.semifinalists.index', ['category' => 'mojang-rumaja']));

        $response->assertOk();
        $response->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Public/Participants/Index')
            ->where('mode', 'semifinalists')
            ->where('category.label', 'Mojang Rumaja')
            ->where('stage.name', 'Semifinal')
            ->has('participants', 0)
            ->where('emptyState', 'Belum ada data Semifinalis yang dipublikasikan untuk edisi ini.')
        );
    }

    public function test_finalist_detail_renders_the_selected_public_profile(): void
    {
        $edition = Edition::factory()->create([
            'year' => 2025,
            'slug' => 'pasanggiri-2025',
            'lifecycle' => 'active',
        ]);
        $category = Category::factory()->for($edition)->create([
            'code' => 'JD',
            'slug' => 'jajaka-dewasa',
            'label' => 'Jajaka Dewasa',
        ]);
        $stage = SelectionStage::factory()->for($edition)->create([
            'name' => 'Final',
            'slug' => 'final',
            'lifecycle' => 'active',
            'final_stage' => true,
        ]);
        $participant = Participant::factory()->for($edition)->for($category)->for($stage, 'currentStage')->create([
            'stage' => 'final',
            'selection_status' => 'completed',
            'number' => 7,
            'name' => 'Contoh Finalis',
            'slug' => 'contoh-finalis',
            'bio' => 'Profil singkat peserta untuk pengujian.',
        ]);
        $title = EditionTitle::factory()->for($edition)->create([
            'name' => 'Jajaka Pinilih',
            'description' => 'Gelar utama edisi 2025.',
        ]);
        $otherTitle = EditionTitle::factory()->for(Edition::factory()->create())->create([
            'name' => 'Gelar Edisi Lain',
        ]);
        $asset = MediaAsset::factory()->create([
            'url' => '/participants/contoh-finalis.webp',
            'alt' => 'Foto Contoh Finalis',
            'lifecycle' => 'ready',
        ]);
        ParticipantAchievement::factory()->for($participant)->create([
            'text' => 'Juara pidato tingkat kabupaten.',
        ]);
        ParticipantSocialLink::factory()->for($participant)->create([
            'platform' => SocialPlatform::Instagram,
            'label' => '@contohfinalis',
            'url' => 'https://instagram.com/contohfinalis',
        ]);
        ParticipantMedia::factory()->for($participant)->for($asset, 'mediaAsset')->create([
            'role' => ParticipantMediaRole::Closeup,
        ]);
        $participant->titles()->attach($title, ['assigned_at' => now()]);
        $participant->titles()->attach($otherTitle, ['assigned_at' => now()]);

        $response = $this->get(route('public.finalists.show', [
            'category' => 'jajaka-dewasa',
            'name' => 'contoh-finalis',
        ]));

        $response->assertOk();
        $response->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Public/Participants/Show')
            ->where('mode', 'finalists')
            ->where('category.code', 'JD')
            ->where('participant.name', 'Contoh Finalis')
            ->where('participant.number', 7)
            ->where('participant.bio', 'Profil singkat peserta untuk pengujian.')
            ->where('participant.image', '/participants/contoh-finalis.webp')
            ->where('participant.imageAlt', 'Foto Contoh Finalis')
            ->where('participant.achievements.0', 'Juara pidato tingkat kabupaten.')
            ->where('participant.socialLinks.0.label', '@contohfinalis')
            ->has('participant.titles', 1)
            ->where('participant.titles.0.name', 'Jajaka Pinilih')
        );
    }

    public function test_unknown_category_returns_not_found(): void
    {
        $response = $this->get(route('public.finalists.index', ['category' => 'kategori-tidak-ada']));

        $response->assertNotFound();
    }

    public function test_draft_edition_is_not_exposed_as_public_participant_data(): void
    {
        $edition = Edition::factory()->create([
            'year' => 2025,
            'slug' => 'pasanggiri-2025',
            'lifecycle' => 'draft',
        ]);
        $category = Category::factory()->for($edition)->create([
            'code' => 'JR',
            'slug' => 'jajaka-rumaja',
            'label' => 'Jajaka Rumaja',
        ]);
        $stage = SelectionStage::factory()->for($edition)->create([
            'name' => 'Final',
            'slug' => 'final',
            'lifecycle' => 'active',
            'final_stage' => true,
        ]);
        Participant::factory()->for($edition)->for($category)->for($stage, 'currentStage')->create([
            'stage' => 'final',
            'name' => 'Draft Tidak Tampil',
            'slug' => 'draft-tidak-tampil',
        ]);

        $response = $this->get(route('public.finalists.index', ['category' => 'jajaka-rumaja']));

        $response->assertOk();
        $response->assertInertia(fn (AssertableInertia $page) => $page
            ->where('edition', null)
            ->has('participants', 0)
        );
    }

    public function test_missing_participant_returns_not_found(): void
    {
        $edition = Edition::factory()->create([
            'year' => 2025,
            'slug' => 'pasanggiri-2025',
            'lifecycle' => 'active',
        ]);
        Category::factory()->for($edition)->create([
            'code' => 'MD',
            'slug' => 'mojang-dewasa',
            'label' => 'Mojang Dewasa',
        ]);

        $response = $this->get(route('public.finalists.show', [
            'category' => 'mojang-dewasa',
            'name' => 'peserta-tidak-ada',
        ]));

        $response->assertNotFound();
    }
}

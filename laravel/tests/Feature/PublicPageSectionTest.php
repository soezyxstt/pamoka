<?php

namespace Tests\Feature;

use App\Models\Edition;
use App\Models\PageSection;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class PublicPageSectionTest extends TestCase
{
    use RefreshDatabase;

    public function test_about_reads_only_published_page_sections_for_the_active_edition(): void
    {
        $activeEdition = Edition::factory()->create(['year' => 2025, 'lifecycle' => 'active']);
        $otherEdition = Edition::factory()->create(['year' => 2026, 'lifecycle' => 'draft']);

        PageSection::create([
            'edition_id' => $activeEdition->id,
            'page_key' => 'tentang',
            'section_key' => 'misi',
            'title' => 'Misi edisi 2025',
            'body' => "Misi aktif\nMisi kedua",
            'presentation_json' => ['items' => ['Misi aktif', 'Misi kedua']],
            'status' => 'published',
        ]);
        PageSection::create([
            'edition_id' => $activeEdition->id,
            'page_key' => 'tentang',
            'section_key' => 'video',
            'title' => 'Video edisi 2025',
            'presentation_json' => ['items' => ['ActiveVideo01']],
            'status' => 'published',
        ]);
        PageSection::create([
            'edition_id' => $activeEdition->id,
            'page_key' => 'tentang',
            'section_key' => 'misi-draft',
            'title' => 'Jangan tampil',
            'body' => 'Draft tidak dipublikasikan',
            'presentation_json' => ['items' => ['Draft tidak dipublikasikan']],
            'status' => 'draft',
        ]);
        PageSection::create([
            'edition_id' => $otherEdition->id,
            'page_key' => 'tentang',
            'section_key' => 'misi',
            'title' => 'Misi edisi lain',
            'body' => 'Jangan tampil',
            'presentation_json' => ['items' => ['Jangan tampil']],
            'status' => 'published',
        ]);

        $this->get(route('public.about'))
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Public/About')
                ->has('missions', 2)
                ->where('missions.0', 'Misi aktif')
                ->where('missions.1', 'Misi kedua')
                ->has('videos', 1)
                ->where('videos.0.id', 'ActiveVideo01')
                ->where('videos.0.title', 'Video kegiatan PAMOKA')
            );
    }
}

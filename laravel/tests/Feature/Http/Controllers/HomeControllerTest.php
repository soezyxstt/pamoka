<?php

namespace Tests\Feature\Http\Controllers;

use App\Models\Edition;
use App\Models\MediaAsset;
use App\Models\SiteAssetBinding;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Collection;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class HomeControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_home_page_renders_the_inertia_home_component(): void
    {
        $response = $this->get(route('home'));

        $response->assertOk();
        $response->assertHeader('Vary', 'X-Inertia');
        $response->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Home')
            ->where('meta.description', 'Official website Paguyuban Mojang Jajaka Kabupaten Garut.')
            ->where('hero.title', 'Paguyuban Mojang Jajaka Kabupaten Garut')
            ->where('hero.tagline', 'Nu Nyunda Tur Nyakola')
            ->has('programs', 6)
            ->has('news', 3)
            ->where('news.0.href', '/berita/press-release-semifinalis.pdf')
            ->where('news.1.href', 'https://www.garuters.id/2025/07/pasanggiri-mojang-jajaka-kabupaten-garut-2025.html')
            ->where('join.href', 'https://linktr.ee/mokagarut')
        );
    }

    public function test_home_news_snapshot_uses_local_images_and_preserves_external_links(): void
    {
        $response = $this->get(route('home'));

        $response->assertInertia(fn (AssertableInertia $page) => $page
            ->where('news.0.image', '/berita/press-release-semifinalis.webp')
            ->where('news.0.date', '22 Juni 2025')
            ->where('news.2.image', '/programs.jpg')
            ->where('news.2.date', '2024')
        );

        $this->assertFileExists(public_path('berita/press-release-semifinalis.webp'));
        $this->assertFileExists(public_path('bagendit.jpg'));
        $this->assertFileExists(public_path('programs.jpg'));
    }

    public function test_public_pages_use_ready_site_asset_bindings_for_the_active_edition(): void
    {
        $edition = Edition::factory()->create(['year' => 2025, 'lifecycle' => 'active']);
        $hero = MediaAsset::factory()->create([
            'url' => 'https://cdn.example.test/pamoka-hero.webp',
            'filename' => 'pamoka-hero.webp',
            'mime_type' => 'image/webp',
            'alt' => 'Hero edisi 2025',
            'lifecycle' => 'ready',
        ]);
        $collage = MediaAsset::factory()->create([
            'url' => 'https://cdn.example.test/pamoka-collage.webp',
            'filename' => 'pamoka-collage.webp',
            'mime_type' => 'image/webp',
            'alt' => 'Kolase program edisi 2025',
            'lifecycle' => 'ready',
        ]);
        $notReady = MediaAsset::factory()->create([
            'url' => 'https://cdn.example.test/not-ready.webp',
            'filename' => 'not-ready.webp',
            'mime_type' => 'image/webp',
            'lifecycle' => 'draft',
        ]);

        SiteAssetBinding::create([
            'edition_id' => $edition->id,
            'slot_key' => 'home.hero.bg',
            'media_id' => $hero->id,
            'alt_override' => 'Latar hero PAMOKA 2025',
        ]);
        SiteAssetBinding::create([
            'edition_id' => $edition->id,
            'slot_key' => 'home.programs.collage.1',
            'media_id' => $collage->id,
        ]);
        SiteAssetBinding::create([
            'edition_id' => $edition->id,
            'slot_key' => 'home.hero.fg',
            'media_id' => $notReady->id,
        ]);

        $this->get(route('home'))
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('hero.image', 'https://cdn.example.test/pamoka-hero.webp')
                ->where('programImages.0', 'https://cdn.example.test/pamoka-collage.webp')
                ->where('assets', static fn (Collection $assets): bool => $assets->get('home.hero.bg')['url'] === 'https://cdn.example.test/pamoka-hero.webp'
                    && $assets->get('home.hero.bg')['alt'] === 'Latar hero PAMOKA 2025'
                    && ! $assets->has('home.hero.fg'))
            );

        $this->get(route('public.about'))
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->has('assets')
                ->where('hero.image', '/hero-about.webp')
            );
    }
}

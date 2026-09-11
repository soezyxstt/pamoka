<?php

namespace Tests\Feature\Http\Controllers;

use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class HomeControllerTest extends TestCase
{
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
}

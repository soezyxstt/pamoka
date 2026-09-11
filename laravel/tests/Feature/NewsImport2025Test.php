<?php

namespace Tests\Feature;

use App\Models\Edition;
use App\Models\MediaAsset;
use App\Models\NewsArticle;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class NewsImport2025Test extends TestCase
{
    use RefreshDatabase;

    public function test_dry_run_validates_the_news_snapshot_without_writing(): void
    {
        $this->artisan('moka:import-news')
            ->assertExitCode(0);

        $this->assertDatabaseCount('editions', 0);
        $this->assertDatabaseCount('news_articles', 0);
        $this->assertDatabaseCount('media_assets', 0);
    }

    public function test_apply_refuses_a_non_local_database_target(): void
    {
        Config::set('database.connections.mysql.host', 'database.example.test');

        $this->artisan('moka:import-news', ['--apply' => true])
            ->assertExitCode(1);

        $this->assertDatabaseCount('editions', 0);
        $this->assertDatabaseCount('news_articles', 0);
    }

    public function test_apply_import_is_idempotent_and_public_home_reads_published_articles(): void
    {
        $this->artisan('moka:import-news', ['--apply' => true])
            ->assertExitCode(0);

        $this->assertDatabaseCount('editions', 1);
        $this->assertDatabaseCount('news_articles', 3);
        $this->assertDatabaseCount('media_assets', 3);
        $this->assertDatabaseHas('news_articles', [
            'slug' => 'press-release-semifinalis',
            'status' => 'published',
            'kind' => 'file',
        ]);

        $article = NewsArticle::query()->where('slug', 'press-release-semifinalis')->firstOrFail();

        $this->assertSame(2025, $article->edition->year);
        $this->assertSame('/berita/press-release-semifinalis.webp', $article->coverMedia->url);
        $this->assertSame('/berita/press-release-semifinalis.pdf', $article->source_url);
        $this->assertTrue(Edition::query()->where('year', 2025)->exists());
        $this->assertTrue(MediaAsset::query()->where('provider_key', '/programs.jpg')->exists());

        $homeResponse = $this->get(route('home'));
        $homeResponse->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Home')
            ->has('news', 3)
            ->where('news.0.href', '/berita/press-release-semifinalis.pdf')
            ->where('news.0.image', '/berita/press-release-semifinalis.webp')
            ->where('news.0.date', '22 Juni 2025')
            ->where('news.1.href', 'https://www.garuters.id/2025/07/pasanggiri-mojang-jajaka-kabupaten-garut-2025.html')
        );

        $this->artisan('moka:import-news', ['--apply' => true])
            ->assertExitCode(0);

        $this->assertDatabaseCount('news_articles', 3);
        $this->assertDatabaseCount('media_assets', 3);
    }
}

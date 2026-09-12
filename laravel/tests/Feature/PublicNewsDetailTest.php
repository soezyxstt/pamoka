<?php

namespace Tests\Feature;

use App\Models\Edition;
use App\Models\MediaAsset;
use App\Models\NewsArticle;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class PublicNewsDetailTest extends TestCase
{
    use RefreshDatabase;

    public function test_snapshot_news_detail_renders_without_database_content(): void
    {
        $response = $this->get(route('public.news.show', ['slug' => 'press-release-semifinalis']));

        $response->assertOk();
        $response->assertHeader('Vary', 'X-Inertia');
        $response->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Public/News/Show')
            ->where('article.slug', 'press-release-semifinalis')
            ->where('article.kind', 'file')
            ->where('article.sourceUrl', '/berita/press-release-semifinalis.pdf')
            ->where('article.image', '/berita/press-release-semifinalis.webp')
            ->where('article.sourceLabel', 'Buka dokumen sumber')
        );
    }

    public function test_published_database_article_is_used_for_detail_and_internal_home_link(): void
    {
        $edition = Edition::factory()->create([
            'year' => 2025,
            'slug' => '2025',
            'lifecycle' => 'active',
        ]);
        $asset = MediaAsset::factory()->create([
            'url' => '/berita/database-cover.webp',
            'alt' => 'Sampul berita dari database',
        ]);
        $bodyJson = [
            'type' => 'doc',
            'content' => [[
                'type' => 'paragraph',
                'content' => [['type' => 'text', 'text' => 'Isi berita dari database.']],
            ]],
        ];

        NewsArticle::factory()->create([
            'edition_id' => $edition->id,
            'title' => 'Berita Internal PAMOKA',
            'slug' => 'berita-internal-pamoka',
            'excerpt' => 'Ringkasan berita internal.',
            'body' => null,
            'body_json' => $bodyJson,
            'kind' => 'internal',
            'source_url' => null,
            'cover_media_id' => $asset->id,
            'published_at' => CarbonImmutable::parse('2025-07-01T09:00:00+07:00'),
            'status' => 'published',
        ]);

        $detailResponse = $this->get(route('public.news.show', ['slug' => 'berita-internal-pamoka']));
        $detailResponse->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Public/News/Show')
            ->where('article.title', 'Berita Internal PAMOKA')
            ->where('article.date', '1 Juli 2025')
            ->where('article.image', '/berita/database-cover.webp')
            ->where('article.bodyJson.type', 'doc')
            ->where('article.sourceUrl', null)
        );

        $homeResponse = $this->get(route('home'));
        $homeResponse->assertInertia(fn (AssertableInertia $page) => $page
            ->where('news.0.href', '/berita/berita-internal-pamoka')
            ->where('news.0.image', '/berita/database-cover.webp')
        );
    }

    public function test_unpublished_or_unknown_news_detail_returns_not_found(): void
    {
        $edition = Edition::factory()->create([
            'year' => 2025,
            'slug' => '2025',
            'lifecycle' => 'active',
        ]);

        NewsArticle::factory()->create([
            'edition_id' => $edition->id,
            'slug' => 'berita-draft',
            'status' => 'draft',
            'published_at' => null,
        ]);

        $this->get(route('public.news.show', ['slug' => 'berita-draft']))->assertNotFound();
        $this->get(route('public.news.show', ['slug' => 'slug-tidak-dikenal']))->assertNotFound();
    }
}

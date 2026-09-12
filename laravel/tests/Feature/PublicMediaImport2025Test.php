<?php

namespace Tests\Feature;

use App\Models\Edition;
use App\Models\Event;
use App\Models\Gallery;
use App\Models\GalleryItem;
use App\Models\MediaAsset;
use App\Models\Sponsor;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class PublicMediaImport2025Test extends TestCase
{
    use RefreshDatabase;

    public function test_dry_run_validates_the_public_media_snapshot_without_writing(): void
    {
        $this->artisan('moka:import-public-media')
            ->assertExitCode(0);

        $this->assertDatabaseCount('editions', 0);
        $this->assertDatabaseCount('events', 0);
        $this->assertDatabaseCount('galleries', 0);
        $this->assertDatabaseCount('gallery_items', 0);
        $this->assertDatabaseCount('sponsors', 0);
        $this->assertDatabaseCount('media_assets', 0);
    }

    public function test_apply_refuses_a_non_local_database_target(): void
    {
        Config::set('database.connections.mysql.host', 'database.example.test');

        $this->artisan('moka:import-public-media', ['--apply' => true])
            ->assertExitCode(1);

        Config::set('database.connections.mysql.host', '127.0.0.1');
        $this->assertDatabaseCount('editions', 0);
        $this->assertDatabaseCount('events', 0);
    }

    public function test_gallery_item_requires_exactly_one_media_source(): void
    {
        $gallery = Gallery::factory()->create();

        $this->expectException(QueryException::class);

        GalleryItem::factory()->create([
            'gallery_id' => $gallery->id,
            'media_asset_id' => null,
            'youtube_id' => null,
        ]);
    }

    public function test_apply_import_is_idempotent_and_public_readers_use_the_imported_data(): void
    {
        Config::set('database.connections.mysql.host', '127.0.0.1');
        Config::set('database.connections.mysql.database', 'pamoka_test');

        $this->artisan('moka:import-public-media', ['--apply' => true])
            ->assertExitCode(0);

        $this->assertDatabaseCount('editions', 1);
        $this->assertDatabaseCount('events', 6);
        $this->assertDatabaseCount('galleries', 7);
        $this->assertDatabaseCount('gallery_items', 69);
        $this->assertDatabaseCount('sponsors', 68);
        $this->assertDatabaseCount('media_assets', 128);

        $edition = Edition::query()->where('year', 2025)->firstOrFail();
        $event = Event::query()->where('slug', 'audisi')->firstOrFail();
        $gallery = Gallery::query()->where('slug', 'audisi')->firstOrFail();

        $this->assertSame($edition->id, $event->edition_id);
        $this->assertSame('/rangkaian-kegiatan/audisi/1.webp', $event->heroMedia->url);
        $this->assertSame($event->id, $gallery->owner_id);
        $this->assertCount(10, $gallery->items);
        $this->assertSame('5w0ORZ0XUkE', GalleryItem::query()->where('gallery_id', Gallery::query()->where('slug', 'tentang-videos')->value('id'))->value('youtube_id'));
        $this->assertSame('/sponsors/Abie Kebaya.png', Sponsor::query()->where('name', 'Abie Kebaya')->firstOrFail()->logoMedia->url);
        $this->assertSame(128, MediaAsset::query()->count());

        $aboutResponse = $this->get(route('public.about'));
        $aboutResponse->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Public/About')
            ->has('videos', 9)
            ->where('videos.0.id', '5w0ORZ0XUkE')
            ->where('videos.8.id', 'S4NanSPqf00')
        );

        $eventResponse = $this->get(route('public.events.show', ['event' => 'audisi']));
        $eventResponse->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Public/Events/Show')
            ->has('event.images', 10)
            ->where('event.images.0', '/rangkaian-kegiatan/audisi/1.webp')
            ->has('sponsors', 68)
            ->where('sponsors.0.image', '/sponsors/Abie Kebaya.png')
        );

        $this->artisan('moka:import-public-media', ['--apply' => true])
            ->assertExitCode(0);

        $this->assertDatabaseCount('events', 6);
        $this->assertDatabaseCount('galleries', 7);
        $this->assertDatabaseCount('gallery_items', 69);
        $this->assertDatabaseCount('sponsors', 68);
        $this->assertDatabaseCount('media_assets', 128);
    }
}

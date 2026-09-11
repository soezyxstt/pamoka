<?php

namespace Tests\Feature;

use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class PublicEventControllerTest extends TestCase
{
    public function test_event_page_renders_the_snapshot_catalog(): void
    {
        $response = $this->get(route('public.events.show', ['event' => 'audisi']));

        $response->assertOk();
        $response->assertHeader('Vary', 'X-Inertia');
        $response->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Public/Events/Show')
            ->where('pageTitle', 'Audisi')
            ->where('meta.title', 'Audisi | Rangkaian Kegiatan | MOKA Garut')
            ->where('event.slug', 'audisi')
            ->where('event.label', 'Audisi')
            ->has('event.images', 10)
            ->where('event.images.0', '/rangkaian-kegiatan/audisi/1.webp')
            ->has('sponsors', 68)
            ->where('sponsors.0.image', '/sponsors/Abie Kebaya.png')
        );
    }

    public function test_event_assets_are_available_in_the_sidecar_public_directory(): void
    {
        $this->assertFileExists(public_path('rangkaian-kegiatan/audisi/1.webp'));
        $this->assertFileExists(public_path('rangkaian-kegiatan/grand-final/10.webp'));
        $this->assertFileExists(public_path('sponsors/Abie Kebaya.png'));
        $this->assertFileExists(public_path('sponsors/nyentrik CLear.png'));
    }

    public function test_unknown_event_returns_not_found(): void
    {
        $response = $this->get(route('public.events.show', ['event' => 'tidak-ada']));

        $response->assertNotFound();
    }
}

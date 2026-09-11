<?php

namespace Tests\Feature;

use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class PublicCoreControllerTest extends TestCase
{
    public function test_about_page_renders_the_public_core_content(): void
    {
        $response = $this->get(route('public.about'));

        $response->assertOk();
        $response->assertHeader('Vary', 'X-Inertia');
        $response->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Public/About')
            ->where('hero.title', 'To Get To Know Us, Come and Meet Us')
            ->where('vision.title', 'Visi Kami')
            ->has('missions', 5)
            ->has('leadership', 16)
            ->has('pastLeaders', 5)
            ->has('videos', 9)
            ->where('legal.documentUrl', '/pdf/SK_MOKA.pdf')
        );
    }

    public function test_public_core_page_assets_are_local_and_have_fallback_copy(): void
    {
        $response = $this->get(route('public.about'));

        $response->assertInertia(fn (AssertableInertia $page) => $page
            ->where('hero.image', '/hero-about.webp')
            ->where('leadership.0.image', '/pengurus/Cecep Safaatul Barkah.png')
            ->where('videos.0.id', '5w0ORZ0XUkE')
            ->where('emptyState', 'Konten sedang disiapkan.')
        );
    }
}

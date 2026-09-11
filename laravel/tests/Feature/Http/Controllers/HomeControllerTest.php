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
            ->where('join.href', 'https://linktr.ee/mokagarut')
        );
    }
}

<?php

namespace Tests\Feature;

use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class PublicRouteContractTest extends TestCase
{
    public function test_remaining_public_routes_render_the_placeholder_contract(): void
    {
        $routes = [
            ['public.voting.index', ['category' => 'mojang-dewasa'], 'voting.index', 'Voting'],
            ['public.voting.show', ['category' => 'mojang-dewasa', 'name' => 'contoh-peserta'], 'voting.show', 'Voting'],
            ['public.voting.results', ['category' => 'mojang-dewasa'], 'voting.results', 'Hasil voting'],
        ];

        foreach ($routes as [$routeName, $parameters, $pageKey, $pageTitle]) {
            $response = $this->get(route($routeName, $parameters));

            $response->assertOk();
            $response->assertHeader('Vary', 'X-Inertia');
            $response->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Public/Placeholder')
                ->where('pageKey', $pageKey)
                ->where('pageTitle', $pageTitle)
                ->where('routePath', parse_url(route($routeName, $parameters), PHP_URL_PATH))
            );
        }
    }

    public function test_unknown_public_route_returns_the_branded_not_found_page(): void
    {
        $response = $this->get('/route-yang-tidak-ada');

        $response->assertNotFound();
        $response->assertSee('Halaman tidak ditemukan');
    }
}

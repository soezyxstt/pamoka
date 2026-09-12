<?php

namespace Tests\Feature;

use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class PublicRouteContractTest extends TestCase
{
    public function test_voting_routes_render_the_read_model_contract(): void
    {
        $indexResponse = $this->get(route('public.voting.index', ['category' => 'mojang-dewasa']));
        $indexResponse->assertOk();
        $indexResponse->assertHeader('Vary', 'X-Inertia');
        $indexResponse->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Public/Voting/Index')
            ->where('category.slug', 'mojang-dewasa')
            ->has('participants', 0)
        );

        $resultsResponse = $this->get(route('public.voting.results', ['category' => 'mojang-dewasa']));
        $resultsResponse->assertOk();
        $resultsResponse->assertHeader('Vary', 'X-Inertia');
        $resultsResponse->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Public/Voting/Results')
            ->where('category.slug', 'mojang-dewasa')
            ->where('hasPublishedResults', false)
        );

        $this->get(route('public.voting.show', [
            'category' => 'mojang-dewasa',
            'name' => 'contoh-peserta',
        ]))->assertNotFound();
    }

    public function test_unknown_public_route_returns_the_branded_not_found_page(): void
    {
        $response = $this->get('/route-yang-tidak-ada');

        $response->assertNotFound();
        $response->assertSee('Halaman tidak ditemukan');
    }
}

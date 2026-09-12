<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LegacyPublicRoutesTest extends TestCase
{
    use RefreshDatabase;

    public function test_legacy_contact_route_has_a_laravel_inertia_replacement(): void
    {
        $this->get(route('legacy.contact'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Public/Legacy/Contact')
                ->has('faqs', 4)
            );
    }

    public function test_legacy_pasanggiri_route_reads_the_rehearsed_public_models(): void
    {
        $this->artisan('moka:rehearse-2025', ['--apply' => true])
            ->assertSuccessful();

        $this->get(route('legacy.pasanggiri'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Public/Legacy/Pasanggiri')
                ->has('finalists', 44)
                ->has('sponsors', 68)
            );
    }

    public function test_legacy_voting_spotlight_route_remains_available_for_unknown_slugs(): void
    {
        $this->get(route('legacy.voting.show', ['name' => 'nama-lama']))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Public/Legacy/Voting')
                ->where('spotlight.name', 'Nama Lama')
            );
    }
}

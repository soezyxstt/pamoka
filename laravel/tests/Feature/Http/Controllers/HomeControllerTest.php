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
            ->where('migrationStage', 'Shell publik')
            ->where('legacyApp', 'Next.js')
            ->where('targetApp', 'Laravel + Inertia React')
        );
    }
}

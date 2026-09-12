<?php

namespace Tests\Feature;

use App\Models\OrganizationAssignment;
use App\Models\Person;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class PublicOrganizationTest extends TestCase
{
    use RefreshDatabase;

    public function test_dry_run_validates_the_organization_snapshot_without_writing(): void
    {
        $this->artisan('moka:import-public-organization')
            ->assertExitCode(0);

        $this->assertDatabaseCount('people', 0);
        $this->assertDatabaseCount('organization_assignments', 0);
        $this->assertDatabaseCount('media_assets', 0);
    }

    public function test_apply_refuses_a_non_local_database_target(): void
    {
        Config::set('database.connections.mysql.host', 'database.example.test');

        $this->artisan('moka:import-public-organization', ['--apply' => true])
            ->assertExitCode(1);

        $this->assertDatabaseCount('people', 0);
        $this->assertDatabaseCount('organization_assignments', 0);
    }

    public function test_apply_import_is_idempotent_and_about_reads_the_public_organization(): void
    {
        $this->artisan('moka:import-public-organization', ['--apply' => true])
            ->assertExitCode(0);

        $this->assertDatabaseCount('people', 19);
        $this->assertDatabaseCount('organization_assignments', 21);
        $this->assertDatabaseCount('media_assets', 19);
        $this->assertDatabaseHas('people', [
            'slug' => 'cecep-safaatul-barkah',
            'gender' => 'L',
        ]);
        $this->assertDatabaseHas('organization_assignments', [
            'group' => 'leadership',
            'title' => 'Ketua Umum',
            'display_order' => 4,
        ]);

        $aboutResponse = $this->get(route('public.about'));
        $aboutResponse->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Public/About')
            ->where('leadership.0.name', 'Cecep Safaatul Barkah')
            ->where('leadership.0.gender', 'L')
            ->where('leadership.13.position', 'Bidang Kreatif & Media Sosial')
            ->where('pastLeaders.2.name', 'Yesi Haerunisa')
            ->where('pastLeaders.2.gender', 'P')
        );

        $this->artisan('moka:import-public-organization', ['--apply' => true])
            ->assertExitCode(0);

        $this->assertDatabaseCount('people', 19);
        $this->assertDatabaseCount('organization_assignments', 21);
        $this->assertDatabaseCount('media_assets', 19);
        $this->assertSame(21, OrganizationAssignment::query()->count());
        $this->assertSame(19, Person::query()->count());
    }
}

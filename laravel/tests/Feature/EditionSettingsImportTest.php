<?php

namespace Tests\Feature;

use App\Models\Edition;
use App\Models\EditionProgram;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EditionSettingsImportTest extends TestCase
{
    use RefreshDatabase;

    public function test_edition_settings_import_dry_run_does_not_write(): void
    {
        $this->artisan('moka:import-edition-settings')
            ->assertSuccessful()
            ->expectsOutputToContain('Dry run selesai. Tidak ada perubahan database.');

        $this->assertDatabaseCount('editions', 0);
        $this->assertDatabaseCount('edition_programs', 0);
    }

    public function test_edition_settings_import_is_idempotent(): void
    {
        $this->artisan('moka:import-edition-settings', ['--apply' => true])
            ->assertSuccessful()
            ->expectsOutputToContain('Import identitas edisi publik berhasil diterapkan.');

        $this->assertDatabaseCount('editions', 1);
        $this->assertDatabaseCount('edition_programs', 6);
        $this->assertDatabaseHas('editions', [
            'year' => 2025,
            'slogan' => 'Nu Nyunda Tur Nyakola',
        ]);

        $this->artisan('moka:import-edition-settings', ['--apply' => true])
            ->assertSuccessful();

        $this->assertDatabaseCount('editions', 1);
        $this->assertDatabaseCount('edition_programs', 6);
        $this->assertSame(6, EditionProgram::query()->whereBelongsTo(Edition::query()->where('year', 2025)->firstOrFail())->count());
    }
}

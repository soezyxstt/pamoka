<?php

namespace Tests\Feature;

use App\Models\PageSection;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PageSectionImportTest extends TestCase
{
    use RefreshDatabase;

    public function test_page_section_import_dry_run_does_not_write(): void
    {
        $this->artisan('moka:import-page-sections')
            ->assertSuccessful()
            ->expectsOutputToContain('Dry run selesai. Tidak ada perubahan database.');

        $this->assertDatabaseCount('page_sections', 0);
    }

    public function test_page_section_import_is_idempotent(): void
    {
        $this->artisan('moka:import-page-sections', ['--apply' => true])
            ->assertSuccessful()
            ->expectsOutputToContain('Import section halaman publik berhasil diterapkan.');

        $this->assertDatabaseCount('page_sections', 1);
        $this->assertDatabaseHas('page_sections', [
            'page_key' => 'tentang',
            'section_key' => 'misi',
            'status' => 'published',
        ]);

        $this->artisan('moka:import-page-sections', ['--apply' => true])
            ->assertSuccessful();

        $this->assertDatabaseCount('page_sections', 1);
        $this->assertSame('Misi', PageSection::query()->value('title'));
    }
}

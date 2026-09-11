<?php

namespace Tests\Feature;

use App\Enums\CategoryCode;
use App\Models\Category;
use App\Models\Edition;
use App\Models\OrganizationPeriod;
use App\Models\Participant;
use App\Models\SelectionStage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CoreDomainFoundationTest extends TestCase
{
    use RefreshDatabase;

    public function test_an_edition_owns_categories_stages_and_participants(): void
    {
        $period = OrganizationPeriod::factory()->create([
            'label' => 'Kepengurusan 2026 sampai 2028',
            'start_year' => 2026,
            'end_year' => 2028,
            'lifecycle' => 'active',
        ]);
        $edition = Edition::factory()->for($period, 'organizationPeriod')->create([
            'year' => 2026,
            'slug' => 'pasanggiri-2026',
            'name' => 'Pasanggiri Mojang Jajaka 2026',
            'lifecycle' => 'active',
        ]);
        $category = Category::factory()->for($edition)->create([
            'code' => 'JD',
            'slug' => 'mojang-dewasa',
            'label' => 'Mojang Dewasa',
        ]);
        $stage = SelectionStage::factory()->for($edition)->create([
            'name' => 'Final',
            'slug' => 'final',
            'lifecycle' => 'active',
            'final_stage' => true,
        ]);
        $participant = Participant::factory()
            ->for($edition)
            ->for($category)
            ->for($stage, 'currentStage')
            ->create([
                'stage' => 'final',
                'selection_status' => 'completed',
                'number' => 1,
                'name' => 'Contoh Peserta',
                'slug' => 'contoh-peserta',
            ]);

        $this->assertTrue($edition->organizationPeriod->is($period));
        $this->assertTrue($edition->categories->contains($category));
        $this->assertTrue($edition->selectionStages->contains($stage));
        $this->assertTrue($edition->participants->contains($participant));
        $this->assertTrue($participant->category->is($category));
        $this->assertTrue($participant->currentStage->is($stage));
    }

    public function test_category_codes_remain_the_fixed_pamoka_codes(): void
    {
        $edition = Edition::factory()->create();
        $category = Category::factory()->for($edition)->create([
            'code' => CategoryCode::JD,
        ]);

        $this->assertSame(CategoryCode::JD, $category->code);
        $this->assertSame(['JD', 'MD', 'JR', 'MR'], array_column(CategoryCode::cases(), 'value'));
    }
}

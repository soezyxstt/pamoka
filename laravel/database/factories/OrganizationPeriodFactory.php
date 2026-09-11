<?php

namespace Database\Factories;

use App\Models\OrganizationPeriod;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<OrganizationPeriod>
 */
class OrganizationPeriodFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'label' => 'Kepengurusan '.fake()->unique()->numberBetween(2026, 2099).' sampai 2028',
            'start_year' => 2026,
            'end_year' => 2028,
            'vision' => fake()->sentence(),
            'mission_json' => [fake()->sentence()],
            'lifecycle' => 'draft',
            'version' => 1,
        ];
    }
}

<?php

namespace Database\Factories;

use App\Models\OrganizationAssignment;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<OrganizationAssignment>
 */
class OrganizationAssignmentFactory extends Factory
{
    public function definition(): array
    {
        return [
            'edition_id' => null,
            'person_id' => null,
            'title' => fake()->jobTitle(),
            'group' => 'leadership',
            'term_label' => null,
            'display_order' => 0,
            'active' => true,
        ];
    }
}

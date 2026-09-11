<?php

namespace Database\Factories;

use App\Models\SelectionStage;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<SelectionStage>
 */
class SelectionStageFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => 'Audisi',
            'slug' => 'audisi',
            'display_order' => 0,
            'target_participant_count' => 0,
            'lifecycle' => 'draft',
            'final_stage' => false,
            'version' => 1,
        ];
    }
}

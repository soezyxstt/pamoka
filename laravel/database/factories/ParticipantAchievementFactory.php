<?php

namespace Database\Factories;

use App\Models\ParticipantAchievement;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ParticipantAchievement>
 */
class ParticipantAchievementFactory extends Factory
{
    public function definition(): array
    {
        return [
            'participant_id' => null,
            'text' => fake()->sentence(),
            'display_order' => 0,
        ];
    }
}

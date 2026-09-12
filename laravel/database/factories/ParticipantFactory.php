<?php

namespace Database\Factories;

use App\Models\Participant;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Participant>
 */
class ParticipantFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $name = fake()->unique()->name();

        return [
            'edition_id' => null,
            'category_id' => null,
            'stage' => 'registered',
            'current_stage_id' => null,
            'selection_status' => 'registered',
            'number' => fake()->unique()->numberBetween(1, 999),
            'name' => $name,
            'slug' => Str::slug($name),
            'bio' => fake()->sentence(),
            'payment_url' => null,
            'qris_media_id' => null,
            'display_order' => 0,
            'active' => true,
            'version' => 1,
        ];
    }
}

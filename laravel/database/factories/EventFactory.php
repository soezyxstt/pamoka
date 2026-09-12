<?php

namespace Database\Factories;

use App\Models\Edition;
use App\Models\Event;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<Event> */
class EventFactory extends Factory
{
    public function definition(): array
    {
        $label = fake()->unique()->words(2, true);

        return [
            'edition_id' => Edition::factory(),
            'slug' => Str::slug($label),
            'label' => $label,
            'description' => fake()->sentence(),
            'hero_media_id' => null,
            'display_order' => 0,
            'active' => true,
            'version' => 1,
        ];
    }
}

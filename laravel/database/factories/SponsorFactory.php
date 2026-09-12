<?php

namespace Database\Factories;

use App\Models\Edition;
use App\Models\Sponsor;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Sponsor> */
class SponsorFactory extends Factory
{
    public function definition(): array
    {
        return [
            'edition_id' => Edition::factory(),
            'name' => fake()->unique()->company(),
            'tier' => 'pelengkap',
            'website' => null,
            'logo_media_id' => null,
            'display_order' => 0,
            'active' => true,
            'version' => 1,
        ];
    }
}

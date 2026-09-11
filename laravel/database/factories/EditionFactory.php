<?php

namespace Database\Factories;

use App\Models\Edition;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Edition>
 */
class EditionFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $year = fake()->unique()->numberBetween(2026, 2099);

        return [
            'year' => $year,
            'slug' => 'pasanggiri-'.$year,
            'name' => 'Pasanggiri Mojang Jajaka '.$year,
            'timezone' => 'Asia/Jakarta',
            'lifecycle' => 'draft',
            'starts_at' => null,
            'ends_at' => null,
            'organization_period_id' => null,
            'slogan' => 'Nu Nyunda Tur Nyakola',
            'version' => 1,
        ];
    }
}

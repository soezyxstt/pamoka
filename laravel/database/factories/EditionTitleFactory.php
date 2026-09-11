<?php

namespace Database\Factories;

use App\Models\EditionTitle;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<EditionTitle>
 */
class EditionTitleFactory extends Factory
{
    public function definition(): array
    {
        return [
            'edition_id' => null,
            'name' => 'Mojang Pinilih',
            'description' => 'Gelar utama edisi.',
            'capacity' => 1,
            'display_order' => 0,
            'active' => true,
            'version' => 1,
        ];
    }
}

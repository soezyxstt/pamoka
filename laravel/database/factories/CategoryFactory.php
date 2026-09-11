<?php

namespace Database\Factories;

use App\Enums\CategoryCode;
use App\Models\Category;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Category>
 */
class CategoryFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'code' => CategoryCode::JD,
            'slug' => 'mojang-dewasa',
            'label' => 'Mojang Dewasa',
            'display_order' => 0,
            'active' => true,
        ];
    }
}

<?php

namespace Database\Factories;

use App\Models\Gallery;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<Gallery> */
class GalleryFactory extends Factory
{
    public function definition(): array
    {
        $title = fake()->unique()->words(3, true);

        return [
            'edition_id' => null,
            'slug' => Str::slug($title),
            'title' => $title,
            'description' => fake()->sentence(),
            'cover_media_id' => null,
            'owner_type' => 'standalone',
            'owner_id' => 'about',
            'display_order' => 0,
            'status' => 'published',
            'active' => true,
            'version' => 1,
        ];
    }
}

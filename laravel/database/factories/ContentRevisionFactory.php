<?php

namespace Database\Factories;

use App\Models\ContentRevision;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ContentRevision>
 */
class ContentRevisionFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'resource_type' => 'newsArticle',
            'resource_id' => fake()->uuid(),
            'version' => 1,
            'snapshot_json' => [
                'title' => fake()->sentence(5),
                'status' => 'draft',
                'version' => 1,
            ],
            'author_user_id' => User::factory(),
            'reason' => 'Dibuat pertama kali',
            'created_at' => now(),
        ];
    }
}

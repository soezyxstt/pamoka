<?php

namespace Database\Factories;

use App\Models\NewsArticle;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<NewsArticle>
 */
class NewsArticleFactory extends Factory
{
    public function definition(): array
    {
        $title = fake()->sentence(6);

        return [
            'edition_id' => null,
            'title' => $title,
            'slug' => fake()->unique()->slug(),
            'excerpt' => fake()->paragraph(),
            'body' => fake()->paragraphs(3, true),
            'body_json' => null,
            'kind' => 'internal',
            'source_url' => null,
            'cover_media_id' => null,
            'published_at' => null,
            'status' => 'draft',
            'version' => 1,
        ];
    }
}

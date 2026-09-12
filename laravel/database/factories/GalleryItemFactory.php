<?php

namespace Database\Factories;

use App\Models\Gallery;
use App\Models\GalleryItem;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<GalleryItem> */
class GalleryItemFactory extends Factory
{
    public function definition(): array
    {
        return [
            'gallery_id' => Gallery::factory(),
            'media_asset_id' => null,
            'youtube_id' => '5w0ORZ0XUkE',
            'caption' => 'Video kegiatan PAMOKA',
            'display_order' => 0,
            'active' => true,
        ];
    }
}

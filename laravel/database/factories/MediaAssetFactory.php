<?php

namespace Database\Factories;

use App\Models\MediaAsset;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<MediaAsset>
 */
class MediaAssetFactory extends Factory
{
    public function definition(): array
    {
        return [
            'provider' => 'local',
            'provider_key' => Str::uuid()->toString(),
            'url' => '/finalis/hero.webp',
            'filename' => 'hero.webp',
            'mime_type' => 'image/webp',
            'bytes' => 227778,
            'alt' => 'Dokumentasi PAMOKA Garut',
            'decorative' => false,
            'lifecycle' => 'ready',
            'owner_user_id' => null,
        ];
    }
}

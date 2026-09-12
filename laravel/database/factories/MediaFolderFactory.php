<?php

namespace Database\Factories;

use App\Models\MediaFolder;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<MediaFolder>
 */
class MediaFolderFactory extends Factory
{
    public function definition(): array
    {
        $suffix = Str::lower(Str::substr(Str::uuid()->toString(), 0, 8));

        return [
            'parent_id' => null,
            'edition_id' => null,
            'name' => 'Folder '.$suffix,
            'slug' => 'folder-'.$suffix,
            'owner_user_id' => null,
        ];
    }
}

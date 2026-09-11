<?php

namespace Database\Factories;

use App\Enums\ParticipantMediaRole;
use App\Models\ParticipantMedia;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ParticipantMedia>
 */
class ParticipantMediaFactory extends Factory
{
    public function definition(): array
    {
        return [
            'participant_id' => null,
            'role' => ParticipantMediaRole::Closeup,
            'media_asset_id' => null,
            'caption' => null,
            'display_order' => 0,
            'active' => true,
        ];
    }
}

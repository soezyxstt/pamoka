<?php

namespace Database\Factories;

use App\Enums\SocialPlatform;
use App\Models\ParticipantSocialLink;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ParticipantSocialLink>
 */
class ParticipantSocialLinkFactory extends Factory
{
    public function definition(): array
    {
        return [
            'participant_id' => null,
            'platform' => SocialPlatform::Instagram,
            'label' => '@mokagarut',
            'url' => 'https://instagram.com/mokagarut',
            'display_order' => 0,
        ];
    }
}

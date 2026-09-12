<?php

namespace Database\Factories;

use App\Models\VotingCampaign;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<VotingCampaign>
 */
class VotingCampaignFactory extends Factory
{
    public function definition(): array
    {
        $startsAt = now()->addDay();

        return [
            'edition_id' => null,
            'eligibility_stage_id' => null,
            'name' => 'Voting Kameumeut '.now()->year,
            'slug' => fake()->unique()->slug(),
            'timezone' => 'Asia/Jakarta',
            'starts_at' => $startsAt,
            'ends_at' => $startsAt->copy()->addDays(7),
            'started_at' => null,
            'closed_at' => null,
            'status' => 'draft',
            'price_per_point' => 2000,
            'result_visibility' => 'hidden',
            'version' => 1,
        ];
    }
}

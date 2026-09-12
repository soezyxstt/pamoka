<?php

namespace Database\Factories;

use App\Models\VoteDailyTally;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<VoteDailyTally>
 */
class VoteDailyTallyFactory extends Factory
{
    public function definition(): array
    {
        return [
            'campaign_id' => null,
            'participant_id' => null,
            'local_date' => now()->toDateString(),
            'amount' => 0,
            'version' => 1,
        ];
    }
}

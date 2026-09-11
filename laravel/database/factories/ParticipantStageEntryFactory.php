<?php

namespace Database\Factories;

use App\Enums\StageDecision;
use App\Models\ParticipantStageEntry;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ParticipantStageEntry>
 */
class ParticipantStageEntryFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'participant_id' => null,
            'stage_id' => null,
            'decision' => StageDecision::Pending,
            'decided_at' => null,
            'decided_by_user_id' => null,
            'reason' => null,
            'version' => 1,
        ];
    }
}

<?php

namespace App\Models;

use Database\Factories\ParticipantAchievementFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['participant_id', 'text', 'display_order'])]
class ParticipantAchievement extends Model
{
    /** @use HasFactory<ParticipantAchievementFactory> */
    use HasFactory, HasUuids;

    public function participant(): BelongsTo
    {
        return $this->belongsTo(Participant::class);
    }

    protected function casts(): array
    {
        return [
            'display_order' => 'integer',
        ];
    }
}

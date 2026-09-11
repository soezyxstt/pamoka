<?php

namespace App\Models;

use App\Enums\StageDecision;
use Database\Factories\ParticipantStageEntryFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['participant_id', 'stage_id', 'decision', 'decided_at', 'decided_by_user_id', 'reason', 'version'])]
class ParticipantStageEntry extends Model
{
    /** @use HasFactory<ParticipantStageEntryFactory> */
    use HasFactory, HasUuids;

    public function participant(): BelongsTo
    {
        return $this->belongsTo(Participant::class);
    }

    public function stage(): BelongsTo
    {
        return $this->belongsTo(SelectionStage::class);
    }

    public function decidedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'decided_by_user_id');
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'decision' => StageDecision::class,
            'decided_at' => 'datetime',
            'version' => 'integer',
        ];
    }
}

<?php

namespace App\Models;

use Database\Factories\SelectionStageFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['edition_id', 'name', 'slug', 'display_order', 'target_participant_count', 'lifecycle', 'final_stage', 'version'])]
class SelectionStage extends Model
{
    /** @use HasFactory<SelectionStageFactory> */
    use HasFactory, HasUuids;

    public function edition(): BelongsTo
    {
        return $this->belongsTo(Edition::class);
    }

    public function participants(): HasMany
    {
        return $this->hasMany(Participant::class, 'current_stage_id');
    }

    public function stageEntries(): HasMany
    {
        return $this->hasMany(ParticipantStageEntry::class, 'stage_id');
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'display_order' => 'integer',
            'target_participant_count' => 'integer',
            'final_stage' => 'boolean',
            'version' => 'integer',
        ];
    }
}

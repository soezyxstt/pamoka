<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['campaign_id', 'participant_id', 'source_stage_id', 'added_at'])]
class VotingCampaignParticipant extends Model
{
    public $timestamps = false;

    public $incrementing = false;

    protected $primaryKey = null;

    protected $keyType = 'string';

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(VotingCampaign::class, 'campaign_id');
    }

    public function participant(): BelongsTo
    {
        return $this->belongsTo(Participant::class);
    }

    public function sourceStage(): BelongsTo
    {
        return $this->belongsTo(SelectionStage::class, 'source_stage_id');
    }

    protected function casts(): array
    {
        return [
            'added_at' => 'datetime',
        ];
    }
}

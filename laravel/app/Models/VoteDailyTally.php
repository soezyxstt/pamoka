<?php

namespace App\Models;

use Database\Factories\VoteDailyTallyFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['campaign_id', 'participant_id', 'local_date', 'amount', 'version'])]
class VoteDailyTally extends Model
{
    /** @use HasFactory<VoteDailyTallyFactory> */
    use HasFactory, HasUuids;

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(VotingCampaign::class, 'campaign_id');
    }

    public function participant(): BelongsTo
    {
        return $this->belongsTo(Participant::class);
    }

    protected function casts(): array
    {
        return [
            'amount' => 'integer',
            'version' => 'integer',
        ];
    }
}

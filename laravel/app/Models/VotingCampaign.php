<?php

namespace App\Models;

use Database\Factories\VotingCampaignFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['edition_id', 'eligibility_stage_id', 'name', 'slug', 'timezone', 'starts_at', 'ends_at', 'started_at', 'closed_at', 'status', 'price_per_point', 'result_visibility', 'version'])]
class VotingCampaign extends Model
{
    /** @use HasFactory<VotingCampaignFactory> */
    use HasFactory, HasUuids;

    public function edition(): BelongsTo
    {
        return $this->belongsTo(Edition::class);
    }

    public function eligibilityStage(): BelongsTo
    {
        return $this->belongsTo(SelectionStage::class, 'eligibility_stage_id');
    }

    public function campaignParticipants(): HasMany
    {
        return $this->hasMany(VotingCampaignParticipant::class, 'campaign_id');
    }

    public function participants(): BelongsToMany
    {
        return $this->belongsToMany(Participant::class, 'voting_campaign_participants', 'campaign_id', 'participant_id')
            ->withPivot(['source_stage_id', 'added_at']);
    }

    public function tallies(): HasMany
    {
        return $this->hasMany(VoteDailyTally::class, 'campaign_id');
    }

    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'started_at' => 'datetime',
            'closed_at' => 'datetime',
            'price_per_point' => 'integer',
            'version' => 'integer',
        ];
    }
}

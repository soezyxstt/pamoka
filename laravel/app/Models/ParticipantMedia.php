<?php

namespace App\Models;

use App\Enums\ParticipantMediaRole;
use Database\Factories\ParticipantMediaFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['participant_id', 'role', 'media_asset_id', 'caption', 'display_order', 'active'])]
class ParticipantMedia extends Model
{
    /** @use HasFactory<ParticipantMediaFactory> */
    use HasFactory, HasUuids;

    public function participant(): BelongsTo
    {
        return $this->belongsTo(Participant::class);
    }

    public function mediaAsset(): BelongsTo
    {
        return $this->belongsTo(MediaAsset::class);
    }

    protected function casts(): array
    {
        return [
            'role' => ParticipantMediaRole::class,
            'display_order' => 'integer',
            'active' => 'boolean',
        ];
    }
}

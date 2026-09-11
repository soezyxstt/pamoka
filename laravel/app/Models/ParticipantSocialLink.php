<?php

namespace App\Models;

use App\Enums\SocialPlatform;
use Database\Factories\ParticipantSocialLinkFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['participant_id', 'platform', 'label', 'url', 'display_order'])]
class ParticipantSocialLink extends Model
{
    /** @use HasFactory<ParticipantSocialLinkFactory> */
    use HasFactory, HasUuids;

    public function participant(): BelongsTo
    {
        return $this->belongsTo(Participant::class);
    }

    protected function casts(): array
    {
        return [
            'platform' => SocialPlatform::class,
            'display_order' => 'integer',
        ];
    }
}

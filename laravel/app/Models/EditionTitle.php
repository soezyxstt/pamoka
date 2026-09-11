<?php

namespace App\Models;

use Database\Factories\EditionTitleFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

#[Fillable(['edition_id', 'name', 'description', 'capacity', 'display_order', 'active', 'version'])]
class EditionTitle extends Model
{
    /** @use HasFactory<EditionTitleFactory> */
    use HasFactory, HasUuids;

    public function edition(): BelongsTo
    {
        return $this->belongsTo(Edition::class);
    }

    public function participants(): BelongsToMany
    {
        return $this->belongsToMany(Participant::class, 'participant_title_assignments')
            ->withPivot(['assigned_at', 'assigned_by_user_id'])
            ->orderBy('participants.display_order')
            ->orderBy('participants.id');
    }

    protected function casts(): array
    {
        return [
            'capacity' => 'integer',
            'display_order' => 'integer',
            'active' => 'boolean',
            'version' => 'integer',
        ];
    }
}

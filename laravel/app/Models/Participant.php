<?php

namespace App\Models;

use Database\Factories\ParticipantFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['edition_id', 'category_id', 'stage', 'current_stage_id', 'selection_status', 'number', 'name', 'slug', 'bio', 'payment_url', 'display_order', 'active', 'version'])]
class Participant extends Model
{
    /** @use HasFactory<ParticipantFactory> */
    use HasFactory, HasUuids;

    public function edition(): BelongsTo
    {
        return $this->belongsTo(Edition::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function currentStage(): BelongsTo
    {
        return $this->belongsTo(SelectionStage::class, 'current_stage_id');
    }

    public function achievements(): HasMany
    {
        return $this->hasMany(ParticipantAchievement::class)->orderBy('display_order')->orderBy('id');
    }

    public function socialLinks(): HasMany
    {
        return $this->hasMany(ParticipantSocialLink::class)->orderBy('display_order')->orderBy('id');
    }

    public function media(): HasMany
    {
        return $this->hasMany(ParticipantMedia::class)->orderBy('display_order')->orderBy('id');
    }

    public function stageEntries(): HasMany
    {
        return $this->hasMany(ParticipantStageEntry::class);
    }

    public function titles(): BelongsToMany
    {
        return $this->belongsToMany(EditionTitle::class, 'participant_title_assignments')
            ->withPivot(['assigned_at', 'assigned_by_user_id'])
            ->orderBy('edition_titles.display_order')
            ->orderBy('edition_titles.id');
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'number' => 'integer',
            'display_order' => 'integer',
            'active' => 'boolean',
            'version' => 'integer',
        ];
    }
}

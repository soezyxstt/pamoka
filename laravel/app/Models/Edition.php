<?php

namespace App\Models;

use Database\Factories\EditionFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['year', 'slug', 'name', 'timezone', 'lifecycle', 'starts_at', 'ends_at', 'organization_period_id', 'slogan', 'version'])]
class Edition extends Model
{
    /** @use HasFactory<EditionFactory> */
    use HasFactory, HasUuids;

    public function organizationPeriod(): BelongsTo
    {
        return $this->belongsTo(OrganizationPeriod::class);
    }

    public function categories(): HasMany
    {
        return $this->hasMany(Category::class);
    }

    public function selectionStages(): HasMany
    {
        return $this->hasMany(SelectionStage::class);
    }

    public function participants(): HasMany
    {
        return $this->hasMany(Participant::class);
    }

    public function titles(): HasMany
    {
        return $this->hasMany(EditionTitle::class);
    }

    public function newsArticles(): HasMany
    {
        return $this->hasMany(NewsArticle::class);
    }

    public function events(): HasMany
    {
        return $this->hasMany(Event::class);
    }

    public function galleries(): HasMany
    {
        return $this->hasMany(Gallery::class);
    }

    public function sponsors(): HasMany
    {
        return $this->hasMany(Sponsor::class);
    }

    public function organizationAssignments(): HasMany
    {
        return $this->hasMany(OrganizationAssignment::class);
    }

    public function votingCampaigns(): HasMany
    {
        return $this->hasMany(VotingCampaign::class);
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'version' => 'integer',
        ];
    }
}

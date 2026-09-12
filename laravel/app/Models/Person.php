<?php

namespace App\Models;

use Database\Factories\PersonFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['name', 'slug', 'gender', 'short_bio', 'portrait_media_id', 'version'])]
class Person extends Model
{
    /** @use HasFactory<PersonFactory> */
    use HasFactory, HasUuids;

    public function portraitMedia(): BelongsTo
    {
        return $this->belongsTo(MediaAsset::class, 'portrait_media_id');
    }

    public function organizationAssignments(): HasMany
    {
        return $this->hasMany(OrganizationAssignment::class);
    }

    public function organizationMemberships(): HasMany
    {
        return $this->hasMany(OrganizationMembership::class);
    }

    public function socialLinks(): HasMany
    {
        return $this->hasMany(PersonSocialLink::class)->orderBy('display_order')->orderBy('id');
    }

    protected function casts(): array
    {
        return [
            'version' => 'integer',
        ];
    }
}

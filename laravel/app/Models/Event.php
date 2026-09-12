<?php

namespace App\Models;

use Database\Factories\EventFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['edition_id', 'slug', 'label', 'description', 'hero_media_id', 'display_order', 'active', 'version'])]
class Event extends Model
{
    /** @use HasFactory<EventFactory> */
    use HasFactory, HasUuids;

    public function edition(): BelongsTo
    {
        return $this->belongsTo(Edition::class);
    }

    public function heroMedia(): BelongsTo
    {
        return $this->belongsTo(MediaAsset::class, 'hero_media_id');
    }

    public function galleries(): HasMany
    {
        return $this->hasMany(Gallery::class, 'owner_id')
            ->where('owner_type', 'event')
            ->orderBy('display_order')
            ->orderBy('id');
    }

    protected function casts(): array
    {
        return [
            'display_order' => 'integer',
            'active' => 'boolean',
            'version' => 'integer',
        ];
    }
}

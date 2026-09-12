<?php

namespace App\Models;

use Database\Factories\GalleryFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['edition_id', 'slug', 'title', 'description', 'cover_media_id', 'owner_type', 'owner_id', 'display_order', 'status', 'active', 'version'])]
class Gallery extends Model
{
    /** @use HasFactory<GalleryFactory> */
    use HasFactory, HasUuids;

    public function edition(): BelongsTo
    {
        return $this->belongsTo(Edition::class);
    }

    public function coverMedia(): BelongsTo
    {
        return $this->belongsTo(MediaAsset::class, 'cover_media_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(GalleryItem::class)->orderBy('display_order')->orderBy('id');
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

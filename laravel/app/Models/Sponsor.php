<?php

namespace App\Models;

use Database\Factories\SponsorFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['edition_id', 'name', 'tier', 'website', 'logo_media_id', 'display_order', 'active', 'version'])]
class Sponsor extends Model
{
    /** @use HasFactory<SponsorFactory> */
    use HasFactory, HasUuids;

    public function edition(): BelongsTo
    {
        return $this->belongsTo(Edition::class);
    }

    public function logoMedia(): BelongsTo
    {
        return $this->belongsTo(MediaAsset::class, 'logo_media_id');
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

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['edition_id', 'slot_key', 'media_id', 'alt_override', 'focal_x', 'focal_y', 'version'])]
class SiteAssetBinding extends Model
{
    use HasUuids;

    public function edition(): BelongsTo
    {
        return $this->belongsTo(Edition::class);
    }

    public function media(): BelongsTo
    {
        return $this->belongsTo(MediaAsset::class, 'media_id');
    }

    protected function casts(): array
    {
        return [
            'focal_x' => 'integer',
            'focal_y' => 'integer',
            'version' => 'integer',
        ];
    }
}

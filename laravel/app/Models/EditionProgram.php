<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['edition_id', 'title', 'description', 'display_order', 'active'])]
class EditionProgram extends Model
{
    use HasUuids;

    public function edition(): BelongsTo
    {
        return $this->belongsTo(Edition::class);
    }

    protected function casts(): array
    {
        return [
            'display_order' => 'integer',
            'active' => 'boolean',
        ];
    }
}

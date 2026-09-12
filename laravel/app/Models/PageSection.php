<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['edition_id', 'page_key', 'section_key', 'title', 'eyebrow', 'body', 'presentation_json', 'status', 'version'])]
class PageSection extends Model
{
    use HasUuids;

    public function edition(): BelongsTo
    {
        return $this->belongsTo(Edition::class);
    }

    protected function casts(): array
    {
        return [
            'presentation_json' => 'array',
            'version' => 'integer',
        ];
    }
}

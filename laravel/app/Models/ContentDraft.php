<?php

namespace App\Models;

use Database\Factories\ContentDraftFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['resource_type', 'resource_id', 'base_version', 'snapshot_json', 'author_user_id'])]
class ContentDraft extends Model
{
    /** @use HasFactory<ContentDraftFactory> */
    use HasFactory, HasUuids;

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_user_id');
    }

    protected function casts(): array
    {
        return [
            'base_version' => 'integer',
            'snapshot_json' => 'array',
        ];
    }
}

<?php

namespace App\Models;

use Database\Factories\ContentRevisionFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['resource_type', 'resource_id', 'version', 'snapshot_json', 'author_user_id', 'reason', 'created_at'])]
class ContentRevision extends Model
{
    /** @use HasFactory<ContentRevisionFactory> */
    use HasFactory, HasUuids;

    public $timestamps = false;

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_user_id');
    }

    protected function casts(): array
    {
        return [
            'version' => 'integer',
            'snapshot_json' => 'array',
            'created_at' => 'datetime',
        ];
    }
}

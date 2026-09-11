<?php

namespace App\Models;

use Database\Factories\NewsArticleFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['edition_id', 'title', 'slug', 'excerpt', 'body', 'body_json', 'kind', 'source_url', 'cover_media_id', 'published_at', 'status', 'version'])]
class NewsArticle extends Model
{
    /** @use HasFactory<NewsArticleFactory> */
    use HasFactory, HasUuids;

    public function edition(): BelongsTo
    {
        return $this->belongsTo(Edition::class);
    }

    public function coverMedia(): BelongsTo
    {
        return $this->belongsTo(MediaAsset::class, 'cover_media_id');
    }

    protected function casts(): array
    {
        return [
            'body_json' => 'array',
            'published_at' => 'datetime',
            'version' => 'integer',
        ];
    }
}

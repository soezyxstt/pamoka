<?php

namespace App\Models;

use Database\Factories\MediaAssetFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['provider', 'provider_key', 'url', 'filename', 'mime_type', 'bytes', 'alt', 'decorative', 'lifecycle', 'owner_user_id'])]
class MediaAsset extends Model
{
    /** @use HasFactory<MediaAssetFactory> */
    use HasFactory, HasUuids;

    public function participantMedia(): HasMany
    {
        return $this->hasMany(ParticipantMedia::class);
    }

    public function newsArticles(): HasMany
    {
        return $this->hasMany(NewsArticle::class, 'cover_media_id');
    }

    public function eventHeroMedia(): HasMany
    {
        return $this->hasMany(Event::class, 'hero_media_id');
    }

    public function galleryCovers(): HasMany
    {
        return $this->hasMany(Gallery::class, 'cover_media_id');
    }

    public function galleryItems(): HasMany
    {
        return $this->hasMany(GalleryItem::class, 'media_asset_id');
    }

    public function sponsorLogos(): HasMany
    {
        return $this->hasMany(Sponsor::class, 'logo_media_id');
    }

    public function people(): HasMany
    {
        return $this->hasMany(Person::class, 'portrait_media_id');
    }

    public function qrisParticipants(): HasMany
    {
        return $this->hasMany(Participant::class, 'qris_media_id');
    }

    protected function casts(): array
    {
        return [
            'bytes' => 'integer',
            'decorative' => 'boolean',
        ];
    }
}

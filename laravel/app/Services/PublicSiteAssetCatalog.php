<?php

namespace App\Services;

use App\Models\Edition;
use App\Models\SiteAssetBinding;
use App\Support\SiteAssetManifest;
use Illuminate\Support\Facades\Schema;

final class PublicSiteAssetCatalog
{
    /**
     * @return array<string, array{url: string, alt: string|null, focalX: int|null, focalY: int|null}>
     */
    public function forActiveEdition(): array
    {
        if (! Schema::hasTable('site_asset_bindings') || ! Schema::hasTable('media_assets')) {
            return [];
        }

        $edition = Edition::query()
            ->where('lifecycle', 'active')
            ->orderByDesc('year')
            ->orderByDesc('id')
            ->first();

        if ($edition === null) {
            return [];
        }

        return SiteAssetBinding::query()
            ->with('media')
            ->where('edition_id', $edition->id)
            ->whereNotNull('media_id')
            ->get()
            ->filter(fn (SiteAssetBinding $binding): bool => $this->isPublicBinding($binding))
            ->mapWithKeys(function (SiteAssetBinding $binding): array {
                $media = $binding->media;

                return [$binding->slot_key => [
                    'url' => $media->url,
                    'alt' => $binding->alt_override ?: $media->alt,
                    'focalX' => $binding->focal_x,
                    'focalY' => $binding->focal_y,
                ]];
            })
            ->all();
    }

    private function isPublicBinding(SiteAssetBinding $binding): bool
    {
        $media = $binding->media;
        $definition = SiteAssetManifest::find($binding->slot_key);

        if ($media === null || $definition === null || $media->lifecycle !== 'ready' || trim($media->url) === '') {
            return false;
        }

        return match ($definition['acceptType']) {
            'image' => str_starts_with($media->mime_type, 'image/'),
            'video' => str_starts_with($media->mime_type, 'video/'),
            default => false,
        };
    }
}

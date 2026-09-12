<?php

namespace App\Services;

use App\Models\Edition;
use App\Models\Gallery;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Schema;

final class PublicGalleryCatalog
{
    /**
     * @var list<array{id: string, title: string}>
     */
    private const ABOUT_VIDEOS = [
        ['id' => '5w0ORZ0XUkE', 'title' => 'Video kegiatan PAMOKA 1'],
        ['id' => 'PEx2wVwReX4', 'title' => 'Video kegiatan PAMOKA 2'],
        ['id' => 'Str4439U-OM', 'title' => 'Video kegiatan PAMOKA 3'],
        ['id' => 'f6rmvU8o6CI', 'title' => 'Video kegiatan PAMOKA 4'],
        ['id' => 'I-R_T7cULcI', 'title' => 'Video kegiatan PAMOKA 5'],
        ['id' => '05GxYCSbhg4', 'title' => 'Video kegiatan PAMOKA 6'],
        ['id' => 'qG8qy-QUxKY', 'title' => 'Video kegiatan PAMOKA 7'],
        ['id' => 'pWTQEm_gCaY', 'title' => 'Video kegiatan PAMOKA 8'],
        ['id' => 'S4NanSPqf00', 'title' => 'Video kegiatan PAMOKA 9'],
    ];

    /**
     * @return list<array{id: string, title: string}>
     */
    public function aboutVideos(): array
    {
        if (! Schema::hasTable('galleries') || ! Schema::hasTable('gallery_items')) {
            return self::ABOUT_VIDEOS;
        }

        $activeEditionId = $this->activeEditionId();
        $galleries = Gallery::query()
            ->with(['items' => fn ($query) => $query
                ->where('active', true)
                ->whereNotNull('youtube_id')
                ->orderBy('display_order')
                ->orderBy('id')])
            ->where('owner_type', 'standalone')
            ->where('owner_id', 'about')
            ->where('status', 'published')
            ->where('active', true)
            ->where(function (Builder $query) use ($activeEditionId): void {
                $query->whereNull('edition_id');

                if ($activeEditionId !== null) {
                    $query->orWhere('edition_id', $activeEditionId);
                }
            })
            ->orderBy('display_order')
            ->orderBy('id')
            ->get();

        $videos = $galleries
            ->flatMap(fn (Gallery $gallery) => $gallery->items)
            ->filter(fn ($item): bool => is_string($item->youtube_id) && $item->youtube_id !== '')
            ->map(fn ($item): array => [
                'id' => $item->youtube_id,
                'title' => $item->caption ?? 'Video kegiatan PAMOKA',
            ])
            ->values()
            ->all();

        return $videos === [] ? self::ABOUT_VIDEOS : $videos;
    }

    private function activeEditionId(): ?string
    {
        $edition = Edition::query()
            ->where('lifecycle', 'active')
            ->orderByDesc('year')
            ->first();

        return $edition?->id;
    }
}

<?php

namespace App\Services;

use App\Models\Edition;
use App\Models\PageSection;
use Illuminate\Support\Facades\Schema;

final class PublicPageSectionCatalog
{
    /**
     * @return array{missions: list<string>, videos: list<array{id: string, title: string}>}
     */
    public function about(): array
    {
        if (! Schema::hasTable('page_sections')) {
            return ['missions' => [], 'videos' => []];
        }

        $edition = Edition::query()
            ->where('lifecycle', 'active')
            ->orderByDesc('year')
            ->orderByDesc('id')
            ->first();

        if ($edition === null) {
            return ['missions' => [], 'videos' => []];
        }

        $sections = PageSection::query()
            ->where('edition_id', $edition->id)
            ->where('page_key', 'tentang')
            ->where('status', 'published')
            ->whereIn('section_key', ['misi', 'video'])
            ->get()
            ->keyBy('section_key');

        $mission = $sections->get('misi');
        $video = $sections->get('video');

        return [
            'missions' => $this->textItems($mission?->presentation_json, $mission?->body),
            'videos' => array_map(
                static fn (string $id): array => ['id' => $id, 'title' => 'Video kegiatan PAMOKA'],
                $this->textItems($video?->presentation_json, null),
            ),
        ];
    }

    /**
     * @param  array<string, mixed>|list<mixed>|null  $presentation
     * @return list<string>
     */
    private function textItems(?array $presentation, ?string $body): array
    {
        $items = $presentation['items'] ?? $presentation;

        if (is_array($items)) {
            $values = array_values(array_filter(
                $items,
                static fn (mixed $item): bool => is_string($item) && trim($item) !== '',
            ));

            if ($values !== []) {
                return array_map(static fn (string $item): string => trim($item), $values);
            }
        }

        if ($body === null) {
            return [];
        }

        return array_values(array_filter(
            array_map('trim', preg_split('/\r?\n/', $body) ?: []),
            static fn (string $item): bool => $item !== '',
        ));
    }
}

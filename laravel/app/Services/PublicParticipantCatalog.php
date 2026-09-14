<?php

namespace App\Services;

use App\Enums\CategoryCode;
use App\Enums\ParticipantMediaRole;
use App\Enums\SocialPlatform;
use App\Models\Category;
use App\Models\Edition;
use App\Models\EditionTitle;
use App\Models\Participant;
use App\Models\ParticipantMedia;
use App\Models\SelectionStage;
use Illuminate\Database\Eloquent\Builder;

final class PublicParticipantCatalog
{
    public const FINAL_STAGE = 'final';

    public const SEMIFINAL_STAGE = 'semifinal';

    /**
     * @var array<string, array{code: string, label: string}>
     */
    private const CATEGORY_DEFINITIONS = [
        'jajaka-dewasa' => ['code' => 'JD', 'label' => 'Jajaka Dewasa'],
        'mojang-dewasa' => ['code' => 'MD', 'label' => 'Mojang Dewasa'],
        'jajaka-rumaja' => ['code' => 'JR', 'label' => 'Jajaka Rumaja'],
        'mojang-rumaja' => ['code' => 'MR', 'label' => 'Mojang Rumaja'],
    ];

    /**
     * @var array<string, array{label: string, legacy_slugs: list<string>}>
     */
    private const STAGE_DEFINITIONS = [
        self::FINAL_STAGE => [
            'label' => 'Finalis',
            'legacy_slugs' => ['final', 'finalis'],
        ],
        self::SEMIFINAL_STAGE => [
            'label' => 'Semifinalis',
            'legacy_slugs' => ['semifinal', 'semifinalis'],
        ],
    ];

    /**
     * @var array<string, mixed>|null
     */
    private static ?array $snapshot = null;

    private static bool $snapshotLoaded = false;

    /**
     * @return array<string, mixed>|null
     */
    public function listing(string $categorySlug, string $stageKey): ?array
    {
        $categoryDefinition = self::CATEGORY_DEFINITIONS[$categorySlug] ?? null;
        $stageDefinition = self::STAGE_DEFINITIONS[$stageKey] ?? null;

        if ($categoryDefinition === null || $stageDefinition === null) {
            return null;
        }

        $edition = $this->activeEdition();
        $category = $edition?->categories()
            ->where('slug', $categorySlug)
            ->where('active', true)
            ->first();

        if ($edition !== null && $category === null && (int) $edition->year !== 2025) {
            return null;
        }

        $stage = $edition === null ? null : $this->publicStage($edition, $stageKey, $stageDefinition['legacy_slugs']);
        $participants = $category === null || $edition === null
            ? collect()
            : $category->participants()
                ->whereBelongsTo($edition)
                ->where('active', true)
                ->with([
                    'achievements:id,participant_id,text,display_order',
                    'socialLinks:id,participant_id,platform,label,url,display_order',
                    'media' => fn ($query) => $query
                        ->where('active', true)
                        ->with('mediaAsset:id,url,alt,lifecycle'),
                    'titles' => fn ($query) => $query
                        ->where('edition_titles.edition_id', $edition->id)
                        ->where('edition_titles.active', true)
                        ->orderBy('edition_titles.display_order')
                        ->orderBy('edition_titles.id'),
                ])
                ->where(function (Builder $query) use ($stage, $stageDefinition): void {
                    if ($stage !== null) {
                        $query
                            ->whereHas('stageEntries', fn ($stageQuery) => $stageQuery->where('stage_id', $stage->id))
                            ->orWhere('current_stage_id', $stage->id)
                            ->orWhere(function (Builder $legacyQuery) use ($stageDefinition): void {
                                $legacyQuery
                                    ->whereNull('current_stage_id')
                                    ->whereIn('stage', $stageDefinition['legacy_slugs']);
                            });

                        return;
                    }

                    $query
                        ->whereNull('current_stage_id')
                        ->whereIn('stage', $stageDefinition['legacy_slugs']);
                })
                ->orderBy('display_order')
                ->orderBy('number')
                ->orderBy('id')
                ->get();

        $categoryCode = $category?->code;
        $participantRows = $participants
            ->map(fn (Participant $participant): array => $this->participantPayload($participant, $edition))
            ->values()
            ->all();

        $listing = [
            'edition' => $edition === null ? null : [
                'year' => $edition->year,
                'name' => $edition->name,
                'slogan' => $edition->slogan,
            ],
            'category' => [
                'code' => $categoryCode instanceof CategoryCode ? $categoryCode->value : $categoryDefinition['code'],
                'label' => $category?->label ?? $categoryDefinition['label'],
                'slug' => $categorySlug,
            ],
            'stage' => [
                'key' => $stageKey,
                'name' => $stage?->name ?? $stageDefinition['label'],
                'label' => $stageDefinition['label'],
                'slug' => $stage?->slug ?? $stageKey,
            ],
            'participants' => $participantRows,
        ];

        if ($participantRows !== []) {
            return $listing;
        }

        return $this->snapshotListing(
            $categorySlug,
            $stageKey,
            $categoryDefinition,
            $stageDefinition,
            $edition,
            $category,
        ) ?? $listing;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function detail(string $categorySlug, string $stageKey, string $participantSlug): ?array
    {
        $listing = $this->listing($categorySlug, $stageKey);

        if ($listing === null) {
            return null;
        }

        $participant = collect($listing['participants'])
            ->first(fn (array $item): bool => $item['slug'] === $participantSlug);

        if ($participant === null) {
            return null;
        }

        unset($listing['participants']);

        return $listing + ['participant' => $participant];
    }

    private function activeEdition(): ?Edition
    {
        return Edition::query()
            ->where('lifecycle', 'active')
            ->orderByDesc('year')
            ->orderByDesc('id')
            ->first();
    }

    /**
     * @return array<string, mixed>
     */
    private function participantPayload(Participant $participant, ?Edition $edition): array
    {
        $media = $participant->media
            ->filter(fn (ParticipantMedia $item): bool => $item->mediaAsset !== null);
        $preferredMedia = $media->first(
            fn (ParticipantMedia $item): bool => $item->role === ParticipantMediaRole::Closeup,
        ) ?? $media->first();

        return [
            'number' => $participant->number,
            'name' => $participant->name,
            'slug' => $participant->slug,
            'bio' => $participant->bio,
            'image' => $preferredMedia?->mediaAsset?->url,
            'imageAlt' => $preferredMedia?->mediaAsset?->alt,
            'achievements' => $participant->achievements
                ->pluck('text')
                ->values()
                ->all(),
            'socialLinks' => $participant->socialLinks
                ->map(fn ($link): array => [
                    'platform' => $link->platform instanceof SocialPlatform ? $link->platform->value : (string) $link->platform,
                    'label' => $link->label,
                    'url' => $link->url,
                ])
                ->values()
                ->all(),
            'titles' => $edition === null
                ? []
                : $participant->titles
                    ->filter(fn (EditionTitle $title): bool => $title->edition_id === $edition->id && $title->active)
                    ->map(fn (EditionTitle $title): array => [
                        'name' => $title->name,
                        'description' => $title->description,
                    ])
                    ->values()
                    ->all(),
        ];
    }

    /**
     * @param  list<string>  $legacySlugs
     */
    private function publicStage(Edition $edition, string $stageKey, array $legacySlugs): ?SelectionStage
    {
        return $edition->selectionStages()
            ->where('lifecycle', 'active')
            ->when(
                $stageKey === self::FINAL_STAGE,
                fn ($query) => $query->where('final_stage', true),
                fn ($query) => $query->whereIn('slug', $legacySlugs),
            )
            ->orderBy('display_order')
            ->orderBy('id')
            ->first();
    }

    /**
     * @param  array{code: string, label: string}  $categoryDefinition
     * @param  array{label: string, legacy_slugs: list<string>}  $stageDefinition
     * @return array<string, mixed>|null
     */
    private function snapshotListing(
        string $categorySlug,
        string $stageKey,
        array $categoryDefinition,
        array $stageDefinition,
        ?Edition $edition,
        ?Category $category,
    ): ?array {
        if ($edition !== null && (int) $edition->year !== 2025) {
            return null;
        }

        $snapshot = $this->participantSnapshot();
        $snapshotEdition = is_array($snapshot['edition'] ?? null) ? $snapshot['edition'] : null;
        $snapshotCategories = is_array($snapshot['categories'] ?? null) ? $snapshot['categories'] : [];

        if ($snapshotEdition === null || (int) ($snapshotEdition['year'] ?? 0) !== 2025) {
            return null;
        }

        $snapshotCategory = null;
        foreach ($snapshotCategories as $candidate) {
            if (is_array($candidate) && ($candidate['slug'] ?? null) === $categorySlug) {
                $snapshotCategory = $candidate;
                break;
            }
        }

        if ($snapshotCategory === null || ! is_array($snapshotCategory['participants'] ?? null)) {
            return null;
        }

        $snapshotParticipants = array_values(array_filter(
            $snapshotCategory['participants'],
            static fn (mixed $participant): bool => is_array($participant)
                && ($participant['stage'] ?? null) === $stageKey,
        ));

        usort($snapshotParticipants, static function (array $left, array $right): int {
            $leftOrder = is_numeric($left['displayOrder'] ?? null) ? (int) $left['displayOrder'] : PHP_INT_MAX;
            $rightOrder = is_numeric($right['displayOrder'] ?? null) ? (int) $right['displayOrder'] : PHP_INT_MAX;

            if ($leftOrder !== $rightOrder) {
                return $leftOrder <=> $rightOrder;
            }

            $leftNumber = is_numeric($left['number'] ?? null) ? (int) $left['number'] : PHP_INT_MAX;
            $rightNumber = is_numeric($right['number'] ?? null) ? (int) $right['number'] : PHP_INT_MAX;

            if ($leftNumber !== $rightNumber) {
                return $leftNumber <=> $rightNumber;
            }

            return strcasecmp((string) ($left['slug'] ?? ''), (string) ($right['slug'] ?? ''));
        });

        $snapshotStage = null;
        foreach (is_array($snapshotCategory['stages'] ?? null) ? $snapshotCategory['stages'] : [] as $candidate) {
            if (is_array($candidate) && ($candidate['key'] ?? null) === $stageKey) {
                $snapshotStage = $candidate;
                break;
            }
        }

        $categoryCode = $category?->code;
        $categoryCode = $categoryCode instanceof CategoryCode
            ? $categoryCode->value
            : (string) ($snapshotCategory['code'] ?? $categoryDefinition['code']);
        $categoryLabel = $category?->label ?? (string) ($snapshotCategory['label'] ?? $categoryDefinition['label']);

        return [
            'edition' => $edition === null
                ? [
                    'year' => 2025,
                    'name' => (string) ($snapshotEdition['name'] ?? 'Pasanggiri Mojang Jajaka Garut 2025'),
                    'slogan' => null,
                ]
                : [
                    'year' => $edition->year,
                    'name' => $edition->name,
                    'slogan' => $edition->slogan,
                ],
            'category' => [
                'code' => $categoryCode,
                'label' => $categoryLabel,
                'slug' => $categorySlug,
            ],
            'stage' => [
                'key' => $stageKey,
                'name' => is_string($snapshotStage['name'] ?? null) && $snapshotStage['name'] !== ''
                    ? $snapshotStage['name']
                    : $stageDefinition['label'],
                'label' => $stageDefinition['label'],
                'slug' => is_string($snapshotStage['slug'] ?? null) && $snapshotStage['slug'] !== ''
                    ? $snapshotStage['slug']
                    : $stageKey,
            ],
            'participants' => array_values(array_map(
                fn (array $participant): array => $this->snapshotParticipantPayload($participant),
                $snapshotParticipants,
            )),
        ];
    }

    /**
     * @param  array<string, mixed>  $participant
     * @return array<string, mixed>
     */
    private function snapshotParticipantPayload(array $participant): array
    {
        $media = is_array($participant['media'] ?? null) ? $participant['media'] : [];
        $achievements = is_array($participant['achievements'] ?? null)
            ? array_values(array_filter($participant['achievements'], 'is_string'))
            : [];

        return [
            'number' => is_numeric($participant['number'] ?? null) ? (int) $participant['number'] : 0,
            'name' => (string) ($participant['name'] ?? ''),
            'slug' => (string) ($participant['slug'] ?? ''),
            'bio' => is_string($participant['bio'] ?? null) ? $participant['bio'] : null,
            'image' => is_string($media['url'] ?? null) ? $media['url'] : null,
            'imageAlt' => is_string($media['alt'] ?? null) ? $media['alt'] : null,
            'achievements' => $achievements,
            'socialLinks' => [],
            'titles' => [],
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function participantSnapshot(): ?array
    {
        if (self::$snapshotLoaded) {
            return self::$snapshot;
        }

        self::$snapshotLoaded = true;
        $path = base_path('database/fixtures/participants-2025.json');

        try {
            $contents = is_file($path) ? file_get_contents($path) : false;

            if (! is_string($contents) || $contents === '') {
                return null;
            }

            $snapshot = json_decode($contents, true, 512, JSON_THROW_ON_ERROR);
            self::$snapshot = is_array($snapshot) ? $snapshot : null;
        } catch (\Throwable) {
            self::$snapshot = null;
        }

        return self::$snapshot;
    }
}

<?php

namespace App\Services;

use App\Enums\CategoryCode;
use App\Enums\ParticipantMediaRole;
use App\Enums\SocialPlatform;
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

        if ($edition !== null && $category === null) {
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

        return [
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
            'participants' => $participants
                ->map(fn (Participant $participant): array => $this->participantPayload($participant, $edition))
                ->values()
                ->all(),
        ];
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
    private function participantPayload(Participant $participant, Edition $edition): array
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
            'titles' => $participant->titles
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
}

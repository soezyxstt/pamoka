<?php

namespace App\Services;

use App\Enums\CategoryCode;
use App\Models\Edition;
use App\Models\Participant;
use App\Models\VotingCampaign;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

final class PublicVotingCatalog
{
    /**
     * @var array<string, array{code: string, label: string}>
     */
    private const CATEGORY_DEFINITIONS = [
        'jajaka-dewasa' => ['code' => 'JD', 'label' => 'Jajaka Dewasa'],
        'mojang-dewasa' => ['code' => 'MD', 'label' => 'Mojang Dewasa'],
        'jajaka-rumaja' => ['code' => 'JR', 'label' => 'Jajaka Rumaja'],
        'mojang-rumaja' => ['code' => 'MR', 'label' => 'Mojang Rumaja'],
    ];

    public function __construct(private readonly PublicParticipantCatalog $participants) {}

    /**
     * @return array<string, mixed>|null
     */
    public function listing(string $categorySlug): ?array
    {
        $categoryDefinition = self::CATEGORY_DEFINITIONS[$categorySlug] ?? null;

        if ($categoryDefinition === null) {
            return null;
        }

        $participantListing = $this->participants->listing($categorySlug, PublicParticipantCatalog::FINAL_STAGE);

        if ($participantListing === null) {
            return null;
        }

        $edition = $this->activeEdition();
        $campaign = $this->publicCampaign($edition);
        $participantRows = $participantListing['participants'];

        if ($campaign !== null && $edition !== null) {
            $candidateSlugs = $this->campaignParticipantSlugs($campaign, $edition, $categorySlug);
            $participantRows = array_values(array_filter(
                $participantRows,
                static fn (array $participant): bool => in_array($participant['slug'], $candidateSlugs, true),
            ));
        }

        $qrisBySlug = $edition !== null
            ? $this->qrisBySlug($edition, $categorySlug, $participantRows, $categoryDefinition['code'])
            : [];

        $participantRows = array_map(
            static function (array $participant) use ($qrisBySlug): array {
                $participant['qrisImage'] = $qrisBySlug[$participant['slug']] ?? null;

                return $participant;
            },
            $participantRows,
        );

        $year = $participantListing['edition']['year'] ?? null;
        $yearSuffix = $year === null ? '' : " {$year}";

        return [
            'meta' => [
                'title' => "Voting Kameumeut {$categoryDefinition['label']}{$yearSuffix} | MOKA Garut",
                'description' => "Voting Mojang Jajaka Kameumeut Pasanggiri Mojang Jajaka Kabupaten Garut{$yearSuffix} pada kategori {$categoryDefinition['label']}.",
            ],
            'pageTitle' => "Voting Kameumeut {$categoryDefinition['label']}{$yearSuffix}",
            'edition' => $participantListing['edition'],
            'category' => [
                'code' => $participantListing['category']['code'] ?? $categoryDefinition['code'],
                'label' => $participantListing['category']['label'] ?? $categoryDefinition['label'],
                'slug' => $categorySlug,
            ],
            'categories' => $this->categoryOptions(),
            'campaign' => $campaign === null ? null : $this->campaignPayload($campaign),
            'participants' => $participantRows,
            'voting' => [
                'available' => $campaign !== null,
                'open' => $campaign !== null && $this->campaignIsOpen($campaign),
                'pricePerPoint' => $campaign?->price_per_point,
            ],
            'candidatePath' => "/voting/{$categorySlug}",
            'resultPath' => "/voting/hasil/{$categorySlug}",
            'emptyState' => $campaign === null
                ? 'Belum ada kampanye voting yang dipublikasikan untuk edisi ini.'
                : 'Belum ada finalis yang terhubung ke kampanye voting ini.',
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    public function detail(string $categorySlug, string $participantSlug): ?array
    {
        $listing = $this->listing($categorySlug);

        if ($listing === null) {
            return null;
        }

        $participant = collect($listing['participants'])
            ->first(fn (array $item): bool => $item['slug'] === $participantSlug);

        if ($participant === null) {
            return null;
        }

        unset($listing['participants']);

        return $listing + [
            'participant' => $participant,
            'profileIndexPath' => "/voting/{$categorySlug}",
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    public function results(string $categorySlug): ?array
    {
        $listing = $this->listing($categorySlug);

        if ($listing === null) {
            return null;
        }

        $edition = $this->activeEdition();
        $campaign = $this->publicCampaign($edition);
        $published = $campaign !== null && $campaign->result_visibility === 'visible';
        $amountByParticipant = [];

        if ($published && $campaign !== null && $edition !== null) {
            $participantIds = $this->campaignParticipantIds(
                $campaign,
                $edition,
                $categorySlug,
                array_column($listing['participants'], 'slug'),
            );

            if ($participantIds !== []) {
                $amountByParticipant = DB::table('vote_daily_tallies')
                    ->select('participant_id')
                    ->selectRaw('SUM(amount) as total_amount')
                    ->where('campaign_id', $campaign->id)
                    ->whereIn('participant_id', array_values($participantIds))
                    ->groupBy('participant_id')
                    ->pluck('total_amount', 'participant_id')
                    ->map(static fn (mixed $amount): int => (int) $amount)
                    ->all();
            }
        }

        $participantIdsBySlug = $edition !== null && $campaign !== null
            ? $this->campaignParticipantIds($campaign, $edition, $categorySlug, array_column($listing['participants'], 'slug'))
            : [];
        $totalAmount = array_sum($amountByParticipant);
        $hasPublishedResults = $published && $totalAmount > 0;

        $results = array_map(function (array $participant) use ($participantIdsBySlug, $amountByParticipant, $totalAmount, $hasPublishedResults): array {
            $amount = $amountByParticipant[$participantIdsBySlug[$participant['slug']] ?? ''] ?? 0;

            return [
                'name' => $participant['name'],
                'slug' => $participant['slug'],
                'number' => $participant['number'],
                'image' => $participant['image'],
                'percentage' => $hasPublishedResults ? round(($amount / $totalAmount) * 100, 2) : 0,
                'amount' => $hasPublishedResults ? $amount : null,
            ];
        }, $listing['participants']);

        if ($hasPublishedResults) {
            usort($results, static function (array $left, array $right): int {
                $percentageSort = $right['percentage'] <=> $left['percentage'];

                return $percentageSort !== 0
                    ? $percentageSort
                    : strcasecmp($left['name'], $right['name']);
            });
        }

        $category = $listing['category'];
        $year = $listing['edition']['year'] ?? null;
        $yearSuffix = $year === null ? '' : " {$year}";

        return [
            'meta' => [
                'title' => "Hasil voting {$category['label']}{$yearSuffix} | MOKA Garut",
                'description' => "Hasil voting Mojang Jajaka Kameumeut Pasanggiri Mojang Jajaka Kabupaten Garut{$yearSuffix} pada kategori {$category['label']}.",
            ],
            'pageTitle' => "Hasil voting {$category['label']}{$yearSuffix}",
            'edition' => $listing['edition'],
            'category' => $category,
            'categories' => $listing['categories'],
            'campaign' => $listing['campaign'],
            'results' => $results,
            'hasPublishedResults' => $hasPublishedResults,
            'summary' => [
                'participantCount' => count($results),
                'leader' => $hasPublishedResults ? ($results[0]['name'] ?? null) : null,
            ],
            'emptyState' => $hasPublishedResults
                ? null
                : 'Hasil belum tersedia. Daftar finalis tetap ditampilkan tanpa membuat persentase yang menyesatkan.',
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function monitor(): array
    {
        $edition = $this->activeEdition();
        $campaign = $this->publicCampaign($edition);

        if ($edition === null || $campaign === null) {
            return [
                'meta' => [
                    'title' => 'Monitor voting | MOKA Garut',
                    'description' => 'Monitor operasional tally voting PAMOKA Garut.',
                ],
                'pageTitle' => 'Monitor voting',
                'edition' => $edition === null ? null : ['year' => $edition->year, 'name' => $edition->name],
                'campaign' => null,
                'categories' => [],
                'totalAmount' => 0,
                'emptyState' => 'Belum ada kampanye voting dengan peserta yang dapat dimonitor.',
            ];
        }

        $participants = $campaign->participants()
            ->with('category')
            ->where('participants.edition_id', $edition->id)
            ->where('participants.active', true)
            ->get();
        $totals = DB::table('vote_daily_tallies')
            ->select('participant_id')
            ->selectRaw('SUM(amount) as total_amount')
            ->where('campaign_id', $campaign->id)
            ->groupBy('participant_id')
            ->pluck('total_amount', 'participant_id')
            ->map(static fn (mixed $amount): int => (int) $amount)
            ->all();
        $categories = [];

        foreach ($participants as $participant) {
            $code = $participant->category?->code;
            $code = $code instanceof CategoryCode ? $code->value : (string) $code;
            $amount = $totals[$participant->id] ?? 0;

            if (! isset($categories[$code])) {
                $categories[$code] = [
                    'code' => $code,
                    'label' => $participant->category?->label ?? $code,
                    'displayOrder' => $participant->category?->display_order ?? 0,
                    'candidateCount' => 0,
                    'totalAmount' => 0,
                    'top' => [],
                ];
            }

            $categories[$code]['candidateCount']++;
            $categories[$code]['totalAmount'] += $amount;
            $categories[$code]['top'][] = [
                'name' => $participant->name,
                'shortName' => $this->shortName($participant->name),
                'totalAmount' => $amount,
            ];
        }

        foreach ($categories as &$category) {
            usort($category['top'], static function (array $left, array $right): int {
                $amountSort = $right['totalAmount'] <=> $left['totalAmount'];

                return $amountSort !== 0 ? $amountSort : strcasecmp($left['name'], $right['name']);
            });
            $category['top'] = array_slice($category['top'], 0, 3);
        }
        unset($category);

        uasort($categories, static fn (array $left, array $right): int => $left['displayOrder'] <=> $right['displayOrder']);
        $categories = array_values($categories);
        $totalAmount = array_sum(array_column($categories, 'totalAmount'));

        return [
            'meta' => [
                'title' => 'Monitor voting | MOKA Garut',
                'description' => 'Monitor operasional tally voting PAMOKA Garut.',
            ],
            'pageTitle' => 'Monitor voting',
            'edition' => ['year' => $edition->year, 'name' => $edition->name],
            'campaign' => $this->campaignPayload($campaign),
            'categories' => $categories,
            'totalAmount' => $totalAmount,
            'emptyState' => $participants->isEmpty() ? 'Belum ada peserta pada snapshot campaign ini.' : null,
        ];
    }

    private function activeEdition(): ?Edition
    {
        return Edition::query()
            ->where('lifecycle', 'active')
            ->orderByDesc('year')
            ->orderByDesc('id')
            ->first();
    }

    private function publicCampaign(?Edition $edition): ?VotingCampaign
    {
        if ($edition === null || ! $this->votingTablesExist()) {
            return null;
        }

        return VotingCampaign::query()
            ->where('edition_id', $edition->id)
            ->whereIn('status', ['active', 'closed'])
            ->orderByDesc('starts_at')
            ->orderByDesc('id')
            ->first();
    }

    /**
     * @param  list<array<string, mixed>>  $participantRows
     * @return array<string, string>
     */
    private function qrisBySlug(Edition $edition, string $categorySlug, array $participantRows, string $categoryCode): array
    {
        $slugs = array_values(array_filter(array_column($participantRows, 'slug'), 'is_string'));
        if ($slugs === []) {
            return [];
        }

        $mediaBySlug = [];
        if (Schema::hasColumn('participants', 'qris_media_id')) {
            $mediaBySlug = Participant::query()
                ->with('qrisMedia')
                ->where('edition_id', $edition->id)
                ->whereIn('slug', $slugs)
                ->whereHas('category', function (Builder $query) use ($categorySlug): void {
                    $query->where('slug', $categorySlug)->where('active', true);
                })
                ->get()
                ->mapWithKeys(function (Participant $participant): array {
                    $asset = $participant->qrisMedia;

                    if ($asset !== null && $asset->lifecycle === 'ready' && str_starts_with(strtolower($asset->mime_type), 'image/')) {
                        return [$participant->slug => $asset->url];
                    }

                    return [];
                })
                ->all();
        }

        foreach ($participantRows as $participant) {
            $path = "/qr/{$categoryCode}/".str_replace(' ', '_', $participant['name']).'.jpg';
            if (! isset($mediaBySlug[$participant['slug']]) && is_file(public_path(ltrim($path, '/')))) {
                $mediaBySlug[$participant['slug']] = $path;
            }
        }

        return $mediaBySlug;
    }

    /**
     * @return list<string>
     */
    private function campaignParticipantSlugs(VotingCampaign $campaign, Edition $edition, string $categorySlug): array
    {
        return $campaign->participants()
            ->where('participants.edition_id', $edition->id)
            ->where('participants.active', true)
            ->whereHas('category', function (Builder $query) use ($categorySlug): void {
                $query->where('slug', $categorySlug)->where('active', true);
            })
            ->orderBy('participants.display_order')
            ->orderBy('participants.number')
            ->orderBy('participants.id')
            ->pluck('participants.slug')
            ->all();
    }

    /**
     * @param  list<string>  $slugs
     * @return array<string, string>
     */
    private function campaignParticipantIds(VotingCampaign $campaign, Edition $edition, string $categorySlug, array $slugs): array
    {
        if ($slugs === []) {
            return [];
        }

        return $campaign->participants()
            ->where('participants.edition_id', $edition->id)
            ->whereIn('participants.slug', $slugs)
            ->whereHas('category', function (Builder $query) use ($categorySlug): void {
                $query->where('slug', $categorySlug)->where('active', true);
            })
            ->pluck('participants.id', 'participants.slug')
            ->map(static fn (mixed $id): string => (string) $id)
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    private function campaignPayload(VotingCampaign $campaign): array
    {
        return [
            'id' => $campaign->id,
            'name' => $campaign->name,
            'slug' => $campaign->slug,
            'timezone' => $campaign->timezone,
            'startsAt' => $campaign->starts_at?->toIso8601String(),
            'endsAt' => $campaign->ends_at?->toIso8601String(),
            'startedAt' => $campaign->started_at?->toIso8601String(),
            'closedAt' => $campaign->closed_at?->toIso8601String(),
            'status' => $campaign->status,
            'statusLabel' => match ($campaign->status) {
                'active' => 'Aktif',
                'closed' => 'Ditutup',
                default => 'Draf',
            },
            'pricePerPoint' => (int) $campaign->price_per_point,
            'resultVisibility' => $campaign->result_visibility,
            'open' => $this->campaignIsOpen($campaign),
        ];
    }

    private function campaignIsOpen(VotingCampaign $campaign): bool
    {
        if ($campaign->status !== 'active' || $campaign->starts_at === null || $campaign->ends_at === null) {
            return false;
        }

        $now = CarbonImmutable::now($campaign->timezone);

        return $now->greaterThanOrEqualTo($campaign->starts_at)
            && $now->lessThanOrEqualTo($campaign->ends_at);
    }

    /**
     * @return list<array{slug: string, code: string, label: string}>
     */
    private function categoryOptions(): array
    {
        return array_map(
            static fn (string $slug, array $definition): array => [
                'slug' => $slug,
                'code' => $definition['code'],
                'label' => $definition['label'],
            ],
            array_keys(self::CATEGORY_DEFINITIONS),
            array_values(self::CATEGORY_DEFINITIONS),
        );
    }

    private function shortName(string $name): string
    {
        $words = preg_split('/\s+/', trim($name), -1, PREG_SPLIT_NO_EMPTY) ?: [];

        return implode(' ', array_slice($words, 0, 2));
    }

    private function votingTablesExist(): bool
    {
        return Schema::hasTable('voting_campaigns')
            && Schema::hasTable('voting_campaign_participants')
            && Schema::hasTable('vote_daily_tallies');
    }
}

<?php

namespace App\Services;

use Illuminate\Support\Str;

final class PublicLegacyCatalog
{
    /**
     * @var list<string>
     */
    private const CATEGORY_SLUGS = [
        'mojang-rumaja',
        'jajaka-rumaja',
        'mojang-dewasa',
        'jajaka-dewasa',
    ];

    public function __construct(
        private readonly PublicParticipantCatalog $participants,
        private readonly PublicSponsorCatalog $sponsors,
    ) {}

    /**
     * @return array{finalists: list<array{id: string, name: string, title: string, slug: string, categorySlug: string}>, sponsors: list<array{name: string, image: string}>}
     */
    public function pasanggiri(): array
    {
        $finalists = [];

        foreach (self::CATEGORY_SLUGS as $categorySlug) {
            $listing = $this->participants->listing($categorySlug, PublicParticipantCatalog::FINAL_STAGE);

            if ($listing === null) {
                continue;
            }

            foreach ($listing['participants'] as $participant) {
                $finalists[] = [
                    'id' => $participant['slug'],
                    'name' => $participant['name'],
                    'title' => 'Finalis '.($listing['category']['code'] ?? ''),
                    'slug' => $participant['slug'],
                    'categorySlug' => $categorySlug,
                ];
            }
        }

        return [
            'finalists' => $finalists,
            'sponsors' => $this->sponsors->featured(),
        ];
    }

    /**
     * @return array{name: string, title: string, slug: string, categorySlug: string|null, image: string|null, bio: string|null, achievements: list<string>}
     */
    public function spotlight(string $name): array
    {
        $slug = Str::of($name)->trim()->lower()->toString();

        foreach (self::CATEGORY_SLUGS as $categorySlug) {
            $listing = $this->participants->listing($categorySlug, PublicParticipantCatalog::FINAL_STAGE);

            if ($listing === null) {
                continue;
            }

            $participant = collect($listing['participants'])->first(
                static fn (array $item): bool => $item['slug'] === $slug,
            );

            if ($participant !== null) {
                return [
                    'name' => $participant['name'],
                    'title' => 'Finalis '.($listing['category']['code'] ?? ''),
                    'slug' => $participant['slug'],
                    'categorySlug' => $categorySlug,
                    'image' => $participant['image'],
                    'bio' => $participant['bio'],
                    'achievements' => $participant['achievements'],
                ];
            }
        }

        return [
            'name' => Str::headline(str_replace(['-', '_'], ' ', $slug)),
            'title' => 'Spotlight',
            'slug' => $slug,
            'categorySlug' => null,
            'image' => null,
            'bio' => 'Profil spotlight sedang disiapkan.',
            'achievements' => [],
        ];
    }
}

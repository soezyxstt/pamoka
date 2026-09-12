<?php

namespace App\Services;

use App\Models\Edition;
use App\Models\Event;
use Illuminate\Support\Facades\Schema;

final class PublicEventCatalog
{
    /**
     * @var array<string, array{label: string, description: string}>
     */
    private const EVENTS = [
        'audisi' => [
            'label' => 'Audisi',
            'description' => 'Proses seleksi awal yang meliputi 3 tahapan seleksi. Tahapan pertama, peserta melakukan tes tulis sebanyak 100 soal kemudian peserta disaring menjadi 64 besar.',
        ],
        'semifinal' => [
            'label' => 'Semifinal',
            'description' => 'Pembekalan materi umum kepada peserta dari pemateri pilihan. Berdasarkan nilai keaktifan beserta hasil interview peserta akan kembali diseleksi untuk kemudian diambil 44 calon Mojang dan Jajaka tercocok.',
        ],
        'karantina' => [
            'label' => 'Karantina',
            'description' => 'Proses pembinaan karakter agar dapat menanamkan nilai-nilai Ki Sunda, serta memberikan materi berkenaan dengan pariwisata, kebudayaan, ekonomi kreatif, public speaking, dan personal branding.',
        ],
        'unjuk-kabisa' => [
            'label' => 'Unjuk Kabisa',
            'description' => 'Proses penilaian kemahiran atau bakat para finalis dalam bentuk kesenian yang berkarakter Sunda. Unjuk kabisa disaksikan oleh masyarakat umum dan dinilai langsung oleh dewan juri yang berkompeten dengan format penilaian tertulis.',
        ],
        'gala-dinner' => [
            'label' => 'Gala Dinner',
            'description' => 'Peserta akan mengikuti acara makan malam dalam suasana elegan dan eksklusif sebagai bentuk penerapan pribadi yang beretika, menaati norma, dan aturan tidak tertulis yang berlaku.',
        ],
        'grand-final' => [
            'label' => 'Grand Final',
            'description' => 'Puncak dari rangkaian Pasanggiri Mojang Jajaka Kabupaten Garut Tahun 2025. Finalis dengan nilai dan penampilan terbaik akan dipilih dan dinobatkan sebagai Mojang dan Jajaka Pinilih Kabupaten Garut tahun 2025 serta gelar kategori lainnya.',
        ],
    ];

    /**
     * @param  list<array{name: string, image: string}>|null  $sponsors
     * @return array<string, mixed>|null
     */
    public function detail(string $slug, ?array $sponsors = null): ?array
    {
        $eventDefinition = self::EVENTS[$slug] ?? null;

        if ($eventDefinition === null) {
            return null;
        }

        $sponsors ??= PublicSponsorCatalog::snapshot();
        $edition = $this->activeEdition();

        if ($edition !== null && $this->publicMediaTablesExist()) {
            $event = Event::query()
                ->with(['heroMedia', 'galleries.items.mediaAsset'])
                ->where('edition_id', $edition->id)
                ->where('slug', $slug)
                ->where('active', true)
                ->first();

            if ($event !== null) {
                $images = $event->galleries
                    ->filter(fn ($gallery): bool => $gallery->status === 'published' && $gallery->active)
                    ->flatMap(fn ($gallery) => $gallery->items)
                    ->filter(fn ($item): bool => $item->active
                        && $item->mediaAsset !== null
                        && $item->mediaAsset->lifecycle === 'ready')
                    ->map(fn ($item): string => $item->mediaAsset->url)
                    ->values()
                    ->all();

                if ($images === [] && $event->heroMedia?->lifecycle === 'ready') {
                    $images = [$event->heroMedia->url];
                }

                return [
                    'meta' => [
                        'title' => "{$event->label} | Rangkaian Kegiatan | MOKA Garut",
                        'description' => "Dokumentasi {$event->label} pada rangkaian Pasanggiri Mojang Jajaka Kabupaten Garut {$edition->year}.",
                    ],
                    'pageTitle' => $event->label,
                    'event' => [
                        'slug' => $event->slug,
                        'label' => $event->label,
                        'description' => $event->description ?? $eventDefinition['description'],
                        'images' => $images,
                    ],
                    'sponsors' => $sponsors,
                    'emptyState' => 'Dokumentasi kegiatan sedang disiapkan.',
                ];
            }
        }

        $images = array_map(
            static fn (int $number): string => "/rangkaian-kegiatan/{$slug}/{$number}.webp",
            range(1, 10),
        );

        return [
            'meta' => [
                'title' => "{$eventDefinition['label']} | Rangkaian Kegiatan | MOKA Garut",
                'description' => "Dokumentasi {$eventDefinition['label']} pada rangkaian Pasanggiri Mojang Jajaka Kabupaten Garut 2025.",
            ],
            'pageTitle' => $eventDefinition['label'],
            'event' => [
                'slug' => $slug,
                'label' => $eventDefinition['label'],
                'description' => $eventDefinition['description'],
                'images' => $images,
            ],
            'sponsors' => $sponsors,
            'emptyState' => 'Dokumentasi kegiatan sedang disiapkan.',
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

    private function publicMediaTablesExist(): bool
    {
        return Schema::hasTable('events')
            && Schema::hasTable('galleries')
            && Schema::hasTable('gallery_items');
    }
}

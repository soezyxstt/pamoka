<?php

namespace App\Console\Commands;

use App\Models\Edition;
use App\Models\Event;
use App\Models\Gallery;
use App\Models\GalleryItem;
use App\Models\MediaAsset;
use App\Models\Sponsor;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Throwable;

#[Signature('moka:import-public-media {--fixture=} {--apply : Write the validated snapshot to the configured database}')]
#[Description('Rehearse the 2025 events, galleries, and sponsors import')]
class ImportPublicMedia2025 extends Command
{
    private const ALLOWED_TIERS = ['utama', 'pendukung', 'pendamping', 'pelengkap'];

    public function handle(): int
    {
        $fixturePath = $this->resolveFixturePath();

        if (! is_file($fixturePath)) {
            $this->error("Fixture tidak ditemukan: {$fixturePath}");

            return self::FAILURE;
        }

        try {
            $document = $this->readFixture($fixturePath);
        } catch (Throwable $exception) {
            $this->error($exception->getMessage());

            return self::FAILURE;
        }

        $errors = $this->validateFixture($document);

        if ($errors !== []) {
            foreach ($errors as $error) {
                $this->error($error);
            }

            return self::FAILURE;
        }

        $summary = $this->summarize($document);
        $this->table(['Metrik', 'Nilai'], array_map(
            static fn (string $key, int $value): array => [$key, $value],
            array_keys($summary),
            array_values($summary),
        ));

        if (! $this->option('apply')) {
            $this->warn('Dry run selesai. Tidak ada perubahan database. Gunakan --apply hanya pada database rehearsal yang dipilih.');

            return self::SUCCESS;
        }

        if (! $this->isLocalRehearsalDatabase()) {
            $this->error('Apply diblokir. Command ini hanya boleh menulis ke database MySQL lokal pamoka atau pamoka_test.');

            return self::FAILURE;
        }

        $result = DB::transaction(fn (): array => $this->persist($document));
        $this->info('Import acara, galeri, dan sponsor 2025 berhasil diterapkan.');
        $this->line(json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

        return self::SUCCESS;
    }

    /**
     * @return array<string, mixed>
     */
    private function readFixture(string $fixturePath): array
    {
        $contents = file_get_contents($fixturePath);

        if ($contents === false) {
            throw new \RuntimeException("Fixture tidak dapat dibaca: {$fixturePath}");
        }

        $document = json_decode($contents, true, 512, JSON_THROW_ON_ERROR);

        if (! is_array($document)) {
            throw new \RuntimeException('Format fixture harus berupa object JSON.');
        }

        return $document;
    }

    /**
     * @param  array<string, mixed>  $document
     * @return list<string>
     */
    private function validateFixture(array $document): array
    {
        $errors = [];

        if (($document['schemaVersion'] ?? null) !== 1) {
            $errors[] = 'schemaVersion fixture harus bernilai 1.';
        }

        $edition = $document['edition'] ?? null;

        if (! is_array($edition) || ($edition['year'] ?? null) !== 2025 || ($edition['slug'] ?? null) !== '2025') {
            $errors[] = 'Fixture harus memiliki edisi 2025 dengan slug 2025.';
        }

        $errors = [...$errors, ...$this->validateEvents($document['events'] ?? null)];
        $errors = [...$errors, ...$this->validateStandaloneGalleries($document['standaloneGalleries'] ?? null)];
        $errors = [...$errors, ...$this->validateSponsors($document['sponsors'] ?? null)];

        return $errors;
    }

    /**
     * @return list<string>
     */
    private function validateEvents(mixed $events): array
    {
        if (! is_array($events) || $events === []) {
            return ['Fixture harus memiliki minimal satu acara.'];
        }

        $errors = [];
        $slugs = [];

        foreach ($events as $index => $event) {
            if (! is_array($event)) {
                $errors[] = "Acara pada index {$index} tidak valid.";

                continue;
            }

            $slug = $event['slug'] ?? null;

            if (! is_string($slug) || $slug === '') {
                $errors[] = "Acara pada index {$index} tidak memiliki slug.";

                continue;
            }

            if (in_array($slug, $slugs, true)) {
                $errors[] = "Slug acara {$slug} duplikat.";
            } else {
                $slugs[] = $slug;
            }

            if (! is_string($event['label'] ?? null) || $event['label'] === '') {
                $errors[] = "Label acara {$slug} tidak valid.";
            }

            if (! is_string($event['description'] ?? null) || $event['description'] === '') {
                $errors[] = "Deskripsi acara {$slug} tidak valid.";
            }

            $directory = $event['imageDirectory'] ?? null;
            $imageCount = $event['imageCount'] ?? null;

            if (! is_string($directory) || preg_match('#^/rangkaian-kegiatan/[a-z0-9-]+$#', $directory) !== 1) {
                $errors[] = "Direktori gambar acara {$slug} tidak valid.";
            }

            if (! is_int($imageCount) || $imageCount < 1 || $imageCount > 20) {
                $errors[] = "Jumlah gambar acara {$slug} tidak valid.";
            }

            if (is_string($directory) && is_int($imageCount) && $imageCount >= 1 && $imageCount <= 20) {
                for ($number = 1; $number <= $imageCount; $number++) {
                    $url = rtrim($directory, '/')."/{$number}.webp";

                    if ($this->publicAssetPath($url) === null) {
                        $errors[] = "Asset acara tidak ditemukan: {$url}.";
                    }
                }
            }

            if (! is_string($event['galleryTitle'] ?? null) || $event['galleryTitle'] === '') {
                $errors[] = "Judul galeri acara {$slug} tidak valid.";
            }

            if (! is_int($event['displayOrder'] ?? null) || $event['displayOrder'] < 0) {
                $errors[] = "Urutan acara {$slug} tidak valid.";
            }
        }

        return $errors;
    }

    /**
     * @return list<string>
     */
    private function validateStandaloneGalleries(mixed $galleries): array
    {
        if (! is_array($galleries)) {
            return ['standaloneGalleries fixture harus berupa array.'];
        }

        $errors = [];
        $slugs = [];

        foreach ($galleries as $index => $gallery) {
            if (! is_array($gallery)) {
                $errors[] = "Galeri standalone pada index {$index} tidak valid.";

                continue;
            }

            $slug = $gallery['slug'] ?? null;

            if (! is_string($slug) || $slug === '') {
                $errors[] = "Galeri standalone pada index {$index} tidak memiliki slug.";

                continue;
            }

            if (in_array($slug, $slugs, true)) {
                $errors[] = "Slug galeri standalone {$slug} duplikat.";
            } else {
                $slugs[] = $slug;
            }

            if (($gallery['ownerType'] ?? null) !== 'standalone') {
                $errors[] = "ownerType galeri {$slug} harus standalone.";
            }

            foreach (['title', 'description', 'ownerId'] as $field) {
                if (! is_string($gallery[$field] ?? null) || $gallery[$field] === '') {
                    $errors[] = "{$field} galeri {$slug} tidak valid.";
                }
            }

            if (($gallery['status'] ?? null) !== 'published') {
                $errors[] = "Status galeri {$slug} harus published untuk snapshot publik.";
            }

            $items = $gallery['items'] ?? null;

            if (! is_array($items) || $items === []) {
                $errors[] = "Galeri {$slug} harus memiliki minimal satu item.";

                continue;
            }

            foreach ($items as $itemIndex => $item) {
                if (! is_array($item)) {
                    $errors[] = "Item galeri {$slug} pada index {$itemIndex} tidak valid.";

                    continue;
                }

                $youtubeId = $item['youtubeId'] ?? null;

                if (! is_string($youtubeId) || preg_match('/^[A-Za-z0-9_-]{6,20}$/', $youtubeId) !== 1) {
                    $errors[] = "youtubeId item galeri {$slug} pada index {$itemIndex} tidak valid.";
                }

                if (! is_string($item['caption'] ?? null) || $item['caption'] === '') {
                    $errors[] = "Caption item galeri {$slug} pada index {$itemIndex} tidak valid.";
                }

                if (! is_int($item['displayOrder'] ?? null) || $item['displayOrder'] < 0) {
                    $errors[] = "Urutan item galeri {$slug} pada index {$itemIndex} tidak valid.";
                }
            }
        }

        return $errors;
    }

    /**
     * @return list<string>
     */
    private function validateSponsors(mixed $sponsors): array
    {
        if (! is_array($sponsors) || $sponsors === []) {
            return ['Fixture harus memiliki minimal satu sponsor.'];
        }

        $errors = [];
        $names = [];

        foreach ($sponsors as $index => $sponsor) {
            if (! is_array($sponsor)) {
                $errors[] = "Sponsor pada index {$index} tidak valid.";

                continue;
            }

            $name = $sponsor['name'] ?? null;

            if (! is_string($name) || $name === '') {
                $errors[] = "Sponsor pada index {$index} tidak memiliki nama.";

                continue;
            }

            if (in_array($name, $names, true)) {
                $errors[] = "Nama sponsor {$name} duplikat.";
            } else {
                $names[] = $name;
            }

            $logo = $sponsor['logo'] ?? null;

            if (! is_string($logo) || $this->publicAssetPath($logo) === null) {
                $errors[] = "Asset logo sponsor {$name} tidak ditemukan.";
            }

            if (! in_array($sponsor['tier'] ?? null, self::ALLOWED_TIERS, true)) {
                $errors[] = "Tier sponsor {$name} tidak didukung.";
            }

            if (! is_int($sponsor['displayOrder'] ?? null) || $sponsor['displayOrder'] < 0) {
                $errors[] = "Urutan sponsor {$name} tidak valid.";
            }

            if (array_key_exists('website', $sponsor) && $sponsor['website'] !== null
                && (! is_string($sponsor['website']) || ! $this->isAllowedExternalUrl($sponsor['website']))) {
                $errors[] = "Website sponsor {$name} harus berupa URL http(s).";
            }
        }

        return $errors;
    }

    /**
     * @param  array<string, mixed>  $document
     * @return array<string, int>
     */
    private function summarize(array $document): array
    {
        $imageCount = array_sum(array_map(
            static fn (array $event): int => $event['imageCount'],
            $document['events'],
        ));
        $standaloneItemCount = array_sum(array_map(
            static fn (array $gallery): int => count($gallery['items']),
            $document['standaloneGalleries'],
        ));
        $mediaUrls = [];

        foreach ($document['events'] as $event) {
            for ($number = 1; $number <= $event['imageCount']; $number++) {
                $mediaUrls[rtrim($event['imageDirectory'], '/')."/{$number}.webp"] = true;
            }
        }

        foreach ($document['sponsors'] as $sponsor) {
            $mediaUrls[$sponsor['logo']] = true;
        }

        return [
            'edisi' => 1,
            'acara' => count($document['events']),
            'album' => count($document['events']) + count($document['standaloneGalleries']),
            'item album' => $imageCount + $standaloneItemCount,
            'sponsor' => count($document['sponsors']),
            'media asset unik' => count($mediaUrls),
        ];
    }

    /**
     * @param  array<string, mixed>  $document
     * @return array<string, int>
     */
    private function persist(array $document): array
    {
        $editionData = $document['edition'];
        $edition = Edition::query()->firstOrNew(['year' => $editionData['year']]);
        $edition->fill([
            'slug' => $editionData['slug'],
            'name' => $editionData['name'],
            'timezone' => $editionData['timezone'],
            'lifecycle' => $editionData['lifecycle'],
        ]);
        $edition->save();

        $counts = [
            'editions' => 1,
            'events' => 0,
            'galleries' => 0,
            'galleryItems' => 0,
            'sponsors' => 0,
            'mediaAssets' => 0,
        ];
        $mediaIds = [];

        foreach ($document['events'] as $eventData) {
            $event = Event::query()->firstOrNew([
                'edition_id' => $edition->id,
                'slug' => $eventData['slug'],
            ]);

            if (! $event->exists) {
                $event->id = $this->stableUuid("public-media:event:2025:{$eventData['slug']}");
            }

            $eventMedia = [];

            for ($number = 1; $number <= $eventData['imageCount']; $number++) {
                $url = rtrim($eventData['imageDirectory'], '/')."/{$number}.webp";
                $eventMedia[$number] = $this->persistMedia(
                    $url,
                    "Dokumentasi {$eventData['label']} foto {$number}",
                );
                $mediaIds[$url] = true;
            }

            $event->fill([
                'edition_id' => $edition->id,
                'slug' => $eventData['slug'],
                'label' => $eventData['label'],
                'description' => $eventData['description'],
                'hero_media_id' => $eventMedia[1]->id,
                'display_order' => $eventData['displayOrder'],
                'active' => true,
                'version' => 1,
            ]);
            $event->save();
            $counts['events']++;

            $gallery = Gallery::query()->firstOrNew([
                'edition_id' => $edition->id,
                'slug' => $eventData['slug'],
            ]);

            if (! $gallery->exists) {
                $gallery->id = $this->stableUuid("public-media:event-gallery:2025:{$eventData['slug']}");
            }

            $gallery->fill([
                'edition_id' => $edition->id,
                'slug' => $eventData['slug'],
                'title' => $eventData['galleryTitle'],
                'description' => $eventData['description'],
                'cover_media_id' => $eventMedia[1]->id,
                'owner_type' => 'event',
                'owner_id' => $event->id,
                'display_order' => $eventData['displayOrder'],
                'status' => 'published',
                'active' => true,
                'version' => 1,
            ]);
            $gallery->save();
            $counts['galleries']++;

            for ($number = 1; $number <= $eventData['imageCount']; $number++) {
                $itemId = $this->stableUuid("public-media:event-gallery-item:2025:{$eventData['slug']}:{$number}");
                $item = GalleryItem::query()->firstOrNew([
                    'id' => $itemId,
                ]);

                if (! $item->exists) {
                    $item->id = $itemId;
                }

                $item->fill([
                    'gallery_id' => $gallery->id,
                    'media_asset_id' => $eventMedia[$number]->id,
                    'youtube_id' => null,
                    'caption' => "Dokumentasi {$eventData['label']} foto {$number}",
                    'display_order' => $number - 1,
                    'active' => true,
                ]);
                $item->save();
                $counts['galleryItems']++;
            }
        }

        foreach ($document['standaloneGalleries'] as $galleryData) {
            $gallery = Gallery::query()->firstOrNew([
                'edition_id' => null,
                'slug' => $galleryData['slug'],
            ]);

            if (! $gallery->exists) {
                $gallery->id = $this->stableUuid("public-media:standalone-gallery:{$galleryData['slug']}");
            }

            $gallery->fill([
                'edition_id' => null,
                'slug' => $galleryData['slug'],
                'title' => $galleryData['title'],
                'description' => $galleryData['description'],
                'cover_media_id' => null,
                'owner_type' => $galleryData['ownerType'],
                'owner_id' => $galleryData['ownerId'],
                'display_order' => $galleryData['displayOrder'] ?? 0,
                'status' => $galleryData['status'],
                'active' => true,
                'version' => 1,
            ]);
            $gallery->save();
            $counts['galleries']++;

            foreach ($galleryData['items'] as $itemData) {
                $itemId = $this->stableUuid("public-media:standalone-gallery-item:{$galleryData['slug']}:{$itemData['displayOrder']}");
                $item = GalleryItem::query()->firstOrNew([
                    'id' => $itemId,
                ]);

                if (! $item->exists) {
                    $item->id = $itemId;
                }

                $item->fill([
                    'gallery_id' => $gallery->id,
                    'media_asset_id' => null,
                    'youtube_id' => $itemData['youtubeId'],
                    'caption' => $itemData['caption'],
                    'display_order' => $itemData['displayOrder'],
                    'active' => true,
                ]);
                $item->save();
                $counts['galleryItems']++;
            }
        }

        foreach ($document['sponsors'] as $sponsorData) {
            $logo = $this->persistMedia($sponsorData['logo'], "Logo sponsor {$sponsorData['name']}");
            $mediaIds[$sponsorData['logo']] = true;
            $sponsor = Sponsor::query()->firstOrNew([
                'edition_id' => $edition->id,
                'name' => $sponsorData['name'],
            ]);

            if (! $sponsor->exists) {
                $sponsor->id = $this->stableUuid("public-media:sponsor:2025:{$sponsorData['name']}");
            }

            $sponsor->fill([
                'edition_id' => $edition->id,
                'name' => $sponsorData['name'],
                'tier' => $sponsorData['tier'],
                'website' => $sponsorData['website'] ?? null,
                'logo_media_id' => $logo->id,
                'display_order' => $sponsorData['displayOrder'],
                'active' => true,
                'version' => 1,
            ]);
            $sponsor->save();
            $counts['sponsors']++;
        }

        $counts['mediaAssets'] = count($mediaIds);

        return $counts;
    }

    private function persistMedia(string $url, string $alt): MediaAsset
    {
        $path = $this->publicAssetPath($url);

        if ($path === null) {
            throw new \RuntimeException("Asset media tidak ditemukan: {$url}");
        }

        $mediaAsset = MediaAsset::query()->firstOrNew([
            'provider' => 'local',
            'provider_key' => $url,
        ]);

        if (! $mediaAsset->exists) {
            $mediaAsset->id = $this->stableUuid("public-media:asset:{$url}");
        }

        $mediaAsset->fill([
            'url' => $url,
            'filename' => basename($url),
            'mime_type' => mime_content_type($path) ?: 'application/octet-stream',
            'bytes' => (int) (filesize($path) ?: 0),
            'alt' => $alt,
            'decorative' => false,
            'lifecycle' => 'ready',
            'owner_user_id' => null,
        ]);
        $mediaAsset->save();

        return $mediaAsset;
    }

    private function resolveFixturePath(): string
    {
        $fixtureOption = $this->option('fixture');
        $fixturePath = is_string($fixtureOption) && $fixtureOption !== ''
            ? $fixtureOption
            : 'database/fixtures/public-media-2025.json';

        if (preg_match('~^[A-Za-z]:[\\\\/]~', $fixturePath) === 1 || str_starts_with($fixturePath, DIRECTORY_SEPARATOR)) {
            return $fixturePath;
        }

        return base_path($fixturePath);
    }

    private function publicAssetPath(string $url): ?string
    {
        if (! str_starts_with($url, '/') || str_starts_with($url, '//') || str_contains($url, '..')) {
            return null;
        }

        $path = public_path(ltrim($url, '/'));

        return is_file($path) ? $path : null;
    }

    private function isAllowedExternalUrl(string $url): bool
    {
        $scheme = parse_url($url, PHP_URL_SCHEME);

        return in_array($scheme, ['http', 'https'], true)
            && filter_var($url, FILTER_VALIDATE_URL) !== false;
    }

    private function isLocalRehearsalDatabase(): bool
    {
        $host = (string) config('database.connections.mysql.host');
        $database = (string) config('database.connections.mysql.database');

        return in_array($host, ['127.0.0.1', 'localhost'], true)
            && in_array($database, ['pamoka', 'pamoka_test'], true);
    }

    private function stableUuid(string $key): string
    {
        $hex = substr(hash('sha256', $key), 0, 32);

        return substr($hex, 0, 8).'-'.substr($hex, 8, 4).'-'.substr($hex, 12, 4).'-'.substr($hex, 16, 4).'-'.substr($hex, 20, 12);
    }
}

<?php

namespace App\Console\Commands;

use App\Models\Edition;
use App\Models\MediaAsset;
use App\Models\NewsArticle;
use Carbon\CarbonImmutable;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Throwable;

#[Signature('moka:import-news {--fixture=} {--apply : Write the validated snapshot to the configured database}')]
#[Description('Rehearse the stable 2025 news import')]
class ImportNews2025 extends Command
{
    private const ALLOWED_KINDS = ['file', 'internal', 'external'];

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
        $this->info('Import berita 2025 berhasil diterapkan.');
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

        $articles = $document['articles'] ?? null;

        if (! is_array($articles) || $articles === []) {
            $errors[] = 'Fixture harus memiliki minimal satu artikel.';

            return $errors;
        }

        $slugs = [];

        foreach ($articles as $index => $article) {
            if (! is_array($article)) {
                $errors[] = "Artikel pada index {$index} tidak valid.";

                continue;
            }

            $slug = $article['slug'] ?? null;

            if (! is_string($slug) || $slug === '') {
                $errors[] = "Artikel pada index {$index} tidak memiliki slug.";
            } elseif (in_array($slug, $slugs, true)) {
                $errors[] = "Slug artikel {$slug} duplikat.";
            } else {
                $slugs[] = $slug;
            }

            if (! is_string($article['title'] ?? null) || $article['title'] === '') {
                $errors[] = "Judul artikel {$slug} tidak valid.";
            }

            if (! in_array($article['kind'] ?? null, self::ALLOWED_KINDS, true)) {
                $errors[] = "Jenis artikel {$slug} tidak didukung.";
            }

            if (($article['status'] ?? null) !== 'published') {
                $errors[] = "Status artikel {$slug} harus published untuk snapshot publik.";
            }

            $sourceUrl = $article['sourceUrl'] ?? null;

            if (! is_string($sourceUrl) || ! $this->isAllowedUrl($sourceUrl)) {
                $errors[] = "sourceUrl artikel {$slug} harus berupa jalur lokal atau URL http(s).";
            }

            $cover = $article['cover'] ?? null;
            $coverUrl = is_array($cover) ? ($cover['url'] ?? null) : null;

            if (! is_string($coverUrl) || ! str_starts_with($coverUrl, '/')) {
                $errors[] = "Cover artikel {$slug} harus berupa jalur lokal.";
            } elseif (! is_file(public_path(ltrim($coverUrl, '/')))) {
                $errors[] = "Asset cover tidak ditemukan: {$coverUrl}.";
            }

            if (! is_array($cover) || ! is_string($cover['alt'] ?? null) || $cover['alt'] === '') {
                $errors[] = "Alt cover artikel {$slug} tidak valid.";
            }

            try {
                CarbonImmutable::parse((string) ($article['publishedAt'] ?? ''));
            } catch (Throwable) {
                $errors[] = "publishedAt artikel {$slug} tidak valid.";
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
        $coverUrls = [];
        $publishedCount = 0;

        foreach ($document['articles'] as $article) {
            $coverUrls[$article['cover']['url']] = true;
            $publishedCount += $article['status'] === 'published' ? 1 : 0;
        }

        return [
            'edisi' => 1,
            'artikel' => count($document['articles']),
            'artikel published' => $publishedCount,
            'cover media unik' => count($coverUrls),
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
            'articles' => 0,
            'mediaAssets' => 0,
        ];
        $mediaIds = [];

        foreach ($document['articles'] as $articleData) {
            $coverUrl = $articleData['cover']['url'];
            $assetPath = public_path(ltrim($coverUrl, '/'));
            $mediaAsset = MediaAsset::query()->firstOrNew([
                'provider' => 'local',
                'provider_key' => $coverUrl,
            ]);

            if (! $mediaAsset->exists) {
                $mediaAsset->id = $this->stableUuid("news-media:2025:{$coverUrl}");
            }

            $mediaAsset->fill([
                'url' => $coverUrl,
                'filename' => basename($coverUrl),
                'mime_type' => mime_content_type($assetPath) ?: 'application/octet-stream',
                'bytes' => (int) (filesize($assetPath) ?: 0),
                'alt' => $articleData['cover']['alt'],
                'decorative' => false,
                'lifecycle' => 'ready',
            ]);
            $mediaAsset->save();
            $mediaIds[$coverUrl] = $mediaAsset->id;

            $article = NewsArticle::query()->firstOrNew(['slug' => $articleData['slug']]);

            if (! $article->exists) {
                $article->id = $this->stableUuid("news-article:2025:{$articleData['slug']}");
            }

            $article->fill([
                'edition_id' => $edition->id,
                'title' => $articleData['title'],
                'excerpt' => $articleData['excerpt'] ?? null,
                'body' => $articleData['body'] ?? null,
                'body_json' => $articleData['bodyJson'] ?? null,
                'kind' => $articleData['kind'],
                'source_url' => $articleData['sourceUrl'],
                'cover_media_id' => $mediaAsset->id,
                'published_at' => CarbonImmutable::parse($articleData['publishedAt']),
                'status' => $articleData['status'],
                'version' => 1,
            ]);
            $article->save();
            $counts['articles']++;
        }

        $counts['mediaAssets'] = count($mediaIds);

        return $counts;
    }

    private function resolveFixturePath(): string
    {
        $fixtureOption = $this->option('fixture');
        $fixturePath = is_string($fixtureOption) && $fixtureOption !== ''
            ? $fixtureOption
            : 'database/fixtures/news-2025.json';

        if (preg_match('/^[A-Za-z]:[\\\\\/]/', $fixturePath) === 1 || str_starts_with($fixturePath, DIRECTORY_SEPARATOR)) {
            return $fixturePath;
        }

        return base_path($fixturePath);
    }

    private function isLocalRehearsalDatabase(): bool
    {
        $host = (string) config('database.connections.mysql.host');
        $database = (string) config('database.connections.mysql.database');

        return in_array($host, ['127.0.0.1', 'localhost'], true)
            && in_array($database, ['pamoka', 'pamoka_test'], true);
    }

    private function isAllowedUrl(string $url): bool
    {
        if (str_starts_with($url, '/') && ! str_starts_with($url, '//')) {
            return true;
        }

        $scheme = parse_url($url, PHP_URL_SCHEME);

        return in_array($scheme, ['http', 'https'], true)
            && filter_var($url, FILTER_VALIDATE_URL) !== false;
    }

    private function stableUuid(string $key): string
    {
        $hex = substr(hash('sha256', $key), 0, 32);

        return substr($hex, 0, 8).'-'.substr($hex, 8, 4).'-'.substr($hex, 12, 4).'-'.substr($hex, 16, 4).'-'.substr($hex, 20, 12);
    }
}

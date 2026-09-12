<?php

namespace App\Console\Commands;

use App\Models\Edition;
use App\Models\PageSection;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Throwable;

#[Signature('moka:import-page-sections {--fixture=} {--apply : Write the validated snapshot to the configured database}')]
#[Description('Rehearse the public page section snapshot import')]
class ImportPageSections2025 extends Command
{
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

        $this->table(['Metrik', 'Nilai'], [
            ['edisi', 1],
            ['section halaman', count($document['sections'])],
            ['section published', count(array_filter($document['sections'], static fn (array $section): bool => $section['status'] === 'published'))],
        ]);

        if (! $this->option('apply')) {
            $this->warn('Dry run selesai. Tidak ada perubahan database.');

            return self::SUCCESS;
        }

        if (! $this->isLocalRehearsalDatabase()) {
            $this->error('Apply diblokir. Command ini hanya boleh menulis ke database MySQL lokal pamoka atau pamoka_test.');

            return self::FAILURE;
        }

        $result = DB::transaction(fn (): array => $this->persist($document));
        $this->info('Import section halaman publik berhasil diterapkan.');
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

        $sections = $document['sections'] ?? null;
        if (! is_array($sections) || $sections === []) {
            $errors[] = 'Fixture harus memiliki minimal satu section halaman.';

            return $errors;
        }

        $keys = [];

        foreach ($sections as $index => $section) {
            if (! is_array($section)) {
                $errors[] = "Section pada index {$index} tidak valid.";

                continue;
            }

            $pageKey = $section['pageKey'] ?? null;
            $sectionKey = $section['sectionKey'] ?? null;
            $key = is_string($pageKey) && is_string($sectionKey) ? "{$pageKey}:{$sectionKey}" : null;

            if (! is_string($pageKey) || preg_match('/^[a-z0-9-]+$/', $pageKey) !== 1) {
                $errors[] = "pageKey section pada index {$index} tidak valid.";
            }

            if (! is_string($sectionKey) || preg_match('/^[a-z0-9-]+$/', $sectionKey) !== 1) {
                $errors[] = "sectionKey pada index {$index} tidak valid.";
            }

            if ($key !== null && in_array($key, $keys, true)) {
                $errors[] = "Section {$key} duplikat.";
            } elseif ($key !== null) {
                $keys[] = $key;
            }

            if (array_key_exists('title', $section) && $section['title'] !== null
                && (! is_string($section['title']) || mb_strlen($section['title']) > 200)) {
                $errors[] = "Title section {$key} tidak valid.";
            }

            if (array_key_exists('eyebrow', $section) && $section['eyebrow'] !== null
                && (! is_string($section['eyebrow']) || mb_strlen($section['eyebrow']) > 120)) {
                $errors[] = "Eyebrow section {$key} tidak valid.";
            }

            if (array_key_exists('body', $section) && $section['body'] !== null
                && (! is_string($section['body']) || mb_strlen($section['body']) > 20_000)) {
                $errors[] = "Body section {$key} tidak valid.";
            }

            if (! is_array($section['presentation'] ?? null)) {
                $errors[] = "Presentation section {$key} harus berupa object JSON.";
            }

            if (! in_array($section['status'] ?? null, ['draft', 'published'], true)) {
                $errors[] = "Status section {$key} tidak didukung.";
            }
        }

        return $errors;
    }

    /**
     * @param  array<string, mixed>  $document
     * @return array{sections: int}
     */
    private function persist(array $document): array
    {
        $editionData = $document['edition'];
        $edition = Edition::query()->firstOrNew(['year' => $editionData['year']]);
        $edition->fill([
            'slug' => $editionData['slug'],
            'name' => 'Pasanggiri Mojang Jajaka Garut 2025',
            'timezone' => 'Asia/Jakarta',
            'lifecycle' => 'active',
        ]);
        $edition->save();

        foreach ($document['sections'] as $sectionData) {
            $section = PageSection::query()->firstOrNew([
                'edition_id' => $edition->id,
                'page_key' => $sectionData['pageKey'],
                'section_key' => $sectionData['sectionKey'],
            ]);

            if (! $section->exists) {
                $section->id = $this->stableUuid("page-section:2025:{$sectionData['pageKey']}:{$sectionData['sectionKey']}");
            }

            $section->fill([
                'title' => $sectionData['title'] ?? null,
                'eyebrow' => $sectionData['eyebrow'] ?? null,
                'body' => $sectionData['body'] ?? null,
                'presentation_json' => $sectionData['presentation'],
                'status' => $sectionData['status'],
                'version' => 1,
            ]);
            $section->save();
        }

        return ['sections' => count($document['sections'])];
    }

    private function resolveFixturePath(): string
    {
        $fixtureOption = $this->option('fixture');
        $fixturePath = is_string($fixtureOption) && $fixtureOption !== ''
            ? $fixtureOption
            : 'database/fixtures/page-sections-2025.json';

        if (preg_match('~^[A-Za-z]:[\\\\/]~', $fixturePath) === 1 || str_starts_with($fixturePath, DIRECTORY_SEPARATOR)) {
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

    private function stableUuid(string $key): string
    {
        $hex = substr(hash('sha256', $key), 0, 32);

        return substr($hex, 0, 8).'-'.substr($hex, 8, 4).'-'.substr($hex, 12, 4).'-'.substr($hex, 16, 4).'-'.substr($hex, 20, 12);
    }
}

<?php

namespace App\Console\Commands;

use App\Models\Edition;
use App\Models\EditionProgram;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Throwable;

#[Signature('moka:import-edition-settings {--fixture=} {--apply : Write the validated snapshot to the configured database}')]
#[Description('Rehearse the public edition identity and program snapshot import')]
class ImportEditionSettings2025 extends Command
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
            ['program unggulan', count($document['programs'])],
            ['program aktif', count(array_filter($document['programs'], static fn (array $program): bool => $program['active']))],
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
        $this->info('Import identitas edisi publik berhasil diterapkan.');
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

        if (! is_array($edition) || ! is_string($edition['name'] ?? null) || $edition['name'] === '') {
            $errors[] = 'Nama edisi pada fixture tidak valid.';
        }

        if (! is_array($edition) || ! is_string($edition['timezone'] ?? null) || $edition['timezone'] === '') {
            $errors[] = 'Timezone edisi pada fixture tidak valid.';
        }

        if (! is_array($edition) || ! in_array($edition['lifecycle'] ?? null, ['draft', 'active', 'archived'], true)) {
            $errors[] = 'Lifecycle edisi pada fixture tidak didukung.';
        }

        if (! is_array($edition) || ! is_string($edition['slogan'] ?? null) || mb_strlen($edition['slogan']) > 160) {
            $errors[] = 'Slogan edisi pada fixture tidak valid.';
        }

        $programs = $document['programs'] ?? null;
        if (! is_array($programs) || $programs === []) {
            $errors[] = 'Fixture harus memiliki minimal satu program unggulan.';

            return $errors;
        }

        $orders = [];
        foreach ($programs as $index => $program) {
            if (! is_array($program)) {
                $errors[] = "Program pada index {$index} tidak valid.";

                continue;
            }

            if (! is_string($program['title'] ?? null) || trim($program['title']) === '' || mb_strlen($program['title']) > 255) {
                $errors[] = "Judul program pada index {$index} tidak valid.";
            }

            if (array_key_exists('description', $program) && $program['description'] !== null
                && (! is_string($program['description']) || mb_strlen($program['description']) > 65_535)) {
                $errors[] = "Deskripsi program pada index {$index} tidak valid.";
            }

            if (! is_int($program['displayOrder'] ?? null) || $program['displayOrder'] < 0) {
                $errors[] = "Urutan program pada index {$index} tidak valid.";
            } elseif (in_array($program['displayOrder'], $orders, true)) {
                $errors[] = "Urutan program {$program['displayOrder']} duplikat.";
            } else {
                $orders[] = $program['displayOrder'];
            }

            if (! is_bool($program['active'] ?? null)) {
                $errors[] = "Status program pada index {$index} tidak valid.";
            }
        }

        return $errors;
    }

    /**
     * @param  array<string, mixed>  $document
     * @return array{edition: int, programs: int}
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
            'slogan' => $editionData['slogan'],
        ]);
        $edition->save();

        foreach ($document['programs'] as $programData) {
            $program = EditionProgram::query()->firstOrNew([
                'edition_id' => $edition->id,
                'display_order' => $programData['displayOrder'],
            ]);
            if (! $program->exists) {
                $program->id = $this->stableUuid("edition-program:2025:{$programData['displayOrder']}");
            }
            $program->fill([
                'edition_id' => $edition->id,
                'title' => trim($programData['title']),
                'description' => $programData['description'] ?? null,
                'display_order' => $programData['displayOrder'],
                'active' => $programData['active'],
            ]);
            $program->save();
        }

        return ['edition' => 1, 'programs' => count($document['programs'])];
    }

    private function resolveFixturePath(): string
    {
        $fixtureOption = $this->option('fixture');
        $fixturePath = is_string($fixtureOption) && $fixtureOption !== ''
            ? $fixtureOption
            : 'database/fixtures/edition-settings-2025.json';

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

<?php

namespace App\Console\Commands;

use App\Models\MediaAsset;
use App\Models\OrganizationAssignment;
use App\Models\Person;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Throwable;

#[Signature('moka:import-public-organization {--fixture=} {--apply : Write the validated snapshot to the configured database}')]
#[Description('Rehearse the public organization snapshot import')]
class ImportPublicOrganization extends Command
{
    private const ALLOWED_GROUPS = ['leadership', 'past_leaders'];

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
        $this->info('Import organisasi publik berhasil diterapkan.');
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

        $people = $document['people'] ?? null;
        $assignments = $document['assignments'] ?? null;

        if (! is_array($people) || $people === []) {
            $errors[] = 'Fixture harus memiliki minimal satu profil orang.';
        }

        if (! is_array($assignments) || $assignments === []) {
            $errors[] = 'Fixture harus memiliki minimal satu penugasan organisasi.';
        }

        if ($errors !== []) {
            return $errors;
        }

        $slugs = [];

        foreach ($people as $index => $person) {
            if (! is_array($person)) {
                $errors[] = "Profil orang pada index {$index} tidak valid.";

                continue;
            }

            $slug = $person['slug'] ?? null;

            if (! is_string($slug) || $slug === '') {
                $errors[] = "Profil orang pada index {$index} tidak memiliki slug.";
            } elseif (in_array($slug, $slugs, true)) {
                $errors[] = "Slug profil {$slug} duplikat.";
            } else {
                $slugs[] = $slug;
            }

            if (! is_string($person['name'] ?? null) || $person['name'] === '') {
                $errors[] = "Nama profil {$slug} tidak valid.";
            }

            if (! in_array($person['gender'] ?? null, ['L', 'P'], true)) {
                $errors[] = "Gender profil {$slug} harus L atau P.";
            }

            $portrait = $person['portrait'] ?? null;

            if (! is_string($portrait) || ! str_starts_with($portrait, '/') || str_starts_with($portrait, '//')) {
                $errors[] = "Portrait profil {$slug} harus berupa jalur lokal.";
            } elseif (! is_file(public_path(ltrim($portrait, '/')))) {
                $errors[] = "Asset portrait tidak ditemukan: {$portrait}.";
            }
        }

        $groupCounts = array_fill_keys(self::ALLOWED_GROUPS, 0);
        $assignmentKeys = [];

        foreach ($assignments as $index => $assignment) {
            if (! is_array($assignment)) {
                $errors[] = "Penugasan pada index {$index} tidak valid.";

                continue;
            }

            $personSlug = $assignment['personSlug'] ?? null;
            $group = $assignment['group'] ?? null;
            $title = $assignment['title'] ?? null;
            $displayOrder = $assignment['displayOrder'] ?? null;

            if (! is_string($personSlug) || ! in_array($personSlug, $slugs, true)) {
                $errors[] = "Penugasan pada index {$index} merujuk ke profil yang tidak dikenal.";
            }

            if (! is_string($group) || ! in_array($group, self::ALLOWED_GROUPS, true)) {
                $errors[] = "Kelompok penugasan pada index {$index} tidak didukung.";
            } else {
                $groupCounts[$group]++;
            }

            if (! is_string($title) || $title === '') {
                $errors[] = "Jabatan pada index {$index} tidak valid.";
            }

            if (! is_int($displayOrder) || $displayOrder < 1) {
                $errors[] = "Urutan penugasan pada index {$index} harus bilangan positif.";
            }

            $assignmentKey = is_string($personSlug) && is_string($group)
                ? "{$group}:{$personSlug}"
                : null;

            if ($assignmentKey !== null && in_array($assignmentKey, $assignmentKeys, true)) {
                $errors[] = "Penugasan {$assignmentKey} duplikat.";
            } elseif ($assignmentKey !== null) {
                $assignmentKeys[] = $assignmentKey;
            }
        }

        if ($groupCounts['leadership'] !== 16) {
            $errors[] = 'Fixture harus memiliki 16 pengurus aktif.';
        }

        if ($groupCounts['past_leaders'] !== 5) {
            $errors[] = 'Fixture harus memiliki 5 ketua lintas masa.';
        }

        return $errors;
    }

    /**
     * @param  array<string, mixed>  $document
     * @return array<string, int>
     */
    private function summarize(array $document): array
    {
        $portraits = [];

        foreach ($document['people'] as $person) {
            $portraits[$person['portrait']] = true;
        }

        return [
            'profil orang' => count($document['people']),
            'penugasan organisasi' => count($document['assignments']),
            'portrait media unik' => count($portraits),
        ];
    }

    /**
     * @param  array<string, mixed>  $document
     * @return array<string, int>
     */
    private function persist(array $document): array
    {
        $peopleBySlug = [];
        $mediaIds = [];

        foreach ($document['people'] as $personData) {
            $portrait = $personData['portrait'];
            $assetPath = public_path(ltrim($portrait, '/'));
            $mediaAsset = MediaAsset::query()->firstOrNew([
                'provider' => 'local',
                'provider_key' => $portrait,
            ]);

            if (! $mediaAsset->exists) {
                $mediaAsset->id = $this->stableUuid("organization-media:{$portrait}");
            }

            $mediaAsset->fill([
                'url' => $portrait,
                'filename' => basename($portrait),
                'mime_type' => mime_content_type($assetPath) ?: 'application/octet-stream',
                'bytes' => (int) (filesize($assetPath) ?: 0),
                'alt' => $personData['name'],
                'decorative' => false,
                'lifecycle' => 'ready',
            ]);
            $mediaAsset->save();
            $mediaIds[$portrait] = $mediaAsset->id;

            $person = Person::query()->firstOrNew(['slug' => $personData['slug']]);

            if (! $person->exists) {
                $person->id = $this->stableUuid("organization-person:{$personData['slug']}");
            }

            $person->fill([
                'name' => $personData['name'],
                'gender' => $personData['gender'],
                'portrait_media_id' => $mediaAsset->id,
                'version' => 1,
            ]);
            $person->save();
            $peopleBySlug[$personData['slug']] = $person->id;
        }

        foreach ($document['assignments'] as $assignmentData) {
            $assignmentId = $this->stableUuid("organization-assignment:{$assignmentData['group']}:{$assignmentData['personSlug']}");
            $assignment = OrganizationAssignment::query()->find($assignmentId);

            if ($assignment === null) {
                $assignment = new OrganizationAssignment;
                $assignment->id = $assignmentId;
            }

            $assignment->fill([
                'edition_id' => null,
                'person_id' => $peopleBySlug[$assignmentData['personSlug']],
                'title' => $assignmentData['title'],
                'group' => $assignmentData['group'],
                'term_label' => $assignmentData['termLabel'] ?? null,
                'display_order' => $assignmentData['displayOrder'],
                'active' => $assignmentData['active'],
            ]);
            $assignment->save();
        }

        return [
            'people' => count($peopleBySlug),
            'assignments' => count($document['assignments']),
            'mediaAssets' => count($mediaIds),
        ];
    }

    private function resolveFixturePath(): string
    {
        $fixtureOption = $this->option('fixture');
        $fixturePath = is_string($fixtureOption) && $fixtureOption !== ''
            ? $fixtureOption
            : 'database/fixtures/organization-public-snapshot.json';

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

    private function stableUuid(string $key): string
    {
        $hex = substr(hash('sha256', $key), 0, 32);

        return substr($hex, 0, 8).'-'.substr($hex, 8, 4).'-'.substr($hex, 12, 4).'-'.substr($hex, 16, 4).'-'.substr($hex, 20, 12);
    }
}

<?php

namespace App\Console\Commands;

use App\Enums\ParticipantMediaRole;
use App\Enums\StageDecision;
use App\Models\Category;
use App\Models\Edition;
use App\Models\MediaAsset;
use App\Models\Participant;
use App\Models\ParticipantAchievement;
use App\Models\ParticipantMedia;
use App\Models\ParticipantStageEntry;
use App\Models\SelectionStage;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Throwable;

#[Signature('moka:import-participants {--fixture=} {--apply : Write the validated snapshot to the configured database}')]
#[Description('Rehearse the 2025 hardcoded participant import')]
class ImportParticipants2025 extends Command
{
    private const EXPECTED_CATEGORY_CODES = ['JD', 'JR', 'MD', 'MR'];

    private const EXPECTED_STAGE_KEYS = ['semifinal', 'final'];

    /**
     * Execute the console command.
     */
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
        $this->info('Import rehearsal 2025 berhasil diterapkan.');
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

        $categories = $document['categories'] ?? null;

        if (! is_array($categories) || count($categories) !== 4) {
            $errors[] = 'Fixture harus memiliki tepat 4 kategori.';

            return $errors;
        }

        $categoryCodes = [];
        $referenceStages = null;

        foreach ($categories as $categoryIndex => $category) {
            if (! is_array($category)) {
                $errors[] = "Kategori pada index {$categoryIndex} tidak valid.";

                continue;
            }

            $code = $category['code'] ?? null;
            $categoryCodes[] = $code;

            if (! in_array($code, self::EXPECTED_CATEGORY_CODES, true)) {
                $errors[] = "Kode kategori tidak didukung: {$code}.";
            }

            $stages = $category['stages'] ?? null;

            if (! is_array($stages)) {
                $errors[] = "Stages kategori {$code} tidak valid.";
            } elseif ($referenceStages === null) {
                $referenceStages = $this->normalizeStageDefinitions($stages);
            } elseif (json_encode($referenceStages) !== json_encode($this->normalizeStageDefinitions($stages))) {
                $errors[] = "Definisi stages kategori {$code} berbeda dari kategori pertama.";
            }

            $participants = $category['participants'] ?? null;

            if (! is_array($participants) || $participants === []) {
                $errors[] = "Kategori {$code} tidak memiliki peserta.";

                continue;
            }

            $participantKeys = [];

            foreach ($participants as $participantIndex => $participant) {
                if (! is_array($participant)) {
                    $errors[] = "Peserta {$code} pada index {$participantIndex} tidak valid.";

                    continue;
                }

                $participantKey = $participant['slug'] ?? null;

                if (! is_string($participantKey) || $participantKey === '') {
                    $errors[] = "Peserta {$code} pada index {$participantIndex} tidak memiliki slug.";
                } elseif (in_array($participantKey, $participantKeys, true)) {
                    $errors[] = "Slug peserta {$code}/{$participantKey} duplikat.";
                } else {
                    $participantKeys[] = $participantKey;
                }

                if (! in_array($participant['stage'] ?? null, self::EXPECTED_STAGE_KEYS, true)) {
                    $errors[] = "Stage peserta {$code}/{$participantKey} tidak valid.";
                }

                $media = $participant['media'] ?? null;
                $mediaUrl = is_array($media) ? ($media['url'] ?? null) : null;
                $sourcePath = is_array($media) ? ($media['sourcePath'] ?? null) : null;

                if (! is_string($mediaUrl) || ! str_starts_with($mediaUrl, '/')) {
                    $errors[] = "URL media peserta {$code}/{$participantKey} tidak valid.";
                } elseif (! is_file(public_path(ltrim($mediaUrl, '/')))) {
                    $errors[] = "Asset target tidak ditemukan: {$mediaUrl}.";
                }

                if (! is_string($sourcePath) || ! is_file($this->sourceRootPath($sourcePath))) {
                    $errors[] = "Asset source tidak ditemukan: {$sourcePath}.";
                }

                if (! is_array($participant['achievements'] ?? null)) {
                    $errors[] = "Prestasi peserta {$code}/{$participantKey} tidak valid.";
                }
            }
        }

        sort($categoryCodes);

        if ($categoryCodes !== self::EXPECTED_CATEGORY_CODES) {
            $errors[] = 'Fixture harus memuat kategori JD, MD, JR, dan MR tepat satu kali.';
        }

        if (! is_array($document['titles'] ?? null)) {
            $errors[] = 'Field titles fixture harus berupa array.';
        }

        return $errors;
    }

    /**
     * @param  array<int, mixed>  $stages
     * @return list<array<string, mixed>>
     */
    private function normalizeStageDefinitions(array $stages): array
    {
        return array_map(
            static fn (array $stage): array => [
                'key' => $stage['key'] ?? null,
                'name' => $stage['name'] ?? null,
                'slug' => $stage['slug'] ?? null,
                'displayOrder' => $stage['displayOrder'] ?? null,
                'finalStage' => $stage['finalStage'] ?? null,
            ],
            $stages,
        );
    }

    /**
     * @param  array<string, mixed>  $document
     * @return array<string, int>
     */
    private function summarize(array $document): array
    {
        $participantCount = 0;
        $finalistCount = 0;
        $semifinalistOnlyCount = 0;
        $achievementCount = 0;
        $mediaPaths = [];
        $semifinalMembershipCount = 0;

        foreach ($document['categories'] as $category) {
            $semifinalMembershipCount += $this->stageTargetCount($category['stages'], 'semifinal');

            foreach ($category['participants'] as $participant) {
                $participantCount++;
                $achievementCount += count($participant['achievements']);
                $mediaPaths[$participant['media']['sourcePath']] = true;

                if ($participant['stage'] === 'final') {
                    $finalistCount++;
                } else {
                    $semifinalistOnlyCount++;
                }
            }
        }

        return [
            'kategori' => count($document['categories']),
            'record peserta' => $participantCount,
            'keanggotaan semifinal source' => $semifinalMembershipCount,
            'finalis current stage' => $finalistCount,
            'semifinalis only current stage' => $semifinalistOnlyCount,
            'stage entries' => $semifinalMembershipCount + $finalistCount,
            'prestasi' => $achievementCount,
            'media unik' => count($mediaPaths),
            'gelar source' => count($document['titles']),
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

        $stageTotals = ['semifinal' => 0, 'final' => 0];

        foreach ($document['categories'] as $category) {
            $stageTotals['semifinal'] += $this->stageTargetCount($category['stages'], 'semifinal');

            foreach ($category['participants'] as $participant) {
                if ($participant['stage'] === 'final') {
                    $stageTotals['final']++;
                }
            }
        }

        $stages = [];
        $stageDefinitions = $document['categories'][0]['stages'];

        foreach ($stageDefinitions as $stageData) {
            $stage = SelectionStage::query()->updateOrCreate(
                ['edition_id' => $edition->id, 'slug' => $stageData['slug']],
                [
                    'name' => $stageData['name'],
                    'display_order' => $stageData['displayOrder'],
                    'target_participant_count' => $stageTotals[$stageData['key']],
                    'lifecycle' => 'active',
                    'final_stage' => $stageData['finalStage'],
                ],
            );
            $stages[$stageData['key']] = $stage;
        }

        $counts = [
            'editions' => 1,
            'categories' => 0,
            'stages' => count($stages),
            'participants' => 0,
            'stageEntries' => 0,
            'achievements' => 0,
            'mediaAssets' => 0,
            'participantMedia' => 0,
        ];
        $mediaIds = [];

        foreach ($document['categories'] as $categoryData) {
            $category = Category::query()->updateOrCreate(
                ['edition_id' => $edition->id, 'code' => $categoryData['code']],
                [
                    'slug' => $categoryData['slug'],
                    'label' => $categoryData['label'],
                    'display_order' => $categoryData['displayOrder'],
                    'active' => true,
                ],
            );
            $counts['categories']++;

            foreach ($categoryData['participants'] as $participantData) {
                $stage = $stages[$participantData['stage']];
                $participant = Participant::query()->firstOrNew([
                    'edition_id' => $edition->id,
                    'category_id' => $category->id,
                    'slug' => $participantData['slug'],
                ]);
                $participant->fill([
                    'stage' => $participantData['stage'],
                    'current_stage_id' => $stage->id,
                    'selection_status' => $participantData['stage'] === 'final' ? 'active' : 'eliminated',
                    'number' => $participantData['number'],
                    'name' => $participantData['name'],
                    'bio' => $participantData['bio'],
                    'display_order' => $participantData['displayOrder'],
                    'active' => true,
                ]);
                $participant->save();
                $counts['participants']++;

                foreach ($participantData['achievements'] as $achievementIndex => $text) {
                    $achievement = ParticipantAchievement::query()->firstOrNew([
                        'participant_id' => $participant->id,
                        'display_order' => $achievementIndex,
                    ]);

                    if (! $achievement->exists) {
                        $achievement->id = $this->stableUuid("achievement:2025:{$categoryData['code']}:{$participantData['slug']}:{$achievementIndex}");
                    }

                    $achievement->fill(['text' => $text]);
                    $achievement->save();
                    $counts['achievements']++;
                }

                $mediaUrl = $participantData['media']['url'];
                $assetPath = public_path(ltrim($mediaUrl, '/'));
                $mediaAsset = MediaAsset::query()->updateOrCreate(
                    ['provider' => 'local', 'provider_key' => $mediaUrl],
                    [
                        'url' => $mediaUrl,
                        'filename' => basename($mediaUrl),
                        'mime_type' => mime_content_type($assetPath) ?: 'image/webp',
                        'bytes' => filesize($assetPath),
                        'alt' => $participantData['media']['alt'],
                        'decorative' => false,
                        'lifecycle' => 'ready',
                    ],
                );
                $mediaIds[$mediaUrl] = $mediaAsset->id;
                $counts['mediaAssets']++;

                $participantMedia = ParticipantMedia::query()->firstOrNew([
                    'participant_id' => $participant->id,
                    'role' => ParticipantMediaRole::Closeup,
                ]);

                if (! $participantMedia->exists) {
                    $participantMedia->id = $this->stableUuid("participant-media:2025:{$categoryData['code']}:{$participantData['slug']}");
                }

                $participantMedia->fill([
                    'media_asset_id' => $mediaAsset->id,
                    'caption' => null,
                    'display_order' => 0,
                    'active' => true,
                ]);
                $participantMedia->save();
                $counts['participantMedia']++;

                $this->upsertStageEntry(
                    $participant,
                    $stages['semifinal'],
                    $participantData['stage'] === 'final' ? StageDecision::Advanced : StageDecision::Eliminated,
                    'semifinal',
                );
                $counts['stageEntries']++;

                if ($participantData['stage'] === 'final') {
                    $this->upsertStageEntry($participant, $stages['final'], StageDecision::Pending, 'final');
                    $counts['stageEntries']++;
                }
            }
        }

        $counts['mediaAssets'] = count($mediaIds);

        return $counts;
    }

    private function upsertStageEntry(
        Participant $participant,
        SelectionStage $stage,
        StageDecision $decision,
        string $stageKey,
    ): void {
        $entry = ParticipantStageEntry::query()->firstOrNew([
            'participant_id' => $participant->id,
            'stage_id' => $stage->id,
        ]);

        if (! $entry->exists) {
            $entry->id = $this->stableUuid("stage-entry:2025:{$participant->id}:{$stageKey}");
        }

        $entry->fill([
            'decision' => $decision,
            'decided_at' => null,
            'decided_by_user_id' => null,
            'reason' => null,
            'version' => 1,
        ]);
        $entry->save();
    }

    private function resolveFixturePath(): string
    {
        $fixtureOption = $this->option('fixture');
        $fixturePath = is_string($fixtureOption) && $fixtureOption !== ''
            ? $fixtureOption
            : 'database/fixtures/participants-2025.json';

        if (preg_match('/^[A-Za-z]:[\\\\\/]/', $fixturePath) === 1 || str_starts_with($fixturePath, DIRECTORY_SEPARATOR)) {
            return $fixturePath;
        }

        return base_path($fixturePath);
    }

    private function sourceRootPath(string $sourcePath): string
    {
        return dirname(base_path()).DIRECTORY_SEPARATOR.str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $sourcePath);
    }

    private function isLocalRehearsalDatabase(): bool
    {
        $host = (string) config('database.connections.mysql.host');
        $database = (string) config('database.connections.mysql.database');

        return in_array($host, ['127.0.0.1', 'localhost'], true)
            && in_array($database, ['pamoka', 'pamoka_test'], true);
    }

    private function stageTargetCount(array $stages, string $key): int
    {
        foreach ($stages as $stage) {
            if (($stage['key'] ?? null) === $key) {
                return (int) ($stage['targetParticipantCount'] ?? 0);
            }
        }

        return 0;
    }

    private function stableUuid(string $key): string
    {
        $hex = substr(hash('sha256', $key), 0, 32);

        return substr($hex, 0, 8).'-'.substr($hex, 8, 4).'-'.substr($hex, 12, 4).'-'.substr($hex, 16, 4).'-'.substr($hex, 20, 12);
    }
}

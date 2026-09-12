<?php

namespace App\Console\Commands;

use App\Enums\CategoryCode;
use App\Models\Edition;
use App\Models\MediaAsset;
use App\Models\Participant;
use App\Models\SelectionStage;
use App\Models\VotingCampaign;
use Carbon\CarbonImmutable;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Throwable;

#[Signature('moka:import-voting {--fixture=} {--apply : Write the validated snapshot to the configured database}')]
#[Description('Rehearse the 2025 public voting import')]
class ImportVoting2025 extends Command
{
    private const EXPECTED_CATEGORY_CODES = ['JD', 'JR', 'MD', 'MR'];

    public function handle(): int
    {
        $fixturePath = $this->resolveFixturePath();

        if (! is_file($fixturePath)) {
            $this->error("Fixture tidak ditemukan: {$fixturePath}");

            return self::FAILURE;
        }

        try {
            $document = $this->readJson($fixturePath);
            $participantDocument = $this->readJson($this->resolveParticipantFixturePath($document));
        } catch (Throwable $exception) {
            $this->error($exception->getMessage());

            return self::FAILURE;
        }

        $errors = $this->validateFixture($document, $participantDocument);

        if ($errors !== []) {
            foreach ($errors as $error) {
                $this->error($error);
            }

            return self::FAILURE;
        }

        $summary = $this->summarize($document, $participantDocument);
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

        try {
            $result = DB::transaction(fn (): array => $this->persist($document, $participantDocument));
        } catch (Throwable $exception) {
            $this->error($exception->getMessage());

            return self::FAILURE;
        }

        $this->info('Import voting publik berhasil diterapkan.');
        $this->line(json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

        return self::SUCCESS;
    }

    /**
     * @return array<string, mixed>
     */
    private function readJson(string $path): array
    {
        $contents = file_get_contents($path);

        if ($contents === false) {
            throw new \RuntimeException("Fixture tidak dapat dibaca: {$path}");
        }

        $document = json_decode($contents, true, 512, JSON_THROW_ON_ERROR);

        if (! is_array($document)) {
            throw new \RuntimeException("Format fixture harus berupa object JSON: {$path}");
        }

        return $document;
    }

    /**
     * @param  array<string, mixed>  $document
     * @param  array<string, mixed>  $participantDocument
     * @return list<string>
     */
    private function validateFixture(array $document, array $participantDocument): array
    {
        $errors = [];

        if (($document['schemaVersion'] ?? null) !== 1) {
            $errors[] = 'schemaVersion fixture voting harus bernilai 1.';
        }

        $edition = $document['edition'] ?? null;
        if (! is_array($edition) || ($edition['year'] ?? null) !== 2025 || ($edition['slug'] ?? null) !== '2025') {
            $errors[] = 'Fixture voting harus memiliki edisi 2025 dengan slug 2025.';
        }

        $campaign = $document['campaign'] ?? null;
        if (! is_array($campaign)) {
            $errors[] = 'Fixture voting harus memiliki object campaign.';
        } else {
            $errors = [...$errors, ...$this->validateCampaign($campaign)];
        }

        if (($document['candidateStage'] ?? null) !== 'final') {
            $errors[] = 'candidateStage fixture voting harus bernilai final.';
        }

        if (($document['qrisRoot'] ?? null) !== '/qr' || ($document['qrisNaming'] ?? null) !== 'name_underscores') {
            $errors[] = 'Fixture voting harus memakai asset QR lokal dengan pola name_underscores.';
        }

        $dates = $document['tallyDates'] ?? null;
        if (! is_array($dates) || count($dates) !== 13) {
            $errors[] = 'Fixture voting harus memiliki 13 tanggal tally.';
        } else {
            $sortedDates = $dates;
            sort($sortedDates);

            if ($sortedDates !== $dates || count(array_unique($dates, SORT_STRING)) !== count($dates)) {
                $errors[] = 'Tanggal tally harus urut dan tidak duplikat.';
            }

            foreach ($dates as $date) {
                if (! is_string($date) || ! $this->isLocalDate($date)) {
                    $errors[] = "Tanggal tally tidak valid: {$date}.";
                }
            }
        }

        if (! is_int($document['tallyAmount'] ?? null) || $document['tallyAmount'] < 0) {
            $errors[] = 'tallyAmount harus berupa bilangan bulat nol atau lebih.';
        }

        $candidates = $this->candidateRows($document, $participantDocument);
        if (count($candidates) !== 44) {
            $errors[] = 'Fixture peserta voting harus menghasilkan tepat 44 finalis.';
        }

        $categoryCodes = array_values(array_unique(array_map(
            static fn (array $candidate): string => $candidate['categoryCode'],
            $candidates,
        )));
        sort($categoryCodes);
        $expectedCodes = self::EXPECTED_CATEGORY_CODES;
        sort($expectedCodes);

        if ($categoryCodes !== $expectedCodes) {
            $errors[] = 'Fixture peserta voting harus memuat kategori JD, MD, JR, dan MR.';
        }

        $candidateKeys = [];
        foreach ($candidates as $candidate) {
            $key = $candidate['categoryCode'].':'.$candidate['slug'];
            if (in_array($key, $candidateKeys, true)) {
                $errors[] = "Kandidat voting duplikat: {$key}.";
            }
            $candidateKeys[] = $key;

            if (! is_file(public_path(ltrim($candidate['qrisPath'], '/')))) {
                $errors[] = "Asset QR tidak ditemukan: {$candidate['qrisPath']}.";
            }
        }

        return array_values(array_unique($errors));
    }

    /**
     * @param  array<string, mixed>  $campaign
     * @return list<string>
     */
    private function validateCampaign(array $campaign): array
    {
        $errors = [];

        foreach (['name', 'slug', 'timezone', 'startsAt', 'endsAt', 'startedAt', 'closedAt'] as $field) {
            if (! is_string($campaign[$field] ?? null) || $campaign[$field] === '') {
                $errors[] = "Field campaign {$field} tidak valid.";
            }
        }

        if (! in_array($campaign['status'] ?? null, ['draft', 'active', 'closed'], true)) {
            $errors[] = 'Status campaign tidak didukung.';
        }

        if (! in_array($campaign['resultVisibility'] ?? null, ['hidden', 'visible'], true)) {
            $errors[] = 'resultVisibility campaign tidak didukung.';
        }

        if (! is_int($campaign['pricePerPoint'] ?? null) || $campaign['pricePerPoint'] < 0) {
            $errors[] = 'pricePerPoint campaign harus berupa bilangan bulat nol atau lebih.';
        }

        $startsAt = $this->parseDate($campaign['startsAt'] ?? null);
        $endsAt = $this->parseDate($campaign['endsAt'] ?? null);

        if ($startsAt === null || $endsAt === null) {
            $errors[] = 'Tanggal mulai dan selesai campaign harus dapat dibaca.';
        } elseif ($endsAt->lessThanOrEqualTo($startsAt)) {
            $errors[] = 'Tanggal selesai campaign harus setelah tanggal mulai.';
        }

        foreach (['startedAt', 'closedAt'] as $field) {
            if ($this->parseDate($campaign[$field] ?? null) === null) {
                $errors[] = "Tanggal {$field} campaign harus dapat dibaca.";
            }
        }

        return $errors;
    }

    /**
     * @param  array<string, mixed>  $document
     * @param  array<string, mixed>  $participantDocument
     * @return list<array{categoryCode: string, categorySlug: string, name: string, slug: string, number: int, qrisPath: string}>
     */
    private function candidateRows(array $document, array $participantDocument): array
    {
        $rows = [];
        $qrisRoot = is_string($document['qrisRoot'] ?? null) ? rtrim($document['qrisRoot'], '/') : '/qr';

        foreach ($participantDocument['categories'] ?? [] as $category) {
            if (! is_array($category) || ! is_string($category['code'] ?? null) || ! is_string($category['slug'] ?? null)) {
                continue;
            }

            foreach ($category['participants'] ?? [] as $participant) {
                if (! is_array($participant) || ($participant['stage'] ?? null) !== ($document['candidateStage'] ?? 'final')) {
                    continue;
                }

                $name = $participant['name'] ?? null;
                $slug = $participant['slug'] ?? null;
                $number = $participant['number'] ?? null;

                if (! is_string($name) || ! is_string($slug) || ! is_int($number)) {
                    continue;
                }

                $rows[] = [
                    'categoryCode' => $category['code'],
                    'categorySlug' => $category['slug'],
                    'name' => $name,
                    'slug' => $slug,
                    'number' => $number,
                    'qrisPath' => "{$qrisRoot}/{$category['code']}/".str_replace(' ', '_', $name).'.jpg',
                ];
            }
        }

        return $rows;
    }

    /**
     * @param  array<string, mixed>  $document
     * @param  array<string, mixed>  $participantDocument
     * @return array<string, int>
     */
    private function summarize(array $document, array $participantDocument): array
    {
        $candidates = $this->candidateRows($document, $participantDocument);
        $qrisPaths = array_values(array_unique(array_map(
            static fn (array $candidate): string => $candidate['qrisPath'],
            $candidates,
        )));

        return [
            'campaign' => 1,
            'kategori' => count(array_unique(array_map(static fn (array $candidate): string => $candidate['categoryCode'], $candidates))),
            'kandidat finalis' => count($candidates),
            'QR media' => count($qrisPaths),
            'tanggal tally' => count($document['tallyDates']),
            'baris tally' => count($candidates) * count($document['tallyDates']),
        ];
    }

    /**
     * @param  array<string, mixed>  $document
     * @param  array<string, mixed>  $participantDocument
     * @return array<string, int>
     */
    private function persist(array $document, array $participantDocument): array
    {
        $editionData = $document['edition'];
        $campaignData = $document['campaign'];
        $edition = Edition::query()->where('year', $editionData['year'])->firstOrFail();
        $stage = SelectionStage::query()
            ->where('edition_id', $edition->id)
            ->where('final_stage', true)
            ->where('lifecycle', 'active')
            ->orderBy('display_order')
            ->orderBy('id')
            ->first();

        if ($stage === null) {
            throw new \RuntimeException('Stage final aktif untuk edisi voting tidak ditemukan. Jalankan import peserta terlebih dahulu.');
        }

        $campaign = VotingCampaign::query()->firstOrNew(['slug' => $campaignData['slug']]);
        if ($campaign->exists && $campaign->edition_id !== $edition->id) {
            throw new \RuntimeException('Slug campaign voting sudah dipakai oleh edisi lain.');
        }
        if (! $campaign->exists) {
            $campaign->id = $this->stableUuid('voting-campaign:'.$campaignData['slug']);
        }

        $campaign->fill([
            'edition_id' => $edition->id,
            'eligibility_stage_id' => $stage->id,
            'name' => $campaignData['name'],
            'timezone' => $campaignData['timezone'],
            'starts_at' => CarbonImmutable::parse($campaignData['startsAt']),
            'ends_at' => CarbonImmutable::parse($campaignData['endsAt']),
            'started_at' => CarbonImmutable::parse($campaignData['startedAt']),
            'closed_at' => CarbonImmutable::parse($campaignData['closedAt']),
            'status' => $campaignData['status'],
            'price_per_point' => $campaignData['pricePerPoint'],
            'result_visibility' => $campaignData['resultVisibility'],
            'version' => 1,
        ]);
        $campaign->save();

        $participants = Participant::query()
            ->with('category')
            ->where('edition_id', $edition->id)
            ->where('stage', 'final')
            ->where('active', true)
            ->get()
            ->keyBy(function (Participant $participant): string {
                $code = $participant->category?->code;
                $code = $code instanceof CategoryCode ? $code->value : (string) $code;

                return $code.':'.$participant->slug;
            });

        $candidates = $this->candidateRows($document, $participantDocument);
        if ($participants->count() !== count($candidates)) {
            throw new \RuntimeException('Jumlah finalis di database target tidak sama dengan fixture voting.');
        }

        $mediaIds = [];
        $timestamp = $campaign->started_at ?? $campaign->starts_at;

        foreach ($candidates as $candidate) {
            $key = $candidate['categoryCode'].':'.$candidate['slug'];
            $participant = $participants->get($key);

            if ($participant === null) {
                throw new \RuntimeException("Finalis target tidak ditemukan: {$key}.");
            }

            $assetPath = public_path(ltrim($candidate['qrisPath'], '/'));
            $mediaAsset = MediaAsset::query()->firstOrNew([
                'provider' => 'local',
                'provider_key' => $candidate['qrisPath'],
            ]);

            if (! $mediaAsset->exists) {
                $mediaAsset->id = $this->stableUuid('voting-media:'.$candidate['qrisPath']);
            }

            $mediaAsset->fill([
                'url' => $candidate['qrisPath'],
                'filename' => basename($assetPath),
                'mime_type' => mime_content_type($assetPath) ?: 'image/jpeg',
                'bytes' => (int) (filesize($assetPath) ?: 0),
                'alt' => 'QR voting '.$candidate['name'],
                'decorative' => false,
                'lifecycle' => 'ready',
            ]);
            $mediaAsset->save();
            $mediaIds[$candidate['qrisPath']] = $mediaAsset->id;

            $participant->forceFill(['qris_media_id' => $mediaAsset->id])->save();

            DB::table('voting_campaign_participants')->updateOrInsert(
                [
                    'campaign_id' => $campaign->id,
                    'participant_id' => $participant->id,
                ],
                [
                    'source_stage_id' => $stage->id,
                    'added_at' => $timestamp,
                ],
            );

            foreach ($document['tallyDates'] as $date) {
                DB::table('vote_daily_tallies')->updateOrInsert(
                    [
                        'campaign_id' => $campaign->id,
                        'participant_id' => $participant->id,
                        'local_date' => $date,
                    ],
                    [
                        'id' => $this->stableUuid("voting-tally:{$campaign->slug}:{$key}:{$date}"),
                        'amount' => $document['tallyAmount'],
                        'version' => 1,
                        'created_at' => $timestamp,
                        'updated_at' => $timestamp,
                    ],
                );
            }
        }

        return [
            'campaigns' => 1,
            'participants' => count($candidates),
            'mediaAssets' => count($mediaIds),
            'campaignParticipants' => count($candidates),
            'tallies' => count($candidates) * count($document['tallyDates']),
        ];
    }

    private function parseDate(mixed $value): ?CarbonImmutable
    {
        if (! is_string($value) || $value === '') {
            return null;
        }

        try {
            return CarbonImmutable::parse($value);
        } catch (Throwable) {
            return null;
        }
    }

    private function isLocalDate(string $value): bool
    {
        $date = CarbonImmutable::createFromFormat('!Y-m-d', $value, 'Asia/Jakarta');

        return $date !== false && $date->format('Y-m-d') === $value;
    }

    /**
     * @param  array<string, mixed>  $document
     */
    private function resolveParticipantFixturePath(array $document): string
    {
        $fixturePath = $document['participantFixture'] ?? 'database/fixtures/participants-2025.json';

        if (! is_string($fixturePath) || $fixturePath === '') {
            throw new \RuntimeException('participantFixture voting tidak valid.');
        }

        if (preg_match('/^[A-Za-z]:[\\\\\/]/', $fixturePath) === 1 || str_starts_with($fixturePath, DIRECTORY_SEPARATOR)) {
            return $fixturePath;
        }

        return base_path($fixturePath);
    }

    private function resolveFixturePath(): string
    {
        $fixtureOption = $this->option('fixture');
        $fixturePath = is_string($fixtureOption) && $fixtureOption !== ''
            ? $fixtureOption
            : 'database/fixtures/voting-2025.json';

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

<?php

namespace App\Console\Commands;

use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Throwable;

#[Signature('moka:rehearse-2025 {--fixture-dir=} {--apply : Apply the complete snapshot to the isolated pamoka_test database}')]
#[Description('Validate or apply the complete 2025 Laravel migration rehearsal')]
class Rehearse2025 extends Command
{
    /**
     * @var array<string, string>
     */
    private const IMPORTS = [
        'moka:import-participants' => 'participants-2025.json',
        'moka:import-news' => 'news-2025.json',
        'moka:import-public-media' => 'public-media-2025.json',
        'moka:import-public-organization' => 'organization-public-snapshot.json',
        'moka:import-voting' => 'voting-2025.json',
        'moka:import-page-sections' => 'page-sections-2025.json',
    ];

    public function handle(): int
    {
        $fixturePaths = $this->resolveFixturePaths();

        if ($fixturePaths === null) {
            return self::FAILURE;
        }

        if ($this->option('apply') && ! $this->isIsolatedRehearsalDatabase()) {
            $this->error('Apply diblokir. Gunakan database MySQL lokal pamoka_test pada port yang dipilih untuk rehearsal.');

            return self::FAILURE;
        }

        foreach ($fixturePaths as $command => $fixturePath) {
            $exitCode = $this->callSilent($command, ['--fixture' => $fixturePath]);

            if ($exitCode !== self::SUCCESS) {
                $this->error("Validasi snapshot gagal pada {$command}.");

                return self::FAILURE;
            }
        }

        if (! $this->option('apply')) {
            $this->info('Rehearsal lengkap 2025 lulus.');
            $this->warn('Tidak ada perubahan database.');

            return self::SUCCESS;
        }

        try {
            DB::transaction(function () use ($fixturePaths): void {
                foreach ($fixturePaths as $command => $fixturePath) {
                    $exitCode = $this->call($command, [
                        '--fixture' => $fixturePath,
                        '--apply' => true,
                    ]);

                    if ($exitCode !== self::SUCCESS) {
                        throw new RuntimeException("Import {$command} gagal.");
                    }
                }
            });
        } catch (Throwable $exception) {
            $this->error('Rehearsal gagal. Seluruh perubahan dibatalkan.');
            $this->error($exception->getMessage());

            return self::FAILURE;
        }

        $this->info('Rehearsal lengkap 2025 berhasil diterapkan.');

        return self::SUCCESS;
    }

    /**
     * @return array<string, string>|null
     */
    private function resolveFixturePaths(): ?array
    {
        $fixtureDirectory = $this->option('fixture-dir');
        $fixtureDirectory = is_string($fixtureDirectory) && $fixtureDirectory !== ''
            ? $fixtureDirectory
            : 'database/fixtures';

        if (! $this->isAbsolutePath($fixtureDirectory)) {
            $fixtureDirectory = base_path($fixtureDirectory);
        }

        if (! is_dir($fixtureDirectory)) {
            $this->error("Direktori fixture tidak ditemukan: {$fixtureDirectory}");

            return null;
        }

        $paths = [];

        foreach (self::IMPORTS as $command => $filename) {
            $path = rtrim($fixtureDirectory, '\\/').DIRECTORY_SEPARATOR.$filename;

            if (! is_file($path)) {
                $this->error("Fixture tidak ditemukan untuk {$command}: {$path}");

                return null;
            }

            $paths[$command] = $path;
        }

        return $paths;
    }

    private function isIsolatedRehearsalDatabase(): bool
    {
        $host = (string) config('database.connections.mysql.host');
        $database = (string) config('database.connections.mysql.database');

        return in_array($host, ['127.0.0.1', 'localhost'], true)
            && $database === 'pamoka_test';
    }

    private function isAbsolutePath(string $path): bool
    {
        return preg_match('/^[A-Za-z]:[\\\\\/]/', $path) === 1
            || str_starts_with($path, DIRECTORY_SEPARATOR);
    }
}

<?php

namespace App\Services;

use App\Exceptions\R2StorageException;
use App\Models\AuditLog;
use App\Models\MediaAsset;
use App\Models\MediaFolder;
use App\Models\User;
use Aws\S3\S3Client;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

final class R2Storage
{
    private const PROVIDER = 'r2';

    public function __construct(private readonly ?S3Client $injectedClient = null) {}

    public function configured(): bool
    {
        try {
            $this->configuration();

            return true;
        } catch (R2StorageException) {
            return false;
        }
    }

    /**
     * @param  array<int, mixed>  $files
     * @return list<array{assetId: string, key: string, url: string, headers: array{Content-Type: string}, name: string, mimeType: string, bytes: int}>
     */
    public function prepare(string $kind, array $files, ?string $folderId, User $actor): array
    {
        $route = $this->routeConfig($kind);
        $normalizedFiles = $this->validateFiles($route, $files);
        $folderId = $this->resolveFolderId($folderId);
        $configuration = $this->configuration();
        $client = $this->client($configuration);
        $prepared = [];
        $assets = [];

        foreach ($normalizedFiles as $file) {
            $assetId = (string) Str::uuid();
            $key = $this->objectKey($assetId, $file['name']);
            $url = $this->publicUrl($configuration['publicUrl'], $key);
            $command = $client->getCommand('PutObject', [
                'Bucket' => $configuration['bucket'],
                'Key' => $key,
                'ContentType' => $file['type'],
            ]);
            $presigned = $client->createPresignedRequest($command, '+15 minutes');

            $assets[] = [
                'id' => $assetId,
                'provider' => self::PROVIDER,
                'provider_key' => $key,
                'url' => $url,
                'filename' => $file['name'],
                'mime_type' => $file['type'],
                'bytes' => $file['size'],
                'lifecycle' => 'processing',
                'folder_id' => $folderId,
                'owner_user_id' => $actor->id,
            ];
            $prepared[] = [
                'assetId' => $assetId,
                'key' => $key,
                'url' => (string) $presigned->getUri(),
                'headers' => ['Content-Type' => $file['type']],
                'name' => $file['name'],
                'mimeType' => $file['type'],
                'bytes' => $file['size'],
            ];
        }

        DB::transaction(function () use ($assets, $actor): void {
            foreach ($assets as $asset) {
                $created = MediaAsset::forceCreate($asset);
                AuditLog::create([
                    'actor_user_id' => $actor->id,
                    'actor_label' => $actor->email,
                    'action' => 'media.upload.prepare',
                    'resource_type' => 'media_asset',
                    'resource_id' => $created->id,
                    'resource_label' => $created->filename,
                    'after_json' => [
                        'kind' => $this->kindForMime($created->mime_type),
                        'provider' => self::PROVIDER,
                        'providerKey' => $created->provider_key,
                        'url' => $created->url,
                        'bytes' => (int) $created->bytes,
                        'mimeType' => $created->mime_type,
                        'lifecycle' => $created->lifecycle,
                        'folderId' => $created->folder_id,
                    ],
                    'changed_fields_json' => ['provider', 'provider_key', 'url', 'lifecycle', 'folder_id'],
                    'source' => 'r2-upload',
                    'created_at' => now(),
                ]);
            }
        });

        return $prepared;
    }

    /**
     * @param  array<int, mixed>  $assetIds
     * @return list<array{mediaAssetId: string, provider: string, providerKey: string, key: string, url: string}>
     */
    public function complete(array $assetIds, User $actor): array
    {
        if (count($assetIds) < 1 || count($assetIds) > 10) {
            throw ValidationException::withMessages(['assetIds' => 'Jumlah aset tidak sesuai dengan batas unggah.']);
        }

        $configuration = $this->configuration();
        $client = $this->client($configuration);
        $identities = [];

        foreach (array_values($assetIds) as $index => $assetId) {
            if (! is_string($assetId) || ! Str::isUuid($assetId)) {
                throw ValidationException::withMessages(["assetIds.$index" => 'ID aset tidak valid.']);
            }

            $asset = MediaAsset::query()
                ->whereKey($assetId)
                ->where('provider', self::PROVIDER)
                ->where('owner_user_id', $actor->id)
                ->first();
            if ($asset === null) {
                throw new R2StorageException('Aset unggah tidak ditemukan.', 404);
            }

            if ($asset->lifecycle !== 'ready') {
                $providerKey = is_string($asset->provider_key) ? $asset->provider_key : '';
                if ($providerKey === '') {
                    throw new R2StorageException('Kunci objek R2 tidak ditemukan.', 422);
                }
                $this->assertObjectMatchesAsset($client, $configuration, $asset, $providerKey);
            }

            $identities[] = DB::transaction(function () use ($assetId, $actor): array {
                $locked = MediaAsset::query()->whereKey($assetId)->lockForUpdate()->firstOrFail();
                if ($locked->lifecycle !== 'ready') {
                    $locked->forceFill(['lifecycle' => 'ready'])->save();
                    AuditLog::create([
                        'actor_user_id' => $actor->id,
                        'actor_label' => $actor->email,
                        'action' => 'media.upload.complete',
                        'resource_type' => 'media_asset',
                        'resource_id' => $locked->id,
                        'resource_label' => $locked->filename,
                        'after_json' => [
                            'kind' => $this->kindForMime($locked->mime_type),
                            'provider' => self::PROVIDER,
                            'providerKey' => $locked->provider_key,
                            'url' => $locked->url,
                            'bytes' => (int) $locked->bytes,
                            'mimeType' => $locked->mime_type,
                            'lifecycle' => 'ready',
                            'folderId' => $locked->folder_id,
                        ],
                        'changed_fields_json' => ['lifecycle'],
                        'source' => 'r2-upload',
                        'created_at' => now(),
                    ]);
                }

                return $this->identity($locked);
            });
        }

        return $identities;
    }

    /**
     * @return array{endpoint: string, key: string, secret: string, bucket: string, publicUrl: string, region: string}
     */
    private function configuration(): array
    {
        $endpoint = config('services.r2.endpoint');
        $key = config('services.r2.key');
        $secret = config('services.r2.secret');
        $bucket = config('services.r2.bucket');
        $publicUrl = config('services.r2.public_url');
        $region = config('services.r2.region', 'auto');

        if (! is_string($endpoint) || ! filter_var($endpoint, FILTER_VALIDATE_URL)
            || ! is_string($key) || trim($key) === ''
            || ! is_string($secret) || trim($secret) === ''
            || ! is_string($bucket) || trim($bucket) === ''
            || ! is_string($publicUrl) || ! filter_var($publicUrl, FILTER_VALIDATE_URL)
            || ! is_string($region) || trim($region) === '') {
            throw new R2StorageException('R2 belum dikonfigurasi.', 503);
        }

        return [
            'endpoint' => rtrim($endpoint, '/'),
            'key' => trim($key),
            'secret' => trim($secret),
            'bucket' => trim($bucket),
            'publicUrl' => rtrim($publicUrl, '/'),
            'region' => trim($region),
        ];
    }

    /**
     * @param  array{endpoint: string, key: string, secret: string, bucket: string, publicUrl: string, region: string}  $configuration
     */
    private function client(array $configuration): S3Client
    {
        return $this->injectedClient ?? new S3Client([
            'version' => 'latest',
            'region' => $configuration['region'],
            'endpoint' => $configuration['endpoint'],
            'use_path_style_endpoint' => true,
            'credentials' => [
                'key' => $configuration['key'],
                'secret' => $configuration['secret'],
            ],
        ]);
    }

    /**
     * @return array{maxFiles: int, maxBytes: int, mimeTypes: list<string>}
     */
    private function routeConfig(string $kind): array
    {
        $routes = [
            'image' => ['maxFiles' => 10, 'maxBytes' => 20 * 1024 * 1024, 'mimeTypes' => ['image/jpeg', 'image/png', 'image/webp', 'image/avif']],
            'video' => ['maxFiles' => 1, 'maxBytes' => 512 * 1024 * 1024, 'mimeTypes' => ['video/mp4', 'video/webm']],
            'pdf' => ['maxFiles' => 5, 'maxBytes' => 64 * 1024 * 1024, 'mimeTypes' => ['application/pdf']],
        ];
        if (! isset($routes[$kind])) {
            throw ValidationException::withMessages(['kind' => 'Jenis media tidak ditemukan.']);
        }

        return $routes[$kind];
    }

    /**
     * @param  array{maxFiles: int, maxBytes: int, mimeTypes: list<string>}  $route
     * @param  array<int, mixed>  $files
     * @return list<array{name: string, size: int, type: string}>
     */
    private function validateFiles(array $route, array $files): array
    {
        if (count($files) < 1 || count($files) > $route['maxFiles']) {
            throw ValidationException::withMessages(['files' => 'Jumlah file tidak sesuai dengan batas unggah.']);
        }

        $normalized = [];
        foreach (array_values($files) as $index => $file) {
            if (! is_array($file)) {
                throw ValidationException::withMessages(["files.$index" => 'Data file tidak valid.']);
            }
            $name = is_string($file['name'] ?? null) ? trim(basename($file['name'])) : '';
            $type = is_string($file['type'] ?? null) ? strtolower(trim($file['type'])) : '';
            $size = $this->positiveInteger($file['size'] ?? null);
            if ($name === '' || strlen($name) > 255 || $size === null) {
                throw ValidationException::withMessages(["files.$index" => 'Nama atau ukuran file tidak valid.']);
            }
            if (! in_array($type, $route['mimeTypes'], true)) {
                throw ValidationException::withMessages(["files.$index" => 'Jenis file tidak sesuai dengan jalur unggah.']);
            }
            if ($size > $route['maxBytes']) {
                throw ValidationException::withMessages(["files.$index" => 'Ukuran file melebihi batas unggah.']);
            }
            $normalized[] = ['name' => $name, 'size' => $size, 'type' => $type];
        }

        return $normalized;
    }

    private function resolveFolderId(?string $folderId): ?string
    {
        if ($folderId === null || trim($folderId) === '') {
            return null;
        }
        if (! Str::isUuid($folderId) || ! MediaFolder::query()->whereKey($folderId)->exists()) {
            throw ValidationException::withMessages(['folderId' => 'Folder media tidak ditemukan.']);
        }

        return $folderId;
    }

    /**
     * @param  array{endpoint: string, key: string, secret: string, bucket: string, publicUrl: string, region: string}  $configuration
     */
    private function assertObjectMatchesAsset(S3Client $client, array $configuration, MediaAsset $asset, string $providerKey): void
    {
        try {
            $head = $client->headObject([
                'Bucket' => $configuration['bucket'],
                'Key' => $providerKey,
            ]);
        } catch (Throwable $exception) {
            throw new R2StorageException('Objek R2 belum tersedia.', 422, $exception);
        }

        $bytes = (int) ($head['ContentLength'] ?? 0);
        $mimeType = strtolower((string) ($head['ContentType'] ?? ''));
        if ($bytes !== (int) $asset->bytes || $mimeType !== strtolower((string) $asset->mime_type)) {
            throw new R2StorageException('Metadata objek R2 tidak sesuai dengan file yang didaftarkan.', 422);
        }
    }

    private function objectKey(string $assetId, string $filename): string
    {
        $extension = strtolower((string) pathinfo($filename, PATHINFO_EXTENSION));
        $stem = (string) pathinfo($filename, PATHINFO_FILENAME);
        $safeStem = Str::slug(Str::ascii($stem));
        $safeStem = $safeStem !== '' ? $safeStem : 'file';
        $safeExtension = preg_replace('/[^a-z0-9]/', '', $extension) ?? '';

        return 'media/'.now()->format('Y/m').'/'.$assetId.'-'.$safeStem.($safeExtension === '' ? '' : '.'.$safeExtension);
    }

    private function publicUrl(string $baseUrl, string $key): string
    {
        return $baseUrl.'/'.implode('/', array_map('rawurlencode', explode('/', $key)));
    }

    private function kindForMime(string $mimeType): string
    {
        return str_starts_with($mimeType, 'image/') ? 'image' : (str_starts_with($mimeType, 'video/') ? 'video' : 'pdf');
    }

    private function positiveInteger(mixed $value): ?int
    {
        if ((is_int($value) || is_float($value) || is_string($value)) && is_numeric($value) && (int) $value > 0 && (float) $value === (float) (int) $value) {
            return (int) $value;
        }

        return null;
    }

    /**
     * @return array{mediaAssetId: string, provider: string, providerKey: string, key: string, url: string}
     */
    private function identity(MediaAsset $asset): array
    {
        return [
            'mediaAssetId' => (string) $asset->id,
            'provider' => self::PROVIDER,
            'providerKey' => (string) $asset->provider_key,
            'key' => (string) $asset->provider_key,
            'url' => $asset->url,
        ];
    }
}

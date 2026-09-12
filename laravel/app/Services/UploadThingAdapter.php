<?php

namespace App\Services;

use App\Exceptions\UploadThingException;
use App\Models\AuditLog;
use App\Models\MediaAsset;
use App\Models\MediaFolder;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

final class UploadThingAdapter
{
    public const VERSION = '7.7.4';

    private const SIGNATURE_PREFIX = 'hmac-sha256=';

    private const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

    /**
     * @return list<array{slug: string, config: array<string, array<string, mixed>>}>
     */
    public function metadata(): array
    {
        return [
            [
                'slug' => 'image',
                'config' => [
                    'image' => [
                        'maxFileSize' => '32MB',
                        'maxFileCount' => 10,
                        'minFileCount' => 1,
                        'contentDisposition' => 'inline',
                    ],
                ],
            ],
            [
                'slug' => 'video',
                'config' => [
                    'video' => [
                        'maxFileSize' => '512MB',
                        'maxFileCount' => 1,
                        'minFileCount' => 1,
                        'contentDisposition' => 'inline',
                    ],
                ],
            ],
            [
                'slug' => 'pdf',
                'config' => [
                    'pdf' => [
                        'maxFileSize' => '64MB',
                        'maxFileCount' => 5,
                        'minFileCount' => 1,
                        'contentDisposition' => 'inline',
                    ],
                ],
            ],
        ];
    }

    public function configured(): bool
    {
        try {
            $this->credentials();

            return true;
        } catch (UploadThingException) {
            return false;
        }
    }

    /**
     * @param  array<int, mixed>  $files
     * @param  array<string, mixed>|null  $input
     * @return list<array{url: string, key: string, name: string, customId: null}>
     */
    public function prepareUpload(
        string $slug,
        array $files,
        ?array $input,
        User $actor,
        string $callbackUrl,
        string $frontendPackage = 'uploadthing/laravel-inertia',
    ): array {
        $route = $this->routeConfig($slug);
        $normalizedFiles = $this->validateFiles($slug, $route, $files);
        $folderId = $this->resolveFolderId($input);
        $credentials = $this->credentials();
        $ingestUrl = $this->ingestUrl($credentials);
        $callbackUrl = $this->callbackUrl($callbackUrl, $slug);
        $presigned = [];

        foreach ($normalizedFiles as $file) {
            $key = $this->generateKey($file, $credentials['appId']);
            $presigned[] = [
                'url' => $this->signedUrl($ingestUrl.'/'.$key, $credentials['apiKey'], [
                    'x-ut-identifier' => $credentials['appId'],
                    'x-ut-file-name' => $file['name'],
                    'x-ut-file-size' => (string) $file['size'],
                    'x-ut-file-type' => $file['type'],
                    'x-ut-slug' => $slug,
                    'x-ut-content-disposition' => 'inline',
                ]),
                'key' => $key,
                'name' => $file['name'],
                'customId' => null,
            ];
        }

        $response = Http::asJson()
            ->withHeaders([
                'x-uploadthing-api-key' => $credentials['apiKey'],
                'x-uploadthing-version' => self::VERSION,
                'x-uploadthing-be-adapter' => 'laravel-inertia',
                'x-uploadthing-fe-package' => $frontendPackage,
            ])
            ->timeout(20)
            ->post($ingestUrl.'/route-metadata', [
                'fileKeys' => array_column($presigned, 'key'),
                'metadata' => [
                    'userId' => (string) $actor->id,
                    'email' => $actor->email,
                    'kind' => $slug,
                    'folderId' => $folderId,
                ],
                'callbackUrl' => $callbackUrl,
                'callbackSlug' => $slug,
                'awaitServerData' => true,
                'isDev' => false,
            ]);

        if (! $response->successful() || $response->json('ok') !== true) {
            throw new UploadThingException('Upload provider menolak pendaftaran media.', 502);
        }

        return $presigned;
    }

    public function verifyCallbackSignature(string $payload, ?string $signature): bool
    {
        if (! is_string($signature) || ! str_starts_with($signature, self::SIGNATURE_PREFIX)) {
            return false;
        }

        $provided = substr($signature, strlen(self::SIGNATURE_PREFIX));
        if (! is_string($provided) || ! preg_match('/^[a-f0-9]{64}$/', $provided)) {
            return false;
        }

        try {
            $expected = hash_hmac('sha256', $payload, $this->credentials()['apiKey']);

            return hash_equals($expected, $provided);
        } catch (UploadThingException) {
            return false;
        }
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array{mediaAssetId: string, provider: string, providerKey: string, key: string, url: string}
     */
    public function persistCallback(array $payload): array
    {
        if (($payload['status'] ?? null) !== 'uploaded') {
            throw new UploadThingException('Status callback media tidak valid.', 422);
        }

        $metadata = $payload['metadata'] ?? null;
        $file = $payload['file'] ?? null;
        if (! is_array($metadata) || ! is_array($file)) {
            throw new UploadThingException('Payload callback media tidak lengkap.', 422);
        }

        $kind = is_string($metadata['kind'] ?? null) ? strtolower($metadata['kind']) : '';
        $route = $this->routeConfig($kind);
        $ownerId = $metadata['userId'] ?? null;
        $owner = is_string($ownerId) || is_int($ownerId) ? User::query()->find($ownerId) : null;
        if ($owner === null) {
            throw new UploadThingException('Pemilik callback media tidak ditemukan.', 422);
        }

        $providerKey = is_string($file['key'] ?? null) ? trim($file['key']) : '';
        $filename = is_string($file['name'] ?? null) ? trim($file['name']) : '';
        $mimeType = is_string($file['type'] ?? null) ? strtolower(trim($file['type'])) : '';
        $url = $this->callbackMediaUrl($file);
        $bytes = $this->positiveInteger($file['size'] ?? null);
        if ($providerKey === '' || strlen($providerKey) > 255 || $filename === '' || strlen($filename) > 255) {
            throw new UploadThingException('Identitas file callback media tidak valid.', 422);
        }
        if ($bytes === null || ! $this->allowedMime($kind, $mimeType) || $bytes > $route['applicationMaxBytes']) {
            throw new UploadThingException('Tipe atau ukuran file callback media tidak valid.', 422);
        }

        $folderId = $this->callbackFolderId($metadata['folderId'] ?? null);
        $actorLabel = is_string($metadata['email'] ?? null) && trim($metadata['email']) !== ''
            ? trim($metadata['email'])
            : $owner->email;

        return DB::transaction(function () use ($owner, $actorLabel, $bytes, $filename, $folderId, $kind, $mimeType, $providerKey, $url): array {
            $existing = MediaAsset::query()
                ->where('provider', 'uploadthing')
                ->where('provider_key', $providerKey)
                ->lockForUpdate()
                ->first();

            if ($existing !== null) {
                return $this->assetIdentity($existing);
            }

            $asset = MediaAsset::create([
                'id' => (string) Str::uuid(),
                'provider' => 'uploadthing',
                'provider_key' => $providerKey,
                'url' => $url,
                'filename' => $filename,
                'mime_type' => $mimeType,
                'bytes' => $bytes,
                'lifecycle' => 'ready',
                'folder_id' => $folderId,
                'owner_user_id' => $owner->id,
            ]);

            AuditLog::create([
                'actor_user_id' => $owner->id,
                'actor_label' => $actorLabel,
                'action' => 'media.upload.complete',
                'resource_type' => 'mediaAsset',
                'resource_id' => $asset->id,
                'resource_label' => $filename,
                'after_json' => [
                    'kind' => $kind,
                    'provider' => 'uploadthing',
                    'providerKey' => $providerKey,
                    'url' => $url,
                    'bytes' => $bytes,
                    'mimeType' => $mimeType,
                    'lifecycle' => 'ready',
                    'folderId' => $folderId,
                ],
                'changed_fields_json' => ['provider', 'providerKey', 'url', 'lifecycle', 'folderId'],
                'source' => 'uploadthing-callback',
                'created_at' => now(),
            ]);

            return $this->assetIdentity($asset);
        });
    }

    /**
     * @param  array<string, mixed>  $callbackData
     */
    public function reportCallbackResult(
        string $origin,
        string $fileKey,
        array $callbackData,
        string $frontendPackage = 'uploadthing/laravel-inertia',
    ): void {
        $credentials = $this->credentials();
        $originUrl = parse_url($origin);
        $host = is_array($originUrl) && is_string($originUrl['host'] ?? null)
            ? strtolower($originUrl['host'])
            : '';
        $scheme = is_array($originUrl) && is_string($originUrl['scheme'] ?? null)
            ? strtolower($originUrl['scheme'])
            : '';
        $allowedHosts = array_map(
            fn (string $region): string => strtolower($region.'.'.$credentials['ingestHost']),
            $credentials['regions'],
        );
        if ($scheme !== 'https' || ! in_array($host, $allowedHosts, true) || (($originUrl['path'] ?? '') !== '' && ($originUrl['path'] ?? '') !== '/')) {
            throw new UploadThingException('Origin callback provider tidak valid.', 400);
        }

        $response = Http::asJson()
            ->withHeaders([
                'x-uploadthing-api-key' => $credentials['apiKey'],
                'x-uploadthing-version' => self::VERSION,
                'x-uploadthing-be-adapter' => 'laravel-inertia',
                'x-uploadthing-fe-package' => $frontendPackage,
            ])
            ->timeout(20)
            ->post('https://'.$host.'/callback-result', [
                'fileKey' => $fileKey,
                'callbackData' => $callbackData,
            ]);

        if (! $response->successful()) {
            throw new UploadThingException('Hasil callback media gagal dikirim ke provider.', 502);
        }
    }

    /**
     * @return array{fileType: string, maxFileCount: int, applicationMaxBytes: int}
     */
    private function routeConfig(string $slug): array
    {
        $routes = [
            'image' => ['fileType' => 'image', 'maxFileCount' => 10, 'applicationMaxBytes' => 20 * 1024 * 1024],
            'video' => ['fileType' => 'video', 'maxFileCount' => 1, 'applicationMaxBytes' => 512 * 1024 * 1024],
            'pdf' => ['fileType' => 'pdf', 'maxFileCount' => 5, 'applicationMaxBytes' => 64 * 1024 * 1024],
        ];
        if (! isset($routes[$slug])) {
            throw ValidationException::withMessages(['slug' => 'Jalur unggah tidak ditemukan.']);
        }

        return $routes[$slug];
    }

    /**
     * @param  array{fileType: string, maxFileCount: int, applicationMaxBytes: int}  $route
     * @param  array<int, mixed>  $files
     * @return list<array{name: string, size: int, type: string, lastModified: int|null}>
     */
    private function validateFiles(string $slug, array $route, array $files): array
    {
        if (count($files) < 1 || count($files) > $route['maxFileCount']) {
            throw ValidationException::withMessages(['files' => 'Jumlah file tidak sesuai dengan batas jalur unggah.']);
        }

        $normalized = [];
        foreach (array_values($files) as $index => $file) {
            if (! is_array($file)) {
                throw ValidationException::withMessages(["files.$index" => 'Data file tidak valid.']);
            }

            $name = is_string($file['name'] ?? null) ? trim($file['name']) : '';
            $type = is_string($file['type'] ?? null) ? strtolower(trim($file['type'])) : '';
            $size = $this->positiveInteger($file['size'] ?? null);
            if ($name === '' || strlen($name) > 255 || $size === null) {
                throw ValidationException::withMessages(["files.$index" => 'Nama atau ukuran file tidak valid.']);
            }
            if (! $this->allowedMime($slug, $type)) {
                throw ValidationException::withMessages(["files.$index" => 'Jenis file tidak sesuai dengan jalur unggah.']);
            }
            if ($size > $route['applicationMaxBytes']) {
                $message = $slug === 'image' ? 'Ukuran gambar maksimal 20 MB.' : 'Ukuran file melebihi batas jalur unggah.';
                throw ValidationException::withMessages(["files.$index" => $message]);
            }

            $normalized[] = [
                'name' => $name,
                'size' => $size,
                'type' => $type,
                'lastModified' => $this->positiveInteger($file['lastModified'] ?? null),
            ];
        }

        return $normalized;
    }

    private function allowedMime(string $kind, string $mimeType): bool
    {
        return match ($kind) {
            'image' => in_array($mimeType, ['image/jpeg', 'image/png', 'image/webp', 'image/avif'], true),
            'video' => in_array($mimeType, ['video/mp4', 'video/webm'], true),
            'pdf' => $mimeType === 'application/pdf',
            default => false,
        };
    }

    private function resolveFolderId(?array $input): ?string
    {
        $folderId = $input['folderId'] ?? null;
        if ($folderId === null || $folderId === '') {
            return null;
        }
        if (! is_string($folderId) || ! Str::isUuid($folderId) || ! MediaFolder::query()->whereKey($folderId)->exists()) {
            throw ValidationException::withMessages(['input.folderId' => 'Folder media tidak ditemukan.']);
        }

        return $folderId;
    }

    private function callbackFolderId(mixed $folderId): ?string
    {
        if ($folderId === null || $folderId === '') {
            return null;
        }
        if (! is_string($folderId) || ! Str::isUuid($folderId) || ! MediaFolder::query()->whereKey($folderId)->exists()) {
            throw new UploadThingException('Folder callback media tidak ditemukan.', 422);
        }

        return $folderId;
    }

    /**
     * @return array{apiKey: string, appId: string, regions: list<string>, ingestHost: string}
     */
    private function credentials(): array
    {
        $token = config('services.uploadthing.token');
        if (! is_string($token) || trim($token) === '') {
            throw new UploadThingException('Upload provider belum dikonfigurasi.', 503);
        }

        try {
            $decoded = base64_decode($token, true);
            if ($decoded === false) {
                throw new UploadThingException('Token UploadThing tidak valid.', 503);
            }
            $payload = json_decode($decoded, true, 512, JSON_THROW_ON_ERROR);
            if (! is_array($payload)) {
                throw new UploadThingException('Token UploadThing tidak valid.', 503);
            }
        } catch (Throwable) {
            throw new UploadThingException('Token UploadThing tidak valid.', 503);
        }

        $apiKey = $payload['apiKey'] ?? null;
        $appId = $payload['appId'] ?? null;
        $regions = $payload['regions'] ?? null;
        $ingestHost = $payload['ingestHost'] ?? 'ingest.uploadthing.com';
        $regions = is_array($regions) ? array_values(array_filter($regions, is_string(...))) : [];
        $regions = array_values(array_filter($regions, static fn (string $region): bool => preg_match('/^[a-z0-9][a-z0-9-]*$/i', $region) === 1));
        $ingestHost = is_string($ingestHost) ? strtolower(trim($ingestHost)) : '';
        $hostCheck = parse_url('https://'.$ingestHost);

        if (! is_string($apiKey) || ! str_starts_with($apiKey, 'sk_')
            || ! is_string($appId) || trim($appId) === ''
            || $regions === []
            || ! is_array($hostCheck) || ($hostCheck['host'] ?? '') !== $ingestHost || (($hostCheck['path'] ?? '') !== '' && ($hostCheck['path'] ?? '') !== '/')) {
            throw new UploadThingException('Token UploadThing tidak valid.', 503);
        }

        return [
            'apiKey' => $apiKey,
            'appId' => $appId,
            'regions' => $regions,
            'ingestHost' => $ingestHost,
        ];
    }

    /**
     * @param  array{apiKey: string, appId: string, regions: list<string>, ingestHost: string}  $credentials
     */
    private function ingestUrl(array $credentials): string
    {
        return 'https://'.$credentials['regions'][0].'.'.$credentials['ingestHost'];
    }

    private function callbackUrl(string $callbackUrl, string $slug): string
    {
        $parsed = parse_url($callbackUrl);
        if (! is_array($parsed) || ! in_array(strtolower((string) ($parsed['scheme'] ?? '')), ['http', 'https'], true) || ! isset($parsed['host'])) {
            throw new UploadThingException('URL callback UploadThing tidak valid.', 503);
        }
        if (app()->environment('production') && strtolower((string) $parsed['scheme']) !== 'https') {
            throw new UploadThingException('URL callback UploadThing harus HTTPS pada production.', 503);
        }

        return $callbackUrl.(str_contains($callbackUrl, '?') ? '&' : '?').'slug='.rawurlencode($slug);
    }

    /**
     * @param  array<string, string>  $data
     */
    private function signedUrl(string $url, string $apiKey, array $data): string
    {
        $pairs = ['expires' => (string) ((int) floor(microtime(true) * 1000) + 3600000)];
        foreach ($data as $key => $value) {
            $pairs[$key] = $this->encodeURIComponent($value);
        }
        $query = collect($pairs)
            ->map(fn (string $value, string $key): string => $this->formEncode($key).'='.$this->formEncode($value))
            ->implode('&');
        $signedUrl = $url.'?'.$query;
        $signature = self::SIGNATURE_PREFIX.hash_hmac('sha256', $signedUrl, $apiKey);

        return $signedUrl.'&'.$this->formEncode('signature').'='.$this->formEncode($signature);
    }

    private function encodeURIComponent(string $value): string
    {
        return strtr(rawurlencode($value), [
            '%21' => '!',
            '%27' => "'",
            '%28' => '(',
            '%29' => ')',
            '%2A' => '*',
            '%7E' => '~',
        ]);
    }

    private function formEncode(string $value): string
    {
        return strtr(rawurlencode($value), [
            '%20' => '+',
            '~' => '%7E',
            '%2A' => '*',
        ]);
    }

    private function generateKey(array $file, string $appId): string
    {
        $alphabet = $this->uploadThingShuffle(self::ALPHABET, $appId);
        $appPrefix = $this->sqidsEncode(abs($this->hashString($appId)), $alphabet, 12);
        $seed = json_encode([
            $file['name'],
            $file['size'],
            $file['type'],
            $file['lastModified'],
            microtime(true),
            bin2hex(random_bytes(8)),
        ], JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        $fileSeed = $this->sqidsEncode(abs($this->hashString($seed)), $alphabet, 36);

        return $appPrefix.$fileSeed;
    }

    private function hashString(string $value): int
    {
        $hash = 5381;
        for ($index = strlen($value) - 1; $index >= 0; $index--) {
            $hash = $this->signed32(($this->unsigned32($hash) * 33) ^ ord($value[$index]));
        }
        $unsigned = $this->unsigned32($hash);
        $optimized = ($unsigned & 0xBFFFFFFF) | (($unsigned >> 1) & 0x40000000);

        return $this->signed32($optimized);
    }

    private function uploadThingShuffle(string $alphabet, string $seed): string
    {
        $chars = str_split($alphabet);
        $seedNumber = $this->hashString($seed);
        $length = count($chars);
        for ($index = 0; $index < $length; $index++) {
            $remainder = $seedNumber % ($index + 1);
            $swapIndex = ($remainder + $index) % $length;
            [$chars[$index], $chars[$swapIndex]] = [$chars[$swapIndex], $chars[$index]];
        }

        return implode('', $chars);
    }

    private function sqidsShuffle(string $alphabet): string
    {
        $chars = str_split($alphabet);
        $length = count($chars);
        for ($index = 0, $remaining = $length - 1; $remaining > 0; $index++, $remaining--) {
            $swapIndex = ($index * $remaining + ord($chars[$index]) + ord($chars[$remaining])) % $length;
            [$chars[$index], $chars[$swapIndex]] = [$chars[$swapIndex], $chars[$index]];
        }

        return implode('', $chars);
    }

    private function sqidsEncode(int $number, string $alphabet, int $minLength): string
    {
        $alphabet = $this->sqidsShuffle($alphabet);
        $length = strlen($alphabet);
        $offset = (ord($alphabet[$number % $length]) + 1) % $length;
        $alphabet = substr($alphabet, $offset).substr($alphabet, 0, $offset);
        $prefix = $alphabet[0];
        $alphabet = strrev($alphabet);
        $encoded = $prefix.$this->sqidsToId($number, substr($alphabet, 1));

        if (strlen($encoded) < $minLength) {
            $encoded .= $alphabet[0];
            while (strlen($encoded) < $minLength) {
                $alphabet = $this->sqidsShuffle($alphabet);
                $encoded .= substr($alphabet, 0, min($minLength - strlen($encoded), strlen($alphabet)));
            }
        }

        return $encoded;
    }

    private function sqidsToId(int $number, string $alphabet): string
    {
        $chars = str_split($alphabet);
        $base = count($chars);
        $encoded = [];
        do {
            $encoded[] = $chars[$number % $base];
            $number = intdiv($number, $base);
        } while ($number > 0);

        return implode('', array_reverse($encoded));
    }

    private function signed32(int $value): int
    {
        $value %= 4294967296;
        if ($value < 0) {
            $value += 4294967296;
        }
        if ($value >= 2147483648) {
            $value -= 4294967296;
        }

        return $value;
    }

    private function unsigned32(int $value): int
    {
        return $value < 0 ? $value + 4294967296 : $value;
    }

    private function positiveInteger(mixed $value): ?int
    {
        if ((is_int($value) || is_float($value) || is_string($value)) && is_numeric($value) && (int) $value > 0 && (float) $value === (float) (int) $value) {
            return (int) $value;
        }

        return null;
    }

    private function callbackMediaUrl(array $file): string
    {
        $url = is_string($file['ufsUrl'] ?? null) ? trim($file['ufsUrl']) : '';
        if ($url === '' && is_string($file['url'] ?? null)) {
            $url = trim($file['url']);
        }
        $parsed = parse_url($url);
        $host = is_array($parsed) && is_string($parsed['host'] ?? null) ? strtolower($parsed['host']) : '';
        $validHost = $host === 'ufs.sh' || $host === 'utfs.io' || str_ends_with($host, '.ufs.sh') || str_ends_with($host, '.utfs.io');
        if (! $validHost || ($parsed['scheme'] ?? '') !== 'https' || ($parsed['path'] ?? '') === '') {
            throw new UploadThingException('URL media callback tidak valid.', 422);
        }

        return $url;
    }

    /**
     * @return array{mediaAssetId: string, provider: string, providerKey: string, key: string, url: string}
     */
    private function assetIdentity(MediaAsset $asset): array
    {
        return [
            'mediaAssetId' => (string) $asset->id,
            'provider' => $asset->provider,
            'providerKey' => (string) $asset->provider_key,
            'key' => (string) $asset->provider_key,
            'url' => $asset->url,
        ];
    }
}

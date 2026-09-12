<?php

namespace Tests\Feature;

use App\Enums\PermissionKey;
use App\Models\AdminProfile;
use App\Models\MediaFolder;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class UploadThingAdapterTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'services.uploadthing.token' => $this->fakeToken(),
            'services.uploadthing.callback_url' => 'https://pamoka.test/api/uploadthing',
        ]);
        Http::preventStrayRequests();
    }

    public function test_uploadthing_metadata_exposes_the_three_media_routes(): void
    {
        $this->getJson(route('uploadthing.endpoint'))
            ->assertOk()
            ->assertHeader('x-uploadthing-version', '7.7.4')
            ->assertExactJson([
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
            ]);
    }

    public function test_media_manager_can_request_signed_urls_and_register_metadata(): void
    {
        $manager = $this->adminWith(PermissionKey::MediaView, PermissionKey::MediaManage);
        $folder = MediaFolder::factory()->create();

        Http::fake([
            '*route-metadata' => Http::response(['ok' => true]),
        ]);

        $response = $this->actingAs($manager)->postJson(
            route('uploadthing.action', ['slug' => 'image', 'actionType' => 'upload']),
            [
                'files' => [[
                    'name' => 'hero.webp',
                    'size' => 1234,
                    'type' => 'image/webp',
                    'lastModified' => 1700000000000,
                ]],
                'input' => ['folderId' => $folder->id],
            ],
            [
                'x-uploadthing-package' => 'uploadthing/laravel-inertia',
            ],
        );

        $response->assertOk()->assertJsonCount(1);
        $providerRequest = Http::recorded()[0][0];
        $providerData = $providerRequest->data();
        $this->assertSame('https://iad1.ingest.test/route-metadata', $providerRequest->url());
        $this->assertSame(['sk_test_key'], $providerRequest->header('x-uploadthing-api-key'));
        $this->assertSame(['7.7.4'], $providerRequest->header('x-uploadthing-version'));
        $this->assertSame(['laravel-inertia'], $providerRequest->header('x-uploadthing-be-adapter'));
        $this->assertSame(['uploadthing/laravel-inertia'], $providerRequest->header('x-uploadthing-fe-package'));
        $this->assertTrue($providerData['awaitServerData']);
        $this->assertFalse($providerData['isDev']);
        $this->assertSame('image', $providerData['callbackSlug']);
        $this->assertSame('https://pamoka.test/api/uploadthing?slug=image', $providerData['callbackUrl']);
        $this->assertCount(1, $providerData['fileKeys']);
        $url = (string) $response->json('0.url');
        $key = (string) $response->json('0.key');
        $query = [];
        parse_str((string) parse_url($url, PHP_URL_QUERY), $query);

        $this->assertStringStartsWith('https://iad1.ingest.test/', $url);
        $this->assertSame('hero.webp', $response->json('0.name'));
        $this->assertSame($key, Http::recorded()[0][0]->data()['fileKeys'][0]);
        $this->assertSame('app_test', $query['x-ut-identifier']);
        $this->assertSame('image', $query['x-ut-slug']);
        $this->assertSame('1234', $query['x-ut-file-size']);
        $this->assertSame('image%2Fwebp', $query['x-ut-file-type']);
        $this->assertSame('inline', $query['x-ut-content-disposition']);
        $this->assertMatchesRegularExpression('/^hmac-sha256=[a-f0-9]{64}$/', (string) $query['signature']);
        $signedBase = substr($url, 0, (int) strrpos($url, '&signature='));
        $this->assertSame('hmac-sha256='.hash_hmac('sha256', $signedBase, 'sk_test_key'), $query['signature']);
    }

    public function test_upload_action_requires_media_manage_permission(): void
    {
        $viewer = $this->adminWith(PermissionKey::MediaView);

        $this->actingAs($viewer)
            ->postJson(route('uploadthing.action', ['slug' => 'image', 'actionType' => 'upload']), [
                'files' => [['name' => 'hero.webp', 'size' => 1234, 'type' => 'image/webp']],
                'input' => ['folderId' => null],
            ])
            ->assertForbidden();

        Http::assertNothingSent();
    }

    public function test_upload_action_rejects_invalid_files_before_provider_request(): void
    {
        $manager = $this->adminWith(PermissionKey::MediaManage);

        $invalidType = $this->actingAs($manager)
            ->postJson(route('uploadthing.action', ['slug' => 'image', 'actionType' => 'upload']), [
                'files' => [['name' => 'poster.pdf', 'size' => 1234, 'type' => 'application/pdf']],
                'input' => ['folderId' => null],
            ]);
        $invalidType->assertStatus(422);
        $this->assertSame('Jenis file tidak sesuai dengan jalur unggah.', $invalidType->json('errors')['files.0'][0]);

        $tooLarge = $this->actingAs($manager)
            ->postJson(route('uploadthing.action', ['slug' => 'image', 'actionType' => 'upload']), [
                'files' => [['name' => 'large.webp', 'size' => 20 * 1024 * 1024 + 1, 'type' => 'image/webp']],
                'input' => ['folderId' => null],
            ]);
        $tooLarge->assertStatus(422);
        $this->assertSame('Ukuran gambar maksimal 20 MB.', $tooLarge->json('errors')['files.0'][0]);

        Http::assertNothingSent();
    }

    public function test_signed_callback_persists_one_asset_and_is_idempotent(): void
    {
        $manager = $this->adminWith(PermissionKey::MediaManage);
        $folder = MediaFolder::factory()->create();
        $payload = $this->callbackPayload($manager, $folder);
        $raw = json_encode($payload, JSON_THROW_ON_ERROR);
        $signature = 'hmac-sha256='.hash_hmac('sha256', $raw, 'sk_test_key');

        Http::fake([
            'https://iad1.ingest.test/callback-result' => Http::response(['ok' => true]),
        ]);

        $first = $this->postCallback($raw, $signature);
        $first->assertOk()->assertJson(['ok' => true]);

        $this->assertDatabaseHas('media_assets', [
            'provider' => 'uploadthing',
            'provider_key' => $payload['file']['key'],
            'url' => $payload['file']['ufsUrl'],
            'owner_user_id' => $manager->id,
            'folder_id' => $folder->id,
            'lifecycle' => 'ready',
        ]);
        $this->assertDatabaseCount('audit_logs', 1);

        $second = $this->postCallback($raw, $signature);
        $second->assertOk()->assertJson(['ok' => true]);

        $this->assertDatabaseCount('media_assets', 1);
        $this->assertDatabaseCount('audit_logs', 1);
        Http::assertSentCount(2);
        Http::assertSent(fn ($request): bool => str_ends_with($request->url(), '/callback-result')
            && $request->data()['fileKey'] === $payload['file']['key']
            && isset($request->data()['callbackData']['mediaAssetId']));
    }

    public function test_callback_rejects_invalid_signature_without_persisting(): void
    {
        $manager = $this->adminWith(PermissionKey::MediaManage);
        $raw = json_encode($this->callbackPayload($manager, null), JSON_THROW_ON_ERROR);

        $this->postCallback($raw, 'hmac-sha256='.str_repeat('0', 64))
            ->assertStatus(400);

        $this->assertDatabaseCount('media_assets', 0);
        $this->assertDatabaseCount('audit_logs', 0);
        Http::assertNothingSent();
    }

    public function test_signed_error_hook_is_acknowledged_without_persisting(): void
    {
        $raw = json_encode(['fileKey' => 'file-key', 'message' => 'provider error'], JSON_THROW_ON_ERROR);
        $signature = 'hmac-sha256='.hash_hmac('sha256', $raw, 'sk_test_key');

        $this->postCallback($raw, $signature, 'error')
            ->assertOk()
            ->assertJson(['ok' => true]);

        $this->assertDatabaseCount('media_assets', 0);
        $this->assertDatabaseCount('audit_logs', 0);
        Http::assertNothingSent();
    }

    private function postCallback(string $raw, string $signature, string $hook = 'callback')
    {
        return $this->call('POST', route('uploadthing.action'), [], [], [], [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_UPLOADTHING_HOOK' => $hook,
            'HTTP_X_UPLOADTHING_SIGNATURE' => $signature,
        ], $raw);
    }

    /**
     * @return array<string, mixed>
     */
    private function callbackPayload(User $manager, ?MediaFolder $folder): array
    {
        return [
            'status' => 'uploaded',
            'file' => [
                'key' => 'appkey-test-hero',
                'name' => 'hero.webp',
                'size' => 1234,
                'type' => 'image/webp',
                'lastModified' => 1700000000000,
                'url' => 'https://ufs.sh/f/hero',
                'appUrl' => 'https://ufs.sh/f/hero',
                'ufsUrl' => 'https://ufs.sh/f/hero',
                'fileHash' => 'hash',
                'customId' => null,
            ],
            'origin' => 'https://iad1.ingest.test',
            'metadata' => [
                'userId' => $manager->id,
                'email' => $manager->email,
                'kind' => 'image',
                'folderId' => $folder?->id,
            ],
        ];
    }

    private function fakeToken(): string
    {
        return base64_encode(json_encode([
            'apiKey' => 'sk_test_key',
            'appId' => 'app_test',
            'regions' => ['iad1'],
            'ingestHost' => 'ingest.test',
        ], JSON_THROW_ON_ERROR));
    }

    private function adminWith(PermissionKey ...$permissions): User
    {
        $user = User::factory()->create();
        AdminProfile::create(['user_id' => $user->id, 'status' => 'active']);
        $role = Role::create([
            'slug' => 'uploadthing-test-role-'.$user->id,
            'label' => 'UploadThing Test Role',
            'description' => 'Role untuk pengujian adapter UploadThing.',
        ]);
        $permissionKeys = collect([PermissionKey::AdminView, ...$permissions])
            ->unique()
            ->map(fn (PermissionKey $permission): string => Permission::firstOrCreate(
                ['key' => $permission->value],
                ['label' => $permission->value, 'description' => 'Permission test.'],
            )->key)
            ->all();
        $role->permissions()->attach($permissionKeys);
        $user->roles()->attach($role->id, ['granted_at' => now()]);

        return $user;
    }
}

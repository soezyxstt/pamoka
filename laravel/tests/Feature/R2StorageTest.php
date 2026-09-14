<?php

namespace Tests\Feature;

use App\Enums\PermissionKey;
use App\Models\AdminProfile;
use App\Models\MediaFolder;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Services\R2Storage;
use Aws\MockHandler;
use Aws\Result;
use Aws\S3\S3Client;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class R2StorageTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'services.r2.endpoint' => 'https://account.r2.cloudflarestorage.com',
            'services.r2.key' => 'r2-test-key',
            'services.r2.secret' => 'r2-test-secret',
            'services.r2.bucket' => 'pamoka-test',
            'services.r2.public_url' => 'https://media.pamoka.test',
            'services.r2.region' => 'auto',
        ]);
    }

    public function test_media_manager_can_prepare_r2_upload_and_register_processing_asset(): void
    {
        $manager = $this->adminWith(PermissionKey::MediaManage);
        $folder = MediaFolder::factory()->create();
        $this->bindStorage();

        $response = $this->actingAs($manager)->postJson(route('r2.upload.prepare'), [
            'kind' => 'image',
            'folderId' => $folder->id,
            'files' => [['name' => 'hero.webp', 'size' => 1234, 'type' => 'image/webp']],
        ]);

        $response->assertOk()->assertJsonCount(1, 'files');
        $this->assertSame('hero.webp', $response->json('files.0.name'));
        $this->assertSame('image/webp', $response->json('files.0.headers.Content-Type'));
        $this->assertStringContainsString('.r2.cloudflarestorage.com/', (string) $response->json('files.0.url'));
        $this->assertDatabaseHas('media_assets', [
            'provider' => 'r2',
            'filename' => 'hero.webp',
            'mime_type' => 'image/webp',
            'bytes' => 1234,
            'folder_id' => $folder->id,
            'owner_user_id' => $manager->id,
            'lifecycle' => 'processing',
        ]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'media.upload.prepare', 'source' => 'r2-upload']);
    }

    public function test_complete_verifies_r2_object_marks_asset_ready_and_is_idempotent(): void
    {
        $manager = $this->adminWith(PermissionKey::MediaManage);
        $handler = new MockHandler([new Result(['ContentLength' => 1234, 'ContentType' => 'image/webp'])]);
        $this->bindStorage($handler);

        $prepared = $this->actingAs($manager)->postJson(route('r2.upload.prepare'), [
            'kind' => 'image',
            'folderId' => null,
            'files' => [['name' => 'hero.webp', 'size' => 1234, 'type' => 'image/webp']],
        ])->assertOk()->json('files.0');

        $this->assertDatabaseHas('media_assets', ['id' => $prepared['assetId'], 'owner_user_id' => $manager->id]);
        $first = $this->actingAs($manager)->postJson(route('r2.upload.complete'), ['assetIds' => [$prepared['assetId']]]);
        $first->assertOk()->assertJsonPath('assets.0.provider', 'r2');
        $this->assertDatabaseHas('media_assets', ['id' => $prepared['assetId'], 'lifecycle' => 'ready']);
        $this->assertDatabaseCount('audit_logs', 2);

        $this->actingAs($manager)->postJson(route('r2.upload.complete'), ['assetIds' => [$prepared['assetId']]])
            ->assertOk()
            ->assertJsonPath('assets.0.mediaAssetId', $prepared['assetId']);
        $this->assertDatabaseCount('audit_logs', 2);
    }

    public function test_prepare_requires_media_manage_permission(): void
    {
        $viewer = $this->adminWith(PermissionKey::MediaView);

        $this->actingAs($viewer)->postJson(route('r2.upload.prepare'), [
            'kind' => 'image',
            'folderId' => null,
            'files' => [['name' => 'hero.webp', 'size' => 1234, 'type' => 'image/webp']],
        ])->assertForbidden();

        $this->assertDatabaseCount('media_assets', 0);
    }

    public function test_prepare_rejects_invalid_files_before_r2_request(): void
    {
        $manager = $this->adminWith(PermissionKey::MediaManage);
        $this->bindStorage();

        $response = $this->actingAs($manager)->postJson(route('r2.upload.prepare'), [
            'kind' => 'image',
            'folderId' => null,
            'files' => [['name' => 'poster.pdf', 'size' => 1234, 'type' => 'application/pdf']],
        ]);

        $response->assertStatus(422);
        $this->assertDatabaseCount('media_assets', 0);
        $this->assertDatabaseCount('audit_logs', 0);
    }

    private function bindStorage(?MockHandler $handler = null): void
    {
        $this->app->instance(R2Storage::class, new R2Storage(new S3Client([
            'version' => 'latest',
            'region' => 'auto',
            'endpoint' => 'https://account.r2.cloudflarestorage.com',
            'force_path_style' => true,
            'credentials' => ['key' => 'r2-test-key', 'secret' => 'r2-test-secret'],
            ...($handler ? ['handler' => $handler] : []),
        ])));
    }

    private function adminWith(PermissionKey ...$permissions): User
    {
        $user = User::factory()->create();
        AdminProfile::create(['user_id' => $user->id, 'status' => 'active']);
        $role = Role::create([
            'slug' => 'r2-test-role-'.$user->id,
            'label' => 'R2 Test Role',
            'description' => 'Role untuk pengujian storage R2.',
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

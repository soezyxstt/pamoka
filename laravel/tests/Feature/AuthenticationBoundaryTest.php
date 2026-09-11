<?php

namespace Tests\Feature;

use App\Enums\PermissionEffect;
use App\Models\AccessRequest;
use App\Models\AdminProfile;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Models\UserPermissionOverride;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class AuthenticationBoundaryTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_guests_are_sent_to_the_google_login_page(): void
    {
        $this->get('/admin')->assertRedirect(route('admin.login'));

        $this->get(route('admin.login'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Admin/Login')
                ->where('googleAuthUrl', route('auth.google.redirect'))
                ->where('googleConfigured', false)
            );
    }

    public function test_google_callback_creates_a_pending_admin_account(): void
    {
        config([
            'services.google.client_id' => 'test-client-id',
            'services.google.client_secret' => 'test-client-secret',
        ]);
        Http::fake([
            'https://oauth2.googleapis.com/token' => Http::response([
                'access_token' => 'google-access-token',
                'token_type' => 'Bearer',
            ]),
            'https://www.googleapis.com/oauth2/v3/userinfo' => Http::response([
                'sub' => 'google-user-123',
                'name' => 'Mojang Contoh',
                'email' => 'mojang@example.com',
                'email_verified' => true,
                'picture' => 'https://example.com/avatar.png',
            ]),
        ]);

        $start = $this->get(route('auth.google.redirect'));
        $authorizationUrl = $start->headers->get('Location');
        parse_str((string) parse_url((string) $authorizationUrl, PHP_URL_QUERY), $query);

        $this->assertSame('https://accounts.google.com/o/oauth2/v2/auth', parse_url((string) $authorizationUrl, PHP_URL_SCHEME).'://'.parse_url((string) $authorizationUrl, PHP_URL_HOST).parse_url((string) $authorizationUrl, PHP_URL_PATH));
        $this->assertNotEmpty($query['state'] ?? null);

        $response = $this->get(route('auth.google.callback', [
            'code' => 'authorization-code',
            'state' => $query['state'],
        ]));

        $response->assertRedirect(route('admin.request-access'));
        $this->assertAuthenticated();
        $this->assertDatabaseHas('users', [
            'email' => 'mojang@example.com',
            'name' => 'Mojang Contoh',
        ]);
        $this->assertDatabaseHas('oauth_accounts', [
            'provider' => 'google',
            'provider_account_id' => 'google-user-123',
        ]);
        $this->assertDatabaseHas('admin_profiles', [
            'status' => 'pending',
        ]);
    }

    public function test_pending_admin_cannot_enter_the_dashboard(): void
    {
        $user = User::factory()->create();
        AdminProfile::create([
            'user_id' => $user->id,
            'status' => 'pending',
        ]);

        $this->actingAs($user)
            ->get('/admin')
            ->assertRedirect(route('admin.request-access'));
    }

    public function test_active_admin_with_admin_view_permission_can_enter_the_dashboard(): void
    {
        $user = User::factory()->create();
        AdminProfile::create([
            'user_id' => $user->id,
            'status' => 'active',
        ]);
        $permission = Permission::create([
            'key' => 'admin.view',
            'label' => 'Melihat area admin',
            'description' => 'Membuka dashboard admin.',
        ]);
        $role = Role::create([
            'slug' => 'content_editor',
            'label' => 'Editor Konten',
            'description' => 'Mengelola konten yang ditugaskan.',
        ]);
        $role->permissions()->attach($permission->key);
        $user->roles()->attach($role->id, ['granted_at' => now()]);

        $this->actingAs($user)
            ->get('/admin')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Admin/Dashboard')
                ->where('user.name', $user->name)
            );
    }

    public function test_permission_override_can_deny_an_inherited_permission(): void
    {
        $user = User::factory()->create();
        AdminProfile::create([
            'user_id' => $user->id,
            'status' => 'active',
        ]);
        $permission = Permission::create([
            'key' => 'admin.view',
            'label' => 'Melihat area admin',
            'description' => 'Membuka dashboard admin.',
        ]);
        $role = Role::create([
            'slug' => 'content_editor',
            'label' => 'Editor Konten',
            'description' => 'Mengelola konten yang ditugaskan.',
        ]);
        $role->permissions()->attach($permission->key);
        $user->roles()->attach($role->id, ['granted_at' => now()]);
        UserPermissionOverride::create([
            'user_id' => $user->id,
            'permission_key' => $permission->key,
            'effect' => PermissionEffect::Deny,
            'reason' => 'Akses ditangguhkan sementara.',
        ]);

        $this->actingAs($user)->get('/admin')->assertForbidden();
    }

    public function test_pending_admin_can_submit_one_access_request_with_an_audit_record(): void
    {
        $user = User::factory()->create();
        AdminProfile::create([
            'user_id' => $user->id,
            'status' => 'pending',
        ]);

        $this->actingAs($user)
            ->post(route('admin.request-access.store'), [
                'reason' => 'Saya perlu mengelola berita dan galeri kegiatan.',
                'areas' => ['content', 'voting'],
            ])
            ->assertRedirect(route('admin.request-access'));

        $this->assertDatabaseHas('access_requests', [
            'user_id' => $user->id,
            'status' => 'open',
            'reason' => 'Saya perlu mengelola berita dan galeri kegiatan.',
        ]);
        $request = AccessRequest::query()->where('user_id', $user->id)->firstOrFail();
        $this->assertSame(['content', 'voting'], $request->requested_areas_json);
        $this->assertDatabaseHas('admin_profiles', [
            'user_id' => $user->id,
            'requested_at' => $request->created_at,
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'actor_user_id' => $user->id,
            'action' => 'access.request.create',
            'resource_type' => 'accessRequest',
            'resource_id' => $request->id,
        ]);
    }

    public function test_pending_admin_cannot_submit_a_second_open_access_request(): void
    {
        $user = User::factory()->create();
        AdminProfile::create([
            'user_id' => $user->id,
            'status' => 'pending',
        ]);
        AccessRequest::create([
            'user_id' => $user->id,
            'status' => 'open',
            'reason' => 'Permintaan pertama yang masih dibuka.',
            'requested_areas_json' => ['content'],
        ]);

        $this->actingAs($user)
            ->from(route('admin.request-access'))
            ->post(route('admin.request-access.store'), [
                'reason' => 'Permintaan kedua tidak boleh dibuat.',
                'areas' => ['content'],
            ])
            ->assertSessionHasErrors('reason');

        $this->assertDatabaseCount('access_requests', 1);
    }
}

<?php

namespace Tests\Feature;

use App\Models\AdminProfile;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class MonitorControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_monitor_is_sent_to_admin_login(): void
    {
        $this->get(route('admin.monitor'))
            ->assertRedirect(route('admin.login'));
    }

    public function test_active_admin_without_voting_view_is_sent_to_access_request(): void
    {
        $user = $this->activeAdmin(['admin.view']);

        $this->actingAs($user)
            ->get(route('admin.monitor'))
            ->assertRedirect(route('admin.request-access'));
    }

    public function test_voting_view_admin_sees_category_totals_and_top_three(): void
    {
        $this->artisan('moka:import-participants', ['--apply' => true]);
        $this->artisan('moka:import-voting', ['--apply' => true]);
        $user = $this->activeAdmin(['admin.view', 'voting.view']);

        $response = $this->actingAs($user)->get(route('admin.monitor'));

        $response->assertOk();
        $response->assertInertia(fn (AssertableInertia $page) => $page
            ->component('Admin/Monitor')
            ->where('campaign.name', 'Voting Kameumeut 2025')
            ->where('totalAmount', 0)
            ->has('categories', 4)
            ->where('categories.0.code', 'MR')
            ->where('categories.0.candidateCount', 11)
            ->where('categories.0.totalAmount', 0)
            ->has('categories.0.top', 3)
            ->where('categories.0.top.0.totalAmount', 0)
        );
    }

    /**
     * @param  list<string>  $permissionKeys
     */
    private function activeAdmin(array $permissionKeys): User
    {
        $user = User::factory()->create();
        AdminProfile::create([
            'user_id' => $user->id,
            'status' => 'active',
        ]);
        $role = Role::create([
            'slug' => 'monitor-test-'.fake()->unique()->slug(),
            'label' => 'Monitor test',
            'description' => 'Role untuk pengujian monitor.',
        ]);

        foreach ($permissionKeys as $key) {
            $permission = Permission::query()->firstOrCreate(
                ['key' => $key],
                ['label' => $key, 'description' => 'Permission pengujian.'],
            );
            $role->permissions()->attach($permission->key);
        }

        $user->roles()->attach($role->id, ['granted_at' => now()]);

        return $user;
    }
}

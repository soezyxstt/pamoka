<?php

namespace Tests\Feature;

use App\Models\AdminProfile;
use App\Models\Edition;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Services\ActiveEditionContext;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class AdminEditionContextTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_context_falls_back_to_the_newest_active_edition(): void
    {
        $user = $this->activeAdmin();
        Edition::factory()->create(['year' => 2025, 'lifecycle' => 'active']);
        $newest = Edition::factory()->create(['year' => 2026, 'lifecycle' => 'active']);

        $this->actingAs($user)
            ->get(route('admin.dashboard'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Admin/Dashboard')
                ->where('admin.activeEdition.id', $newest->id)
                ->where('admin.activeEdition.year', 2026)
            );
    }

    public function test_admin_context_honors_cookie_selection_and_can_change_it(): void
    {
        $user = $this->activeAdmin();
        $fallback = Edition::factory()->create(['year' => 2026, 'lifecycle' => 'active']);
        $selected = Edition::factory()->create(['year' => 2024, 'lifecycle' => 'archived']);

        $this->actingAs($user)
            ->withCookie(ActiveEditionContext::COOKIE_NAME, $selected->id)
            ->get(route('admin.dashboard'))
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('admin.activeEdition.id', $selected->id)
                ->where('admin.activeEdition.year', 2024)
            );

        $this->actingAs($user)
            ->post(route('admin.edition-context.store'), ['edition_id' => $selected->id])
            ->assertRedirect(route('admin.dashboard'))
            ->assertCookie(ActiveEditionContext::COOKIE_NAME, $selected->id);

        $this->assertNotSame($fallback->id, $selected->id);
    }

    private function activeAdmin(): User
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

        return $user;
    }
}

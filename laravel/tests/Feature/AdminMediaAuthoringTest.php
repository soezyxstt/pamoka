<?php

namespace Tests\Feature;

use App\Enums\PermissionKey;
use App\Models\AdminProfile;
use App\Models\Edition;
use App\Models\Event;
use App\Models\Gallery;
use App\Models\GalleryItem;
use App\Models\MediaAsset;
use App\Models\Permission;
use App\Models\Role;
use App\Models\Sponsor;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class AdminMediaAuthoringTest extends TestCase
{
    use RefreshDatabase;

    public function test_sponsor_authoring_is_edition_scoped_and_activation_requires_publish_permission(): void
    {
        $editor = $this->adminWith(PermissionKey::ContentView, PermissionKey::SponsorsManage);
        $publisher = $this->adminWith(PermissionKey::ContentView, PermissionKey::SponsorsManage, PermissionKey::ContentPublish);
        $edition = Edition::factory()->create(['year' => 2025, 'lifecycle' => 'active']);
        $otherEdition = Edition::factory()->create(['year' => 2026, 'lifecycle' => 'active']);
        $logo = MediaAsset::factory()->create(['mime_type' => 'image/png']);

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.sponsors.store'), [
                'name' => 'Mitra Garut',
                'tier' => 'utama',
                'website' => 'https://mitra.example',
                'logo_media_id' => $logo->id,
                'display_order' => 1,
            ])
            ->assertRedirect();

        $sponsor = Sponsor::query()->where('name', 'Mitra Garut')->firstOrFail();
        $this->assertSame($edition->id, $sponsor->edition_id);
        $this->assertFalse($sponsor->active);
        $this->assertDatabaseHas('audit_logs', ['action' => 'sponsor.create', 'resource_id' => $sponsor->id]);

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.sponsors.toggle', $sponsor->id), ['version' => 1])
            ->assertForbidden();

        $this->actingAs($publisher)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.sponsors.toggle', $sponsor->id), ['version' => 1])
            ->assertRedirect(route('admin.sponsors.index'));

        $this->assertDatabaseHas('sponsors', ['id' => $sponsor->id, 'active' => 1, 'version' => 2]);

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $otherEdition->id)
            ->get(route('admin.sponsors.edit', $sponsor->id))
            ->assertNotFound();

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->get(route('admin.sponsors.index'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Admin/Sponsors/Index')
                ->has('sponsors', 1)
                ->where('sponsors.0.name', 'Mitra Garut'));
    }

    public function test_event_authoring_reorders_and_blocks_delete_when_gallery_is_linked(): void
    {
        $editor = $this->adminWith(PermissionKey::ContentView, PermissionKey::EventsManage);
        $edition = Edition::factory()->create(['year' => 2025, 'lifecycle' => 'active']);
        $hero = MediaAsset::factory()->create();

        foreach ([['label' => 'Audisi', 'slug' => 'audisi'], ['label' => 'Final', 'slug' => 'final']] as $event) {
            $this->actingAs($editor)
                ->withCookie('pamoka_admin_edition_id', $edition->id)
                ->post(route('admin.events.store'), [
                    ...$event,
                    'description' => 'Rangkaian kegiatan PAMOKA.',
                    'hero_media_id' => $hero->id,
                    'display_order' => 0,
                ])
                ->assertRedirect();
        }

        $events = Event::query()->where('edition_id', $edition->id)->orderBy('id')->get();
        $first = $events->firstOrFail();
        $second = $events->last();

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.events.reorder'), [
                'items' => [
                    ['id' => $second->id, 'version' => $second->version],
                    ['id' => $first->id, 'version' => $first->version],
                ],
            ])
            ->assertRedirect(route('admin.events.index'));

        $this->assertDatabaseHas('events', ['id' => $second->id, 'display_order' => 1, 'version' => 2]);
        $this->assertDatabaseHas('events', ['id' => $first->id, 'display_order' => 2, 'version' => 2]);

        Gallery::factory()->create([
            'edition_id' => $edition->id,
            'owner_type' => 'event',
            'owner_id' => $second->id,
        ]);

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->delete(route('admin.events.destroy', $second->id), ['version' => 2])
            ->assertSessionHasErrors('event');

        $this->assertDatabaseHas('events', ['id' => $second->id]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'event.reorder', 'resource_id' => $edition->id]);
    }

    public function test_gallery_authoring_keeps_owner_in_the_edition_and_manages_photo_video_items(): void
    {
        $editor = $this->adminWith(PermissionKey::ContentView, PermissionKey::GalleryManage);
        $edition = Edition::factory()->create(['year' => 2025, 'lifecycle' => 'active']);
        $event = Event::factory()->create(['edition_id' => $edition->id]);
        $mediaOne = MediaAsset::factory()->create(['filename' => 'satu.webp']);
        $mediaTwo = MediaAsset::factory()->create(['filename' => 'dua.webp']);
        $cover = MediaAsset::factory()->create(['filename' => 'cover.webp']);

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.galleries.store'), [
                'title' => 'Dokumentasi Audisi',
                'slug' => 'dokumentasi-audisi',
                'description' => 'Kumpulan dokumentasi kegiatan audisi.',
                'cover_media_id' => $cover->id,
                'owner_type' => 'event',
                'owner_id' => $event->id,
                'display_order' => 1,
                'status' => 'published',
            ])
            ->assertRedirect();

        $gallery = Gallery::query()->where('slug', 'dokumentasi-audisi')->firstOrFail();
        $this->assertSame($event->id, $gallery->owner_id);
        $this->assertSame('event', $gallery->owner_type);

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.galleries.items.add', $gallery->id), [
                'version' => 1,
                'media_ids' => [$mediaOne->id, $mediaTwo->id],
                'youtube_id' => 'https://youtu.be/5w0ORZ0XUkE',
                'caption' => 'Dokumentasi kegiatan',
            ])
            ->assertRedirect(route('admin.galleries.edit', $gallery->id));

        $this->assertDatabaseCount('gallery_items', 3);
        $this->assertDatabaseHas('gallery_items', ['gallery_id' => $gallery->id, 'youtube_id' => '5w0ORZ0XUkE', 'media_asset_id' => null]);
        $this->assertDatabaseHas('galleries', ['id' => $gallery->id, 'version' => 2]);

        $items = GalleryItem::query()->where('gallery_id', $gallery->id)->orderBy('display_order')->get();
        $firstItem = $items->firstOrFail();
        $lastItem = $items->last();

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->put(route('admin.galleries.items.update', [$gallery->id, $firstItem->id]), [
                'version' => 2,
                'caption' => 'Caption diperbarui',
            ])
            ->assertRedirect(route('admin.galleries.edit', $gallery->id));

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.galleries.items.reorder', $gallery->id), [
                'version' => 3,
                'item_ids' => [$lastItem->id, ...$items->where('id', '!=', $lastItem->id)->pluck('id')->all()],
            ])
            ->assertRedirect(route('admin.galleries.edit', $gallery->id));

        $this->assertDatabaseHas('galleries', ['id' => $gallery->id, 'version' => 4]);

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.galleries.items.add', $gallery->id), [
                'version' => 4,
                'media_ids' => [],
                'youtube_id' => 'not a youtube id!',
            ])
            ->assertSessionHasErrors('youtube_id');

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->delete(route('admin.galleries.items.delete', [$gallery->id, $firstItem->id]), ['version' => 4])
            ->assertRedirect(route('admin.galleries.edit', $gallery->id));

        $this->assertDatabaseHas('galleries', ['id' => $gallery->id, 'version' => 5]);
        $this->assertDatabaseMissing('gallery_items', ['id' => $firstItem->id]);
    }

    public function test_each_media_authoring_mutation_requires_its_specific_permission(): void
    {
        $viewer = $this->adminWith(PermissionKey::ContentView);
        $edition = Edition::factory()->create(['year' => 2025, 'lifecycle' => 'active']);

        $this->actingAs($viewer)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.sponsors.store'), ['name' => 'Tanpa izin', 'tier' => 'utama', 'display_order' => 0])
            ->assertForbidden();
        $this->actingAs($viewer)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.events.store'), ['label' => 'Acara', 'slug' => 'acara', 'display_order' => 0])
            ->assertForbidden();
        $this->actingAs($viewer)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.galleries.store'), ['title' => 'Album', 'slug' => 'album', 'owner_type' => 'standalone', 'display_order' => 0, 'status' => 'draft'])
            ->assertForbidden();
    }

    private function adminWith(PermissionKey ...$permissions): User
    {
        $user = User::factory()->create();
        AdminProfile::create(['user_id' => $user->id, 'status' => 'active']);
        $role = Role::create([
            'slug' => 'media-test-role-'.$user->id,
            'label' => 'Media Test Role',
            'description' => 'Role untuk pengujian authoring media.',
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

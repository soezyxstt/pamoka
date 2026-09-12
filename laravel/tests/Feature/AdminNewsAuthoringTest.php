<?php

namespace Tests\Feature;

use App\Enums\PermissionKey;
use App\Models\AdminProfile;
use App\Models\Edition;
use App\Models\MediaAsset;
use App\Models\NewsArticle;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class AdminNewsAuthoringTest extends TestCase
{
    use RefreshDatabase;

    public function test_editor_can_list_only_articles_from_the_selected_edition(): void
    {
        $editor = $this->adminWith(PermissionKey::ContentView, PermissionKey::NewsManage);
        $edition = Edition::factory()->create(['year' => 2025, 'lifecycle' => 'active']);
        $otherEdition = Edition::factory()->create(['year' => 2026, 'lifecycle' => 'active']);
        $article = NewsArticle::factory()->create(['edition_id' => $edition->id]);
        NewsArticle::factory()->create(['edition_id' => $otherEdition->id]);

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->get(route('admin.news.index'))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Admin/News/Index')
                ->has('articles', 1)
                ->where('articles.0.id', $article->id)
                ->where('canEdit', true)
            );
    }

    public function test_editor_can_create_and_update_a_draft_with_revision_and_audit_records(): void
    {
        $editor = $this->adminWith(PermissionKey::ContentView, PermissionKey::NewsManage);
        $edition = Edition::factory()->create(['year' => 2025, 'lifecycle' => 'active']);

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.news.store'), [
                'title' => 'Berita pembukaan pendaftaran',
                'slug' => '',
                'excerpt' => 'Informasi pembukaan pendaftaran peserta.',
                'body' => "Pendaftaran dibuka untuk masyarakat Kabupaten Garut.\n\nInformasi lengkap tersedia di halaman resmi.",
                'kind' => 'internal',
                'source_url' => '',
                'cover_media_id' => '',
            ])
            ->assertRedirect();

        $article = NewsArticle::query()->where('title', 'Berita pembukaan pendaftaran')->firstOrFail();
        $this->assertSame('berita-pembukaan-pendaftaran', $article->slug);
        $this->assertSame('draft', $article->status);
        $this->assertNotNull($article->body_json);
        $this->assertDatabaseCount('content_drafts', 1);
        $this->assertDatabaseCount('content_revisions', 1);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'news.create',
            'resource_id' => $article->id,
        ]);

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->put(route('admin.news.update', $article->id), [
                'title' => 'Berita pembukaan pendaftaran diperbarui',
                'slug' => $article->slug,
                'excerpt' => 'Informasi terbaru pembukaan pendaftaran peserta.',
                'body' => 'Jadwal terbaru tersedia pada halaman resmi.',
                'kind' => 'internal',
                'source_url' => '',
                'cover_media_id' => '',
                'version' => 1,
            ])
            ->assertRedirect(route('admin.news.edit', $article->id));

        $article->refresh();
        $this->assertSame(2, $article->version);
        $this->assertSame('Berita pembukaan pendaftaran diperbarui', $article->title);
        $this->assertDatabaseCount('content_drafts', 1);
        $this->assertDatabaseCount('content_revisions', 2);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'news.update',
            'resource_id' => $article->id,
        ]);

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->get(route('admin.news.edit', $article->id))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Admin/News/Form')
                ->has('revisions', 2)
                ->where('revisions.0.snapshot.title', 'Berita pembukaan pendaftaran diperbarui')
            );
    }

    public function test_editor_can_save_a_structured_tiptap_document_and_public_route_renders_it(): void
    {
        $publisher = $this->adminWith(
            PermissionKey::ContentView,
            PermissionKey::NewsManage,
            PermissionKey::ContentPublish,
        );
        $edition = Edition::factory()->create(['year' => 2025, 'lifecycle' => 'active']);
        $media = MediaAsset::factory()->create([
            'lifecycle' => 'ready',
            'mime_type' => 'image/webp',
            'alt' => 'Foto kegiatan PAMOKA',
        ]);
        $document = [
            'type' => 'doc',
            'content' => [
                [
                    'type' => 'heading',
                    'attrs' => ['level' => 2],
                    'content' => [[
                        'type' => 'text',
                        'text' => 'Pendaftaran peserta 2025',
                        'marks' => [['type' => 'bold']],
                    ]],
                ],
                [
                    'type' => 'paragraph',
                    'content' => [[
                        'type' => 'text',
                        'text' => 'Informasi lengkap tersedia di halaman resmi.',
                        'marks' => [[
                            'type' => 'link',
                            'attrs' => ['href' => 'https://pamoka.example/pendaftaran'],
                        ]],
                    ]],
                ],
                [
                    'type' => 'image',
                    'attrs' => [
                        'src' => 'https://attacker.example/not-allowed.webp',
                        'mediaAssetId' => $media->id,
                        'alt' => 'Poster pendaftaran',
                    ],
                ],
            ],
        ];

        $this->actingAs($publisher)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.news.store'), [
                'title' => 'Pendaftaran peserta 2025',
                'slug' => 'pendaftaran-peserta-2025',
                'excerpt' => 'Informasi pendaftaran peserta untuk rangkaian kegiatan 2025.',
                'body' => '',
                'body_json' => json_encode($document, JSON_THROW_ON_ERROR),
                'kind' => 'internal',
                'source_url' => '',
                'cover_media_id' => $media->id,
            ])
            ->assertRedirect();

        $article = NewsArticle::query()->where('slug', 'pendaftaran-peserta-2025')->firstOrFail();
        $stored = $article->body_json;

        $this->assertSame('heading', $stored['content'][0]['type']);
        $this->assertSame('bold', $stored['content'][0]['content'][0]['marks'][0]['type']);
        $this->assertSame($media->url, $stored['content'][2]['attrs']['src']);
        $this->assertSame($media->id, $stored['content'][2]['attrs']['mediaAssetId']);

        $this->actingAs($publisher)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.news.publish', $article->id), ['version' => 1])
            ->assertRedirect();

        $this->get(route('public.news.show', ['slug' => $article->slug]))
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Public/News/Show')
                ->where('article.bodyJson.content.0.type', 'heading')
                ->where('article.bodyJson.content.2.attrs.src', $media->url)
            );
    }

    public function test_editor_rejects_an_external_image_without_a_ready_media_reference(): void
    {
        $editor = $this->adminWith(PermissionKey::ContentView, PermissionKey::NewsManage);
        $edition = Edition::factory()->create(['year' => 2025, 'lifecycle' => 'active']);

        $response = $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.news.store'), [
                'title' => 'Berita dengan gambar eksternal',
                'slug' => 'berita-dengan-gambar-eksternal',
                'excerpt' => 'Ringkasan berita yang cukup untuk disimpan.',
                'body' => '',
                'body_json' => json_encode([
                    'type' => 'doc',
                    'content' => [[
                        'type' => 'image',
                        'attrs' => ['src' => 'https://attacker.example/image.webp'],
                    ]],
                ], JSON_THROW_ON_ERROR),
                'kind' => 'internal',
                'source_url' => '',
                'cover_media_id' => '',
            ]);

        $response->assertSessionHasErrors('body_json');
        $this->assertDatabaseMissing('news_articles', ['slug' => 'berita-dengan-gambar-eksternal']);
    }

    public function test_publisher_can_publish_unpublish_and_archive_a_ready_article(): void
    {
        $publisher = $this->adminWith(
            PermissionKey::ContentView,
            PermissionKey::NewsManage,
            PermissionKey::ContentPublish,
        );
        $edition = Edition::factory()->create(['year' => 2025, 'lifecycle' => 'active']);
        $media = MediaAsset::factory()->create([
            'lifecycle' => 'ready',
            'mime_type' => 'image/jpeg',
        ]);
        $article = NewsArticle::factory()->create([
            'edition_id' => $edition->id,
            'title' => 'Informasi penting untuk peserta',
            'excerpt' => 'Ringkasan informasi penting untuk seluruh peserta.',
            'body' => 'Isi informasi penting untuk peserta.',
            'cover_media_id' => $media->id,
            'status' => 'draft',
            'version' => 1,
        ]);

        $this->actingAs($publisher)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.news.publish', $article->id), ['version' => 1])
            ->assertRedirect(route('admin.news.edit', $article->id));

        $article->refresh();
        $this->assertSame('published', $article->status);
        $this->assertSame(2, $article->version);
        $this->assertNotNull($article->published_at);
        $this->assertDatabaseHas('content_revisions', [
            'resource_id' => $article->id,
            'version' => 2,
            'reason' => 'Terbitkan artikel',
        ]);

        $this->actingAs($publisher)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.news.unpublish', $article->id), ['version' => 2])
            ->assertRedirect(route('admin.news.edit', $article->id));
        $this->assertDatabaseHas('news_articles', [
            'id' => $article->id,
            'status' => 'draft',
            'version' => 3,
        ]);

        $this->actingAs($publisher)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.news.archive', $article->id), ['version' => 3])
            ->assertRedirect(route('admin.news.edit', $article->id));
        $this->assertDatabaseHas('news_articles', [
            'id' => $article->id,
            'status' => 'archived',
            'version' => 4,
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'news.publish',
            'resource_id' => $article->id,
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'news.unpublish',
            'resource_id' => $article->id,
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'news.archive',
            'resource_id' => $article->id,
        ]);
    }

    public function test_publish_requires_excerpt_cover_and_body(): void
    {
        $publisher = $this->adminWith(PermissionKey::ContentView, PermissionKey::ContentPublish);
        $edition = Edition::factory()->create(['year' => 2025, 'lifecycle' => 'active']);
        $article = NewsArticle::factory()->create([
            'edition_id' => $edition->id,
            'title' => 'Draft belum siap',
            'excerpt' => 'Ringkasan yang cukup untuk validasi.',
            'body' => null,
            'cover_media_id' => null,
            'status' => 'draft',
            'version' => 1,
        ]);

        $this->actingAs($publisher)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.news.publish', $article->id), ['version' => 1])
            ->assertSessionHasErrors('cover_media_id');

        $media = MediaAsset::factory()->create([
            'lifecycle' => 'ready',
            'mime_type' => 'image/jpeg',
        ]);
        $article->update(['cover_media_id' => $media->id]);

        $this->actingAs($publisher)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.news.publish', $article->id), ['version' => 1])
            ->assertSessionHasErrors('body');

        $this->assertDatabaseHas('news_articles', [
            'id' => $article->id,
            'status' => 'draft',
            'version' => 1,
        ]);
    }

    public function test_stale_versions_and_cross_edition_articles_are_rejected(): void
    {
        $editor = $this->adminWith(PermissionKey::ContentView, PermissionKey::NewsManage);
        $edition = Edition::factory()->create(['year' => 2025, 'lifecycle' => 'active']);
        $otherEdition = Edition::factory()->create(['year' => 2026, 'lifecycle' => 'active']);
        $article = NewsArticle::factory()->create(['edition_id' => $edition->id, 'version' => 2]);

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->put(route('admin.news.update', $article->id), [
                'title' => 'Judul yang tidak boleh menimpa versi baru',
                'slug' => $article->slug,
                'excerpt' => 'Ringkasan yang cukup untuk disimpan.',
                'body' => 'Isi draft.',
                'kind' => 'internal',
                'version' => 1,
            ])
            ->assertSessionHasErrors('version');

        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $otherEdition->id)
            ->get(route('admin.news.edit', $article->id))
            ->assertNotFound();
    }

    public function test_news_mutations_require_news_manage_and_publish_requires_content_publish(): void
    {
        $viewer = $this->adminWith(PermissionKey::ContentView);
        $edition = Edition::factory()->create(['year' => 2025, 'lifecycle' => 'active']);
        $article = NewsArticle::factory()->create(['edition_id' => $edition->id]);

        $this->actingAs($viewer)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.news.store'), [
                'title' => 'Berita tanpa izin tulis',
                'slug' => 'berita-tanpa-izin-tulis',
                'kind' => 'internal',
            ])
            ->assertForbidden();

        $editor = $this->adminWith(PermissionKey::ContentView, PermissionKey::NewsManage);
        $this->actingAs($editor)
            ->withCookie('pamoka_admin_edition_id', $edition->id)
            ->post(route('admin.news.publish', $article->id), ['version' => $article->version])
            ->assertForbidden();
    }

    private function adminWith(PermissionKey ...$permissions): User
    {
        $user = User::factory()->create();
        AdminProfile::create([
            'user_id' => $user->id,
            'status' => 'active',
        ]);
        $role = Role::create([
            'slug' => 'news-test-role-'.$user->id,
            'label' => 'News Test Role',
            'description' => 'Role untuk pengujian authoring berita.',
        ]);

        $permissionKeys = collect([PermissionKey::AdminView, ...$permissions])
            ->unique()
            ->mapWithKeys(fn (PermissionKey $permission): array => [
                $permission->value => Permission::firstOrCreate(
                    ['key' => $permission->value],
                    [
                        'label' => $permission->value,
                        'description' => 'Permission test.',
                    ],
                ),
            ]);
        $role->permissions()->attach($permissionKeys->keys()->all());
        $user->roles()->attach($role->id, ['granted_at' => now()]);

        return $user;
    }
}

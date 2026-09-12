<?php

namespace App\Http\Controllers;

use App\Enums\PermissionKey;
use App\Models\AuditLog;
use App\Models\Edition;
use App\Models\Event;
use App\Models\Gallery;
use App\Models\GalleryItem;
use App\Models\MediaAsset;
use App\Models\User;
use App\Services\ActiveEditionContext;
use App\Services\AuthorizationService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class AdminGalleriesController extends Controller
{
    public function index(
        Request $request,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): Response {
        $this->ensurePermission($request, $authorization, PermissionKey::ContentView);
        $edition = $this->resolveEdition($request, $editionContext);
        $events = $edition === null ? collect() : Event::query()->where('edition_id', $edition->id)->orderBy('display_order')->orderBy('label')->get();
        $galleries = $edition === null
            ? []
            : Gallery::query()
                ->with(['coverMedia', 'items'])
                ->where('edition_id', $edition->id)
                ->orderBy('display_order')
                ->orderBy('created_at')
                ->get()
                ->map(fn (Gallery $gallery): array => $this->presentGallery($gallery, $events->firstWhere('id', $gallery->owner_id)?->label))
                ->values()
                ->all();

        return Inertia::render('Admin/Galleries/Index', [
            'user' => $this->presentUser($request),
            'editionName' => $edition?->name ?? 'Edisi aktif',
            'galleries' => $galleries,
            'canEdit' => $this->hasPermission($request, $authorization, PermissionKey::GalleryManage),
        ]);
    }

    public function create(
        Request $request,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): Response {
        $this->ensurePermission($request, $authorization, PermissionKey::GalleryManage);
        $edition = $this->resolveEdition($request, $editionContext);
        abort_if($edition === null, 404);

        return Inertia::render('Admin/Galleries/Form', $this->formProps($request, $authorization, $edition, null));
    }

    public function edit(
        Request $request,
        string $id,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): Response {
        $this->ensurePermission($request, $authorization, PermissionKey::ContentView);
        $edition = $this->resolveEdition($request, $editionContext);
        abort_if($edition === null, 404);
        $gallery = $this->findGallery($id, $edition);

        return Inertia::render('Admin/Galleries/Form', $this->formProps($request, $authorization, $edition, $gallery));
    }

    public function store(
        Request $request,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::GalleryManage);
        $edition = $this->resolveEdition($request, $editionContext);
        abort_if($edition === null, 422, 'Konteks edisi aktif tidak ditemukan.');
        $payload = $this->validatedGalleryPayload($request, $edition);
        /** @var User $actor */
        $actor = $request->user();

        $gallery = DB::transaction(function () use ($actor, $edition, $payload): Gallery {
            $gallery = Gallery::create([
                'edition_id' => $edition->id,
                'slug' => $payload['slug'],
                'title' => $payload['title'],
                'description' => $payload['description'],
                'cover_media_id' => $payload['cover_media_id'],
                'owner_type' => $payload['owner_type'],
                'owner_id' => $payload['owner_id'],
                'display_order' => $payload['display_order'],
                'status' => $payload['status'],
                'active' => true,
                'version' => 1,
            ]);
            $this->recordAudit($actor, 'gallery.create', null, $gallery, [
                'edition_id',
                'slug',
                'title',
                'description',
                'cover_media_id',
                'owner_type',
                'owner_id',
                'display_order',
                'status',
                'active',
                'version',
            ]);

            return $gallery;
        });

        return to_route('admin.galleries.edit', ['id' => $gallery->id])->with('status', 'Album galeri disimpan.');
    }

    public function update(
        Request $request,
        string $id,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::GalleryManage);
        $edition = $this->resolveEdition($request, $editionContext);
        abort_if($edition === null, 422, 'Konteks edisi aktif tidak ditemukan.');
        $payload = $this->validatedGalleryPayload($request, $edition, $id);
        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($actor, $edition, $id, $payload): void {
            $gallery = $this->lockedGallery($id, $edition);
            $this->assertVersion($gallery, (int) $payload['version']);
            $before = $this->snapshot($gallery);
            $gallery->forceFill([
                'slug' => $payload['slug'],
                'title' => $payload['title'],
                'description' => $payload['description'],
                'cover_media_id' => $payload['cover_media_id'],
                'owner_type' => $payload['owner_type'],
                'owner_id' => $payload['owner_id'],
                'display_order' => $payload['display_order'],
                'status' => $payload['status'],
                'active' => $payload['active'] === null ? (bool) $gallery->active : (bool) $payload['active'],
                'version' => (int) $gallery->version + 1,
            ])->save();
            $this->recordAudit($actor, 'gallery.update', $before, $gallery, [
                'slug',
                'title',
                'description',
                'cover_media_id',
                'owner_type',
                'owner_id',
                'display_order',
                'status',
                'active',
                'version',
            ]);
        });

        return to_route('admin.galleries.edit', ['id' => $id])->with('status', 'Detail album disimpan.');
    }

    public function destroy(
        Request $request,
        string $id,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::GalleryManage);
        $edition = $this->resolveEdition($request, $editionContext);
        abort_if($edition === null, 422, 'Konteks edisi aktif tidak ditemukan.');
        $version = $request->validate(['version' => ['required', 'integer', 'min:1']])['version'];
        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($actor, $edition, $id, $version): void {
            $gallery = $this->lockedGallery($id, $edition);
            $this->assertVersion($gallery, (int) $version);
            $before = $this->snapshot($gallery);
            $gallery->delete();
            $this->recordAudit($actor, 'gallery.delete', $before, null, ['deleted']);
        });

        return to_route('admin.galleries.index')->with('status', 'Album galeri dihapus.');
    }

    public function addItems(
        Request $request,
        string $id,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::GalleryManage);
        $edition = $this->resolveEdition($request, $editionContext);
        abort_if($edition === null, 422, 'Konteks edisi aktif tidak ditemukan.');
        $validated = $request->validate([
            'version' => ['required', 'integer', 'min:1'],
            'media_ids' => ['nullable', 'array'],
            'media_ids.*' => ['uuid'],
            'youtube_id' => ['nullable', 'string', 'max:2000'],
            'caption' => ['nullable', 'string', 'max:5000'],
        ]);
        $mediaIds = array_values(array_unique(array_filter($validated['media_ids'] ?? [], 'is_string')));
        $youtubeId = $this->normalizeYoutubeId($validated['youtube_id'] ?? null);
        if (count($mediaIds) === 0 && $youtubeId === null) {
            throw ValidationException::withMessages(['youtube_id' => 'Pilih minimal satu foto atau video YouTube.']);
        }
        if (count($mediaIds) > 0) {
            $validCount = MediaAsset::query()->whereIn('id', $mediaIds)->where('lifecycle', 'ready')->where('mime_type', 'like', 'image/%')->count();
            if ($validCount !== count($mediaIds)) {
                throw ValidationException::withMessages(['media_ids' => 'Semua foto harus berasal dari aset gambar siap pakai.']);
            }
        }
        /** @var User $actor */
        $actor = $request->user();
        $caption = filled($validated['caption'] ?? null) ? trim($validated['caption']) : null;

        DB::transaction(function () use ($actor, $edition, $id, $validated, $mediaIds, $youtubeId, $caption): void {
            $gallery = $this->lockedGallery($id, $edition);
            $this->assertVersion($gallery, (int) $validated['version']);
            $lastOrder = (int) (GalleryItem::query()->where('gallery_id', $gallery->id)->max('display_order') ?? 0);
            if ($youtubeId !== null) {
                GalleryItem::create([
                    'gallery_id' => $gallery->id,
                    'media_asset_id' => null,
                    'youtube_id' => $youtubeId,
                    'caption' => $caption,
                    'display_order' => ++$lastOrder,
                    'active' => true,
                ]);
            }
            foreach ($mediaIds as $mediaId) {
                GalleryItem::create([
                    'gallery_id' => $gallery->id,
                    'media_asset_id' => $mediaId,
                    'youtube_id' => null,
                    'caption' => $caption,
                    'display_order' => ++$lastOrder,
                    'active' => true,
                ]);
            }
            $before = $this->snapshot($gallery);
            $gallery->forceFill(['version' => (int) $gallery->version + 1])->save();
            $this->recordAudit($actor, 'gallery.items.add', $before, $gallery, ['items', 'version']);
        });

        return to_route('admin.galleries.edit', ['id' => $id])->with('status', 'Item galeri ditambahkan.');
    }

    public function updateItem(
        Request $request,
        string $galleryId,
        string $itemId,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::GalleryManage);
        $edition = $this->resolveEdition($request, $editionContext);
        abort_if($edition === null, 422, 'Konteks edisi aktif tidak ditemukan.');
        $validated = $request->validate([
            'version' => ['required', 'integer', 'min:1'],
            'caption' => ['nullable', 'string', 'max:5000'],
            'active' => ['nullable', 'boolean'],
        ]);
        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($actor, $edition, $galleryId, $itemId, $validated): void {
            $gallery = $this->lockedGallery($galleryId, $edition);
            $this->assertVersion($gallery, (int) $validated['version']);
            $item = GalleryItem::query()->where('gallery_id', $gallery->id)->whereKey($itemId)->lockForUpdate()->firstOrFail();
            $before = $this->snapshotItem($item);
            $item->forceFill([
                'caption' => array_key_exists('caption', $validated) && filled($validated['caption']) ? trim($validated['caption']) : (array_key_exists('caption', $validated) ? null : $item->caption),
                'active' => array_key_exists('active', $validated) ? (bool) $validated['active'] : $item->active,
            ])->save();
            $gallery->forceFill(['version' => (int) $gallery->version + 1])->save();
            $this->recordItemAudit($actor, 'gallery.item.update', $gallery, $before, $item, ['items', 'version']);
        });

        return to_route('admin.galleries.edit', ['id' => $galleryId])->with('status', 'Item galeri diperbarui.');
    }

    public function deleteItem(
        Request $request,
        string $galleryId,
        string $itemId,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::GalleryManage);
        $edition = $this->resolveEdition($request, $editionContext);
        abort_if($edition === null, 422, 'Konteks edisi aktif tidak ditemukan.');
        $version = $request->validate(['version' => ['required', 'integer', 'min:1']])['version'];
        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($actor, $edition, $galleryId, $itemId, $version): void {
            $gallery = $this->lockedGallery($galleryId, $edition);
            $this->assertVersion($gallery, (int) $version);
            $item = GalleryItem::query()->where('gallery_id', $gallery->id)->whereKey($itemId)->lockForUpdate()->firstOrFail();
            $before = $this->snapshotItem($item);
            $item->delete();
            $galleryBefore = $this->snapshot($gallery);
            $gallery->forceFill(['version' => (int) $gallery->version + 1])->save();
            $this->recordItemAudit($actor, 'gallery.item.delete', $gallery, $before, null, ['items', 'version'], $galleryBefore);
        });

        return to_route('admin.galleries.edit', ['id' => $galleryId])->with('status', 'Item galeri dihapus.');
    }

    public function reorderItems(
        Request $request,
        string $id,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::GalleryManage);
        $edition = $this->resolveEdition($request, $editionContext);
        abort_if($edition === null, 422, 'Konteks edisi aktif tidak ditemukan.');
        $validated = $request->validate([
            'version' => ['required', 'integer', 'min:1'],
            'item_ids' => ['required', 'array'],
            'item_ids.*' => ['required', 'uuid'],
        ]);
        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($actor, $edition, $id, $validated): void {
            $gallery = $this->lockedGallery($id, $edition);
            $this->assertVersion($gallery, (int) $validated['version']);
            $items = GalleryItem::query()->where('gallery_id', $gallery->id)->lockForUpdate()->get();
            $ids = $validated['item_ids'];
            if (count($ids) !== $items->count() || count(array_unique($ids)) !== count($ids) || $items->pluck('id')->diff($ids)->isNotEmpty()) {
                throw ValidationException::withMessages(['item_ids' => 'Daftar item galeri telah berubah. Muat ulang halaman.']);
            }
            foreach ($ids as $index => $itemId) {
                GalleryItem::query()->where('gallery_id', $gallery->id)->whereKey($itemId)->update(['display_order' => $index + 1]);
            }
            $before = $this->snapshot($gallery);
            $gallery->forceFill(['version' => (int) $gallery->version + 1])->save();
            $this->recordAudit($actor, 'gallery.items.reorder', $before, $gallery, ['items', 'version']);
        });

        return to_route('admin.galleries.edit', ['id' => $id])->with('status', 'Urutan item galeri diperbarui.');
    }

    private function formProps(
        Request $request,
        AuthorizationService $authorization,
        Edition $edition,
        ?Gallery $gallery,
    ): array {
        $media = MediaAsset::query()
            ->where('lifecycle', 'ready')
            ->where('mime_type', 'like', 'image/%')
            ->orderByDesc('created_at')
            ->limit(200)
            ->get();
        $events = Event::query()->where('edition_id', $edition->id)->orderBy('display_order')->orderBy('label')->get();
        if ($gallery?->cover_media_id !== null && ! $media->contains('id', $gallery->cover_media_id)) {
            $selected = MediaAsset::query()->find($gallery->cover_media_id);
            if ($selected !== null) {
                $media->prepend($selected);
            }
        }

        return [
            'user' => $this->presentUser($request),
            'editionName' => $edition->name,
            'gallery' => $gallery === null ? null : $this->presentGallery($gallery, $events->firstWhere('id', $gallery->owner_id)?->label),
            'events' => $events->map(fn (Event $event): array => ['id' => $event->id, 'label' => $event->label])->values()->all(),
            'mediaOptions' => $media->map(fn (MediaAsset $asset): array => [
                'id' => $asset->id,
                'url' => $asset->url,
                'filename' => $asset->filename,
                'alt' => $asset->alt,
            ])->values()->all(),
            'canEdit' => $this->hasPermission($request, $authorization, PermissionKey::GalleryManage),
        ];
    }

    private function validatedGalleryPayload(Request $request, Edition $edition, ?string $id = null): array
    {
        $slugRule = Rule::unique('galleries', 'slug')->where(fn ($query) => $query->where('edition_id', $edition->id));
        if ($id !== null) {
            $slugRule = $slugRule->ignore($id);
        }
        $validated = $request->validate([
            'title' => ['required', 'string', 'min:2', 'max:255'],
            'slug' => ['required', 'string', 'max:255', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $slugRule],
            'description' => ['nullable', 'string', 'max:10000'],
            'cover_media_id' => ['nullable', 'uuid'],
            'owner_type' => ['required', Rule::in(['standalone', 'event'])],
            'owner_id' => ['nullable', 'uuid'],
            'display_order' => ['required', 'integer', 'min:0', 'max:2147483647'],
            'status' => ['required', Rule::in(['draft', 'published'])],
            'active' => ['nullable', 'boolean'],
            'version' => $id === null ? ['nullable', 'integer', 'min:1'] : ['required', 'integer', 'min:1'],
        ]);
        $coverId = $validated['cover_media_id'] ?? null;
        if ($coverId !== null && $this->readyImage((string) $coverId) === null) {
            throw ValidationException::withMessages(['cover_media_id' => 'Cover harus berupa gambar siap pakai.']);
        }
        $ownerType = $validated['owner_type'];
        $ownerId = $ownerType === 'standalone' ? $edition->id : ($validated['owner_id'] ?? null);
        if ($ownerType === 'event' && ($ownerId === null || ! Event::query()->where('edition_id', $edition->id)->whereKey($ownerId)->exists())) {
            throw ValidationException::withMessages(['owner_id' => 'Acara harus berasal dari edisi aktif.']);
        }

        return [
            'title' => trim($validated['title']),
            'slug' => strtolower(trim($validated['slug'])),
            'description' => filled($validated['description'] ?? null) ? trim($validated['description']) : null,
            'cover_media_id' => $coverId,
            'owner_type' => $ownerType,
            'owner_id' => $ownerId,
            'display_order' => (int) $validated['display_order'],
            'status' => $validated['status'],
            'active' => $validated['active'] ?? null,
            'version' => $validated['version'] ?? null,
        ];
    }

    private function resolveEdition(Request $request, ActiveEditionContext $editionContext): ?Edition
    {
        $resolved = $editionContext->resolve($request->cookie(ActiveEditionContext::COOKIE_NAME));

        return $resolved === null ? null : Edition::query()->find($resolved['id']);
    }

    private function findGallery(string $id, Edition $edition): Gallery
    {
        return Gallery::query()->with(['coverMedia', 'items.mediaAsset'])->where('edition_id', $edition->id)->whereKey($id)->firstOrFail();
    }

    private function lockedGallery(string $id, Edition $edition): Gallery
    {
        return Gallery::query()->where('edition_id', $edition->id)->whereKey($id)->lockForUpdate()->firstOrFail();
    }

    private function readyImage(string $id): ?MediaAsset
    {
        return MediaAsset::query()->whereKey($id)->where('lifecycle', 'ready')->where('mime_type', 'like', 'image/%')->first();
    }

    private function normalizeYoutubeId(?string $value): ?string
    {
        $value = trim((string) $value);
        if ($value === '') {
            return null;
        }
        if (preg_match('/^[A-Za-z0-9_-]{6,20}$/', $value) === 1) {
            return $value;
        }
        $parsed = parse_url($value);
        if (! is_array($parsed)) {
            return null;
        }
        $host = strtolower((string) ($parsed['host'] ?? ''));
        $path = trim((string) ($parsed['path'] ?? ''), '/');
        $candidate = null;
        if ($host === 'youtu.be') {
            $candidate = explode('/', $path)[0] ?? null;
        } elseif (in_array($host, ['youtube.com', 'www.youtube.com', 'm.youtube.com'], true)) {
            parse_str((string) ($parsed['query'] ?? ''), $query);
            $candidate = $query['v'] ?? null;
            if ($candidate === null && preg_match('#^(?:embed|shorts)/([^/]+)#', $path, $matches) === 1) {
                $candidate = $matches[1];
            }
        }

        return is_string($candidate) && preg_match('/^[A-Za-z0-9_-]{6,20}$/', $candidate) === 1 ? $candidate : null;
    }

    private function assertVersion(Gallery $gallery, int $version): void
    {
        if ((int) $gallery->version !== $version) {
            throw ValidationException::withMessages(['version' => 'Versi galeri telah berubah. Muat ulang halaman.']);
        }
    }

    private function snapshot(Gallery $gallery): array
    {
        return [
            'id' => $gallery->id,
            'edition_id' => $gallery->edition_id,
            'slug' => $gallery->slug,
            'title' => $gallery->title,
            'description' => $gallery->description,
            'cover_media_id' => $gallery->cover_media_id,
            'owner_type' => $gallery->owner_type,
            'owner_id' => $gallery->owner_id,
            'display_order' => (int) $gallery->display_order,
            'status' => $gallery->status,
            'active' => (bool) $gallery->active,
            'version' => (int) $gallery->version,
        ];
    }

    private function snapshotItem(GalleryItem $item): array
    {
        return [
            'id' => $item->id,
            'gallery_id' => $item->gallery_id,
            'media_asset_id' => $item->media_asset_id,
            'youtube_id' => $item->youtube_id,
            'caption' => $item->caption,
            'display_order' => (int) $item->display_order,
            'active' => (bool) $item->active,
        ];
    }

    private function presentGallery(Gallery $gallery, ?string $ownerLabel = null): array
    {
        $items = $gallery->relationLoaded('items') ? $gallery->items : collect();

        return [
            'id' => $gallery->id,
            'editionId' => $gallery->edition_id,
            'slug' => $gallery->slug,
            'title' => $gallery->title,
            'description' => $gallery->description,
            'coverMediaId' => $gallery->cover_media_id,
            'ownerType' => $gallery->owner_type,
            'ownerId' => $gallery->owner_id,
            'displayOrder' => (int) $gallery->display_order,
            'status' => $gallery->status,
            'active' => (bool) $gallery->active,
            'version' => (int) $gallery->version,
            'createdAt' => $gallery->created_at?->toIso8601String(),
            'ownerLabel' => $ownerLabel,
            'coverUrl' => $gallery->coverMedia?->url,
            'coverAlt' => $gallery->coverMedia?->alt,
            'itemCount' => $items->count(),
            'photoCount' => $items->whereNotNull('media_asset_id')->count(),
            'videoCount' => $items->whereNotNull('youtube_id')->count(),
            'items' => $items->map(fn (GalleryItem $item): array => [
                'id' => $item->id,
                'mediaAssetId' => $item->media_asset_id,
                'youtubeId' => $item->youtube_id,
                'caption' => $item->caption,
                'displayOrder' => (int) $item->display_order,
                'active' => (bool) $item->active,
                'media' => $item->mediaAsset === null ? null : [
                    'id' => $item->mediaAsset->id,
                    'url' => $item->mediaAsset->url,
                    'filename' => $item->mediaAsset->filename,
                    'alt' => $item->mediaAsset->alt,
                ],
            ])->values()->all(),
        ];
    }

    private function recordAudit(
        User $actor,
        string $action,
        ?array $before,
        ?Gallery $gallery,
        array $changedFields,
    ): void {
        AuditLog::create([
            'actor_user_id' => $actor->id,
            'actor_label' => $actor->email,
            'action' => $action,
            'resource_type' => 'gallery',
            'resource_id' => $gallery?->id ?? ($before['id'] ?? null),
            'resource_label' => $gallery?->title ?? ($before['title'] ?? 'Galeri'),
            'before_json' => $before,
            'after_json' => $gallery === null ? null : $this->snapshot($gallery),
            'changed_fields_json' => $changedFields,
            'source' => 'laravel-admin-galleries',
            'created_at' => now(),
        ]);
    }

    private function recordItemAudit(
        User $actor,
        string $action,
        Gallery $gallery,
        array $before,
        ?GalleryItem $item,
        array $changedFields,
        ?array $galleryBefore = null,
    ): void {
        AuditLog::create([
            'actor_user_id' => $actor->id,
            'actor_label' => $actor->email,
            'action' => $action,
            'resource_type' => 'gallery',
            'resource_id' => $gallery->id,
            'resource_label' => $gallery->title,
            'before_json' => ['item' => $before, 'gallery' => $galleryBefore],
            'after_json' => ['item' => $item === null ? null : $this->snapshotItem($item), 'gallery' => $this->snapshot($gallery)],
            'changed_fields_json' => $changedFields,
            'source' => 'laravel-admin-galleries',
            'created_at' => now(),
        ]);
    }

    private function presentUser(Request $request): array
    {
        /** @var User $user */
        $user = $request->user();

        return ['id' => $user->id, 'name' => $user->name, 'email' => $user->email];
    }

    private function ensurePermission(Request $request, AuthorizationService $authorization, PermissionKey $permission): void
    {
        abort_unless($this->hasPermission($request, $authorization, $permission), 403);
    }

    private function hasPermission(Request $request, AuthorizationService $authorization, PermissionKey $permission): bool
    {
        /** @var User|null $user */
        $user = $request->user();

        return $user !== null && $authorization->has($user, $permission->value);
    }
}

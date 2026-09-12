<?php

namespace App\Http\Controllers;

use App\Enums\PermissionKey;
use App\Models\AuditLog;
use App\Models\Edition;
use App\Models\MediaAsset;
use App\Models\MediaFolder;
use App\Models\User;
use App\Services\ActiveEditionContext;
use App\Services\AuthorizationService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class AdminMediaController extends Controller
{
    public function index(
        Request $request,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): Response {
        $this->ensurePermission($request, $authorization, PermissionKey::MediaView);

        $activeEdition = $editionContext->resolve($request->cookie(ActiveEditionContext::COOKIE_NAME));
        $selectedEdition = $this->resolveSelectedEdition($request, $activeEdition);
        $folderScope = $this->filterValue($request->query('folder_scope'), ['all', 'edition', 'global'], 'edition');
        $type = $this->filterValue($request->query('type'), ['all', 'image', 'video', 'pdf'], 'all');
        $search = trim((string) $request->query('search', ''));
        $search = function_exists('mb_substr') ? mb_substr($search, 0, 120) : substr($search, 0, 120);
        $requestedFolderId = trim((string) $request->query('folder_id', ''));
        $page = max(1, (int) $request->query('page', 1));
        $limit = min(100, max(1, (int) $request->query('limit', 50)));

        $folders = $this->folderQuery($folderScope, $selectedEdition)
            ->withCount(['assets' => fn (Builder $query): Builder => $query->where('lifecycle', 'ready')])
            ->orderBy('name')
            ->orderBy('id')
            ->get();

        $assetQuery = MediaAsset::query()->with('folder')->where('lifecycle', 'ready');
        $this->applyFolderScope($assetQuery, $folderScope, $selectedEdition);

        if ($requestedFolderId === 'root') {
            $assetQuery->whereNull('folder_id');
        } elseif ($requestedFolderId !== '') {
            $assetQuery->where('folder_id', $requestedFolderId);
        }

        if ($type !== 'all') {
            $assetQuery->where('mime_type', 'like', $type === 'image' ? 'image/%' : ($type === 'video' ? 'video/%' : 'application/pdf'));
        }

        if ($search !== '') {
            $assetQuery->where(function (Builder $query) use ($search): void {
                $query->where('filename', 'like', '%'.$search.'%')
                    ->orWhere('alt', 'like', '%'.$search.'%');
            });
        }

        $total = (clone $assetQuery)->count();
        $assets = $assetQuery
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->offset(($page - 1) * $limit)
            ->limit($limit)
            ->get()
            ->map(fn (MediaAsset $asset): array => $this->presentAsset($asset))
            ->values()
            ->all();

        $currentFolder = $requestedFolderId !== '' && $requestedFolderId !== 'root'
            ? $folders->firstWhere('id', $requestedFolderId)
            : null;

        return Inertia::render('Admin/Media/Index', [
            'user' => $this->presentUser($request),
            'editionName' => $selectedEdition?->name ?? 'Semua edisi',
            'assets' => $assets,
            'folders' => $folders->map(fn (MediaFolder $folder): array => $this->presentFolder($folder))->values()->all(),
            'editions' => $editionContext->all(),
            'activeEditionId' => $activeEdition['id'] ?? null,
            'selectedEditionId' => $selectedEdition?->id,
            'folderSelection' => $requestedFolderId,
            'currentFolderId' => $currentFolder?->id,
            'currentFolder' => $currentFolder === null ? null : $this->presentFolder($currentFolder),
            'folderScope' => $folderScope,
            'type' => $type,
            'search' => $search,
            'page' => $page,
            'limit' => $limit,
            'total' => $total,
            'hasMore' => ($page - 1) * $limit + count($assets) < $total,
            'canManage' => $this->hasPermission($request, $authorization, PermissionKey::MediaManage),
        ]);
    }

    public function storeFolder(
        Request $request,
        AuthorizationService $authorization,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::MediaManage);
        $payload = $this->folderPayload($request, null, true);
        $this->assertFolderReferences($payload['parent_id'], $payload['edition_id']);
        $this->assertFolderSlugAvailable($payload['parent_id'], $payload['slug']);
        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($actor, $payload): void {
            $folder = MediaFolder::create([
                'id' => (string) Str::uuid(),
                'parent_id' => $payload['parent_id'],
                'edition_id' => $payload['edition_id'],
                'name' => $payload['name'],
                'slug' => $payload['slug'],
                'owner_user_id' => $actor->id,
            ]);
            $this->recordAudit(
                $actor,
                'media.folder.create',
                'media_folder',
                $folder->id,
                $folder->name,
                null,
                $this->folderSnapshot($folder),
                ['parent_id', 'edition_id', 'name', 'slug', 'owner_user_id'],
            );
        });

        return to_route('admin.media.index')->with('status', 'Folder media dibuat.');
    }

    public function updateFolder(
        Request $request,
        string $id,
        AuthorizationService $authorization,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::MediaManage);
        $folder = MediaFolder::query()->findOrFail($id);
        $payload = $this->folderPayload($request, $folder->edition_id, false);
        $this->assertFolderReferences($folder->parent_id, $payload['edition_id']);
        $this->assertFolderSlugAvailable($folder->parent_id, $payload['slug'], $folder->id);
        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($actor, $id, $payload): void {
            $folder = MediaFolder::query()->whereKey($id)->lockForUpdate()->firstOrFail();
            $before = $this->folderSnapshot($folder);
            $folder->forceFill([
                'edition_id' => $payload['edition_id'],
                'name' => $payload['name'],
                'slug' => $payload['slug'],
            ])->save();
            $this->recordAudit(
                $actor,
                'media.folder.rename',
                'media_folder',
                $folder->id,
                $folder->name,
                $before,
                $this->folderSnapshot($folder),
                ['edition_id', 'name', 'slug'],
            );
        });

        return to_route('admin.media.index')->with('status', 'Folder media diperbarui.');
    }

    public function updateAssetMetadata(
        Request $request,
        string $id,
        AuthorizationService $authorization,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::MediaManage);
        $validated = $request->validate([
            'alt' => ['sometimes', 'nullable', 'string', 'max:10000'],
            'decorative' => ['required', 'boolean'],
        ]);
        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($actor, $id, $request, $validated): void {
            $asset = MediaAsset::query()->whereKey($id)->lockForUpdate()->firstOrFail();
            $decorative = (bool) $validated['decorative'];
            $alt = $asset->alt;
            if ($decorative) {
                $alt = null;
            } elseif ($request->has('alt')) {
                $alt = filled($validated['alt'] ?? null) ? trim((string) $validated['alt']) : null;
            }
            $before = $this->assetSnapshot($asset);
            $asset->forceFill([
                'alt' => $alt,
                'decorative' => $decorative,
            ])->save();
            $this->recordAudit(
                $actor,
                'media.asset.metadata.update',
                'media_asset',
                $asset->id,
                $asset->filename,
                $before,
                $this->assetSnapshot($asset),
                ['alt', 'decorative'],
            );
        });

        return to_route('admin.media.index')->with('status', 'Metadata media diperbarui.');
    }

    public function moveAsset(
        Request $request,
        string $id,
        AuthorizationService $authorization,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::MediaManage);
        $validated = $request->validate([
            'folder_id' => ['sometimes', 'nullable', 'uuid'],
        ]);
        $folderId = array_key_exists('folder_id', $validated) && filled($validated['folder_id'])
            ? (string) $validated['folder_id']
            : null;
        if ($folderId !== null && ! MediaFolder::query()->whereKey($folderId)->exists()) {
            throw ValidationException::withMessages(['folder_id' => 'Folder tujuan tidak ditemukan.']);
        }
        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($actor, $id, $folderId): void {
            $asset = MediaAsset::query()->whereKey($id)->lockForUpdate()->firstOrFail();
            $before = $this->assetSnapshot($asset);
            $asset->forceFill(['folder_id' => $folderId])->save();
            $this->recordAudit(
                $actor,
                'media.asset.move',
                'media_asset',
                $asset->id,
                $asset->filename,
                $before,
                $this->assetSnapshot($asset),
                ['folder_id'],
            );
        });

        return to_route('admin.media.index')->with('status', 'Lokasi media diperbarui.');
    }

    private function folderQuery(string $scope, ?Edition $edition): Builder
    {
        return MediaFolder::query()->when(
            $scope === 'global',
            fn (Builder $query): Builder => $query->whereNull('edition_id'),
            fn (Builder $query): Builder => $scope === 'edition'
                ? $query->where(function (Builder $nested) use ($edition): void {
                    $nested->whereNull('edition_id');
                    if ($edition !== null) {
                        $nested->orWhere('edition_id', $edition->id);
                    }
                })
                : $query,
        );
    }

    private function applyFolderScope(Builder $query, string $scope, ?Edition $edition): void
    {
        if ($scope === 'all') {
            return;
        }

        $folderQuery = MediaFolder::query()->whereNull('edition_id');
        if ($scope === 'edition' && $edition !== null) {
            $folderQuery->orWhere('edition_id', $edition->id);
        }
        $folderIds = $folderQuery->pluck('id')->all();
        $query->where(function (Builder $nested) use ($folderIds): void {
            $nested->whereNull('folder_id');
            if ($folderIds !== []) {
                $nested->orWhereIn('folder_id', $folderIds);
            }
        });
    }

    /**
     * @param  list<string>  $allowed
     */
    private function filterValue(mixed $value, array $allowed, string $default): string
    {
        $value = is_string($value) ? strtolower($value) : '';

        return in_array($value, $allowed, true) ? $value : $default;
    }

    /**
     * @return array{name: string, slug: string, parent_id: string|null, edition_id: string|null}
     */
    private function folderPayload(Request $request, ?string $defaultEditionId, bool $includeParent): array
    {
        $rules = [
            'name' => ['required', 'string', 'max:80'],
            'edition_id' => ['sometimes', 'nullable', 'uuid'],
        ];
        if ($includeParent) {
            $rules['parent_id'] = ['sometimes', 'nullable', 'uuid'];
        }
        $validated = $request->validate($rules);
        $name = trim((string) $validated['name']);
        $name = preg_replace('/\s+/u', ' ', $name) ?? $name;
        $length = function_exists('mb_strlen') ? mb_strlen($name) : strlen($name);
        if ($length < 1 || $length > 80) {
            throw ValidationException::withMessages(['name' => 'Nama folder harus berisi 1 sampai 80 karakter.']);
        }
        $slug = Str::lower(Str::ascii($name));
        $slug = trim((string) preg_replace('/[^a-z0-9]+/', '-', $slug), '-');
        if ($slug === '') {
            throw ValidationException::withMessages(['name' => 'Nama folder harus menghasilkan slug yang valid.']);
        }

        return [
            'name' => $name,
            'slug' => $slug,
            'parent_id' => $includeParent && array_key_exists('parent_id', $validated) && filled($validated['parent_id'])
                ? (string) $validated['parent_id']
                : null,
            'edition_id' => array_key_exists('edition_id', $validated) && filled($validated['edition_id'])
                ? (string) $validated['edition_id']
                : $defaultEditionId,
        ];
    }

    private function assertFolderReferences(?string $parentId, ?string $editionId): void
    {
        $parent = $parentId === null ? null : MediaFolder::query()->find($parentId);
        if ($parentId !== null && $parent === null) {
            throw ValidationException::withMessages(['parent_id' => 'Folder induk tidak ditemukan.']);
        }
        if ($editionId !== null && ! Edition::query()->whereKey($editionId)->exists()) {
            throw ValidationException::withMessages(['edition_id' => 'Edisi folder tidak ditemukan.']);
        }
        if ($parent?->edition_id !== null && $editionId !== null && $parent->edition_id !== $editionId) {
            throw ValidationException::withMessages(['edition_id' => 'Folder anak harus berada pada edisi yang sama dengan folder induknya.']);
        }
    }

    private function assertFolderSlugAvailable(?string $parentId, string $slug, ?string $ignoreId = null): void
    {
        $query = MediaFolder::query()->where('slug', $slug);
        if ($parentId === null) {
            $query->whereNull('parent_id');
        } else {
            $query->where('parent_id', $parentId);
        }
        if ($ignoreId !== null) {
            $query->where('id', '<>', $ignoreId);
        }
        if ($query->exists()) {
            throw ValidationException::withMessages(['name' => 'Nama folder sudah digunakan pada lokasi induk ini.']);
        }
    }

    private function resolveSelectedEdition(Request $request, ?array $activeEdition): ?Edition
    {
        $requestedId = $request->query('edition_id');
        if (is_string($requestedId) && filled($requestedId)) {
            $requested = Edition::query()->whereKey($requestedId)->first();
            if ($requested !== null) {
                return $requested;
            }
        }

        return $activeEdition === null ? null : Edition::query()->find($activeEdition['id']);
    }

    private function presentFolder(MediaFolder $folder): array
    {
        return [
            'id' => (string) $folder->id,
            'parentId' => $folder->parent_id,
            'editionId' => $folder->edition_id,
            'name' => $folder->name,
            'slug' => $folder->slug,
            'assetCount' => (int) ($folder->assets_count ?? 0),
            'ownerUserId' => $folder->owner_user_id,
            'createdAt' => $folder->created_at?->toIso8601String(),
            'updatedAt' => $folder->updated_at?->toIso8601String(),
        ];
    }

    private function presentAsset(MediaAsset $asset): array
    {
        return [
            'id' => (string) $asset->id,
            'provider' => $asset->provider,
            'providerKey' => $asset->provider_key,
            'url' => $asset->url,
            'filename' => $asset->filename,
            'mimeType' => $asset->mime_type,
            'bytes' => (int) $asset->bytes,
            'alt' => $asset->alt,
            'decorative' => (bool) $asset->decorative,
            'lifecycle' => $asset->lifecycle,
            'folderId' => $asset->folder_id,
            'folderName' => $asset->folder?->name,
            'createdAt' => $asset->created_at?->toIso8601String(),
            'updatedAt' => $asset->updated_at?->toIso8601String(),
        ];
    }

    private function folderSnapshot(MediaFolder $folder): array
    {
        return [
            'id' => $folder->id,
            'parent_id' => $folder->parent_id,
            'edition_id' => $folder->edition_id,
            'name' => $folder->name,
            'slug' => $folder->slug,
            'owner_user_id' => $folder->owner_user_id,
        ];
    }

    private function assetSnapshot(MediaAsset $asset): array
    {
        return [
            'id' => $asset->id,
            'filename' => $asset->filename,
            'alt' => $asset->alt,
            'decorative' => (bool) $asset->decorative,
            'lifecycle' => $asset->lifecycle,
            'folder_id' => $asset->folder_id,
        ];
    }

    private function recordAudit(
        User $actor,
        string $action,
        string $resourceType,
        string $resourceId,
        string $resourceLabel,
        ?array $before,
        ?array $after,
        array $changedFields,
    ): void {
        AuditLog::create([
            'actor_user_id' => $actor->id,
            'actor_label' => $actor->email,
            'action' => $action,
            'resource_type' => $resourceType,
            'resource_id' => $resourceId,
            'resource_label' => $resourceLabel,
            'before_json' => $before,
            'after_json' => $after,
            'changed_fields_json' => $changedFields,
            'source' => 'laravel-admin-media',
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

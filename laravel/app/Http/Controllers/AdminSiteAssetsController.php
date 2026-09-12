<?php

namespace App\Http\Controllers;

use App\Enums\PermissionKey;
use App\Models\AuditLog;
use App\Models\Edition;
use App\Models\MediaAsset;
use App\Models\SiteAssetBinding;
use App\Models\User;
use App\Services\ActiveEditionContext;
use App\Services\AuthorizationService;
use App\Support\SiteAssetManifest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class AdminSiteAssetsController extends Controller
{
    public function index(
        Request $request,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): Response {
        $this->ensurePermission($request, $authorization, PermissionKey::ContentView);
        $edition = $this->resolveEdition($request, $editionContext);
        $bindings = $edition === null
            ? collect()
            : SiteAssetBinding::query()
                ->with('media')
                ->where('edition_id', $edition->id)
                ->get()
                ->keyBy('slot_key');

        $slots = collect(SiteAssetManifest::slots())
            ->map(function (array $definition) use ($bindings): array {
                /** @var SiteAssetBinding|null $binding */
                $binding = $bindings->get($definition['slotKey']);

                return [
                    'definition' => $definition,
                    'binding' => $binding === null ? null : $this->presentBinding($binding),
                    'mediaAsset' => $binding?->media === null ? null : $this->presentMedia($binding->media),
                ];
            })
            ->values()
            ->all();

        return Inertia::render('Admin/SiteAssets/Index', [
            'user' => $this->presentUser($request),
            'editionName' => $edition?->name ?? 'Edisi aktif',
            'slots' => $slots,
            'groups' => SiteAssetManifest::groups(),
            'mediaOptions' => $this->mediaOptions(),
            'canEdit' => $this->hasPermission($request, $authorization, PermissionKey::ContentEdit),
        ]);
    }

    public function bind(
        Request $request,
        string $slotKey,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::ContentEdit);
        $edition = $this->requireEdition($request, $editionContext);
        $definition = SiteAssetManifest::find($slotKey);
        if ($definition === null) {
            throw ValidationException::withMessages(['slot_key' => 'Slot aset situs tidak terdaftar dalam manifest.']);
        }
        $validated = $request->validate([
            'media_id' => ['nullable', 'uuid'],
            'alt_override' => ['nullable', 'string', 'max:255'],
            'focal_x' => ['nullable', 'numeric'],
            'focal_y' => ['nullable', 'numeric'],
            'version' => ['nullable', 'integer', 'min:1'],
        ]);
        $mediaId = filled($validated['media_id'] ?? null) ? (string) $validated['media_id'] : null;
        $media = $mediaId === null ? null : MediaAsset::query()->whereKey($mediaId)->where('lifecycle', 'ready')->first();
        if ($mediaId !== null && $media === null) {
            throw ValidationException::withMessages(['media_id' => 'Media tidak ditemukan atau belum siap digunakan.']);
        }
        if ($media !== null && $definition['acceptType'] === 'image' && ! str_starts_with($media->mime_type, 'image/')) {
            throw ValidationException::withMessages(['media_id' => 'Slot ini hanya menerima file gambar.']);
        }
        if ($media !== null && $definition['acceptType'] === 'video' && ! str_starts_with($media->mime_type, 'video/')) {
            throw ValidationException::withMessages(['media_id' => 'Slot ini hanya menerima file video.']);
        }
        $focalX = $this->clampFocal($validated['focal_x'] ?? null);
        $focalY = $this->clampFocal($validated['focal_y'] ?? null);
        $altOverride = filled($validated['alt_override'] ?? null) ? trim((string) $validated['alt_override']) : null;
        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($actor, $edition, $definition, $slotKey, $mediaId, $altOverride, $focalX, $focalY, $validated): void {
            $binding = SiteAssetBinding::query()
                ->where('edition_id', $edition->id)
                ->where('slot_key', $slotKey)
                ->lockForUpdate()
                ->first();
            $providedVersion = isset($validated['version']) ? (int) $validated['version'] : null;
            if ($binding !== null) {
                if ($providedVersion !== null && (int) $binding->version !== $providedVersion) {
                    throw ValidationException::withMessages(['version' => 'Versi aset situs telah berubah. Muat ulang halaman.']);
                }
                $before = $this->bindingSnapshot($binding);
                $binding->forceFill([
                    'media_id' => $mediaId,
                    'alt_override' => $altOverride,
                    'focal_x' => $focalX,
                    'focal_y' => $focalY,
                    'version' => (int) $binding->version + 1,
                ])->save();
                $this->recordAudit(
                    $actor,
                    'site_asset.bind',
                    $definition,
                    $binding,
                    $before,
                    $this->bindingSnapshot($binding),
                    ['media_id', 'alt_override', 'focal_x', 'focal_y', 'version'],
                );

                return;
            }

            $binding = SiteAssetBinding::create([
                'id' => (string) Str::uuid(),
                'edition_id' => $edition->id,
                'slot_key' => $slotKey,
                'media_id' => $mediaId,
                'alt_override' => $altOverride,
                'focal_x' => $focalX,
                'focal_y' => $focalY,
                'version' => 1,
            ]);
            $this->recordAudit(
                $actor,
                'site_asset.bind',
                $definition,
                $binding,
                null,
                $this->bindingSnapshot($binding),
                ['edition_id', 'slot_key', 'media_id', 'alt_override', 'focal_x', 'focal_y'],
            );
        });

        return to_route('admin.site-assets.index')->with('status', 'Aset situs disimpan.');
    }

    public function unbind(
        Request $request,
        string $slotKey,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::ContentEdit);
        $edition = $this->requireEdition($request, $editionContext);
        $definition = SiteAssetManifest::find($slotKey);
        if ($definition === null) {
            throw ValidationException::withMessages(['slot_key' => 'Slot aset situs tidak terdaftar dalam manifest.']);
        }
        $validated = $request->validate(['version' => ['nullable', 'integer', 'min:1']]);
        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($actor, $edition, $definition, $slotKey, $validated): void {
            $binding = SiteAssetBinding::query()
                ->where('edition_id', $edition->id)
                ->where('slot_key', $slotKey)
                ->lockForUpdate()
                ->first();
            if ($binding === null || $binding->media_id === null) {
                return;
            }
            if (isset($validated['version']) && (int) $binding->version !== (int) $validated['version']) {
                throw ValidationException::withMessages(['version' => 'Versi aset situs telah berubah. Muat ulang halaman.']);
            }
            $before = $this->bindingSnapshot($binding);
            $binding->forceFill([
                'media_id' => null,
                'alt_override' => null,
                'focal_x' => null,
                'focal_y' => null,
                'version' => (int) $binding->version + 1,
            ])->save();
            $this->recordAudit(
                $actor,
                'site_asset.unbind',
                $definition,
                $binding,
                $before,
                $this->bindingSnapshot($binding),
                ['media_id', 'alt_override', 'focal_x', 'focal_y', 'version'],
            );
        });

        return to_route('admin.site-assets.index')->with('status', 'Aset situs dilepas.');
    }

    private function resolveEdition(Request $request, ActiveEditionContext $editionContext): ?Edition
    {
        $resolved = $editionContext->resolve($request->cookie(ActiveEditionContext::COOKIE_NAME));

        return $resolved === null ? null : Edition::query()->find($resolved['id']);
    }

    private function requireEdition(Request $request, ActiveEditionContext $editionContext): Edition
    {
        $edition = $this->resolveEdition($request, $editionContext);
        abort_if($edition === null, 422, 'Konteks edisi aktif tidak ditemukan.');

        return $edition;
    }

    /**
     * @return list<array{id: string, url: string, filename: string, mimeType: string, alt: string|null}>
     */
    private function mediaOptions(): array
    {
        return MediaAsset::query()
            ->where('lifecycle', 'ready')
            ->orderByDesc('created_at')
            ->limit(150)
            ->get()
            ->map(fn (MediaAsset $asset): array => $this->presentMedia($asset))
            ->values()
            ->all();
    }

    private function clampFocal(mixed $value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }

        return max(0, min(100, (int) round((float) $value)));
    }

    /**
     * @param  array{slotKey: string, group: string, pageRoute: string, pageLabel: string, label: string, description: string, acceptType: string, aspectRatio: string, required: bool}  $definition
     */
    private function recordAudit(
        User $actor,
        string $action,
        array $definition,
        SiteAssetBinding $binding,
        ?array $before,
        ?array $after,
        array $changedFields,
    ): void {
        AuditLog::create([
            'actor_user_id' => $actor->id,
            'actor_label' => $actor->email,
            'action' => $action,
            'resource_type' => 'site_asset_binding',
            'resource_id' => $binding->id,
            'resource_label' => $definition['label'].' · '.$binding->slot_key,
            'before_json' => $before,
            'after_json' => $after,
            'changed_fields_json' => $changedFields,
            'source' => 'laravel-admin-site-assets',
            'created_at' => now(),
        ]);
    }

    private function bindingSnapshot(SiteAssetBinding $binding): array
    {
        return [
            'id' => $binding->id,
            'edition_id' => $binding->edition_id,
            'slot_key' => $binding->slot_key,
            'media_id' => $binding->media_id,
            'alt_override' => $binding->alt_override,
            'focal_x' => $binding->focal_x,
            'focal_y' => $binding->focal_y,
            'version' => (int) $binding->version,
        ];
    }

    private function presentBinding(SiteAssetBinding $binding): array
    {
        return [
            'id' => $binding->id,
            'editionId' => $binding->edition_id,
            'slotKey' => $binding->slot_key,
            'mediaId' => $binding->media_id,
            'altOverride' => $binding->alt_override,
            'focalX' => $binding->focal_x,
            'focalY' => $binding->focal_y,
            'version' => (int) $binding->version,
        ];
    }

    private function presentMedia(MediaAsset $asset): array
    {
        return [
            'id' => $asset->id,
            'url' => $asset->url,
            'filename' => $asset->filename,
            'mimeType' => $asset->mime_type,
            'alt' => $asset->alt,
        ];
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

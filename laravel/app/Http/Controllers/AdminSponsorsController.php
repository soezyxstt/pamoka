<?php

namespace App\Http\Controllers;

use App\Enums\PermissionKey;
use App\Models\AuditLog;
use App\Models\Edition;
use App\Models\MediaAsset;
use App\Models\Sponsor;
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

class AdminSponsorsController extends Controller
{
    public function index(
        Request $request,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): Response {
        $this->ensurePermission($request, $authorization, PermissionKey::ContentView);
        $edition = $this->resolveEdition($request, $editionContext);

        $sponsors = $edition === null
            ? []
            : Sponsor::query()
                ->with('logoMedia')
                ->where('edition_id', $edition->id)
                ->orderBy('display_order')
                ->orderBy('created_at')
                ->get()
                ->map(fn (Sponsor $sponsor): array => $this->presentSponsor($sponsor))
                ->values()
                ->all();

        return Inertia::render('Admin/Sponsors/Index', [
            'user' => $this->presentUser($request),
            'editionName' => $edition?->name ?? 'Edisi aktif',
            'sponsors' => $sponsors,
            'canEdit' => $this->hasPermission($request, $authorization, PermissionKey::SponsorsManage),
            'canPublish' => $this->hasPermission($request, $authorization, PermissionKey::ContentPublish),
        ]);
    }

    public function create(
        Request $request,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): Response|RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::SponsorsManage);
        $edition = $this->resolveEdition($request, $editionContext);
        abort_if($edition === null, 404);

        return Inertia::render('Admin/Sponsors/Form', $this->formProps($request, $authorization, $edition, null));
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
        $sponsor = $this->findSponsor($id, $edition);

        return Inertia::render('Admin/Sponsors/Form', $this->formProps($request, $authorization, $edition, $sponsor));
    }

    public function store(
        Request $request,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::SponsorsManage);
        $edition = $this->resolveEdition($request, $editionContext);
        abort_if($edition === null, 422, 'Konteks edisi aktif tidak ditemukan.');
        $payload = $this->validatedPayload($request, $edition);
        /** @var User $actor */
        $actor = $request->user();

        $sponsor = DB::transaction(function () use ($actor, $edition, $payload): Sponsor {
            $sponsor = Sponsor::create([
                'edition_id' => $edition->id,
                'name' => $payload['name'],
                'tier' => $payload['tier'],
                'website' => $payload['website'],
                'logo_media_id' => $payload['logo_media_id'],
                'display_order' => $payload['display_order'],
                'active' => false,
                'version' => 1,
            ]);
            $this->recordAudit($actor, 'sponsor.create', null, $sponsor, [
                'edition_id',
                'name',
                'tier',
                'website',
                'logo_media_id',
                'display_order',
                'active',
                'version',
            ]);

            return $sponsor;
        });

        return to_route('admin.sponsors.edit', ['id' => $sponsor->id])
            ->with('status', 'Sponsor disimpan sebagai nonaktif.');
    }

    public function update(
        Request $request,
        string $id,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::SponsorsManage);
        $edition = $this->resolveEdition($request, $editionContext);
        abort_if($edition === null, 422, 'Konteks edisi aktif tidak ditemukan.');
        $payload = $this->validatedPayload($request, $edition, $id);
        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($actor, $authorization, $edition, $id, $payload, $request): void {
            $sponsor = $this->lockedSponsor($id, $edition);
            $this->assertVersion($sponsor, (int) $payload['version']);
            $active = $payload['active'] === null ? (bool) $sponsor->active : (bool) $payload['active'];
            if ($active && ! $this->hasPermission($request, $authorization, PermissionKey::ContentPublish)) {
                throw ValidationException::withMessages([
                    'active' => 'Izin content.publish diperlukan untuk mengaktifkan sponsor.',
                ]);
            }
            $before = $this->snapshot($sponsor);
            $sponsor->forceFill([
                'name' => $payload['name'],
                'tier' => $payload['tier'],
                'website' => $payload['website'],
                'logo_media_id' => $payload['logo_media_id'],
                'display_order' => $payload['display_order'],
                'active' => $active,
                'version' => (int) $sponsor->version + 1,
            ])->save();
            $this->recordAudit($actor, 'sponsor.update', $before, $sponsor, [
                'name',
                'tier',
                'website',
                'logo_media_id',
                'display_order',
                'active',
                'version',
            ]);
        });

        return to_route('admin.sponsors.edit', ['id' => $id])->with('status', 'Perubahan sponsor disimpan.');
    }

    public function toggle(
        Request $request,
        string $id,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::SponsorsManage);
        $edition = $this->resolveEdition($request, $editionContext);
        abort_if($edition === null, 422, 'Konteks edisi aktif tidak ditemukan.');
        $version = $request->validate(['version' => ['required', 'integer', 'min:1']])['version'];
        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($actor, $authorization, $edition, $id, $request, $version): void {
            $sponsor = $this->lockedSponsor($id, $edition);
            $this->assertVersion($sponsor, (int) $version);
            $active = ! $sponsor->active;
            if ($active && ! $this->hasPermission($request, $authorization, PermissionKey::ContentPublish)) {
                abort(403);
            }
            $before = $this->snapshot($sponsor);
            $sponsor->forceFill([
                'active' => $active,
                'version' => (int) $sponsor->version + 1,
            ])->save();
            $this->recordAudit($actor, $active ? 'sponsor.activate' : 'sponsor.deactivate', $before, $sponsor, ['active', 'version']);
        });

        return to_route('admin.sponsors.index')->with('status', 'Status sponsor diperbarui.');
    }

    public function destroy(
        Request $request,
        string $id,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::SponsorsManage);
        $edition = $this->resolveEdition($request, $editionContext);
        abort_if($edition === null, 422, 'Konteks edisi aktif tidak ditemukan.');
        $version = $request->validate(['version' => ['required', 'integer', 'min:1']])['version'];
        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($actor, $edition, $id, $version): void {
            $sponsor = $this->lockedSponsor($id, $edition);
            $this->assertVersion($sponsor, (int) $version);
            $before = $this->snapshot($sponsor);
            $sponsor->delete();
            $this->recordAudit($actor, 'sponsor.delete', $before, null, ['deleted']);
        });

        return to_route('admin.sponsors.index')->with('status', 'Sponsor dihapus.');
    }

    private function formProps(
        Request $request,
        AuthorizationService $authorization,
        Edition $edition,
        ?Sponsor $sponsor,
    ): array {
        $media = MediaAsset::query()
            ->where('lifecycle', 'ready')
            ->where('mime_type', 'like', 'image/%')
            ->orderByDesc('created_at')
            ->limit(100)
            ->get();

        if ($sponsor?->logo_media_id !== null && ! $media->contains('id', $sponsor->logo_media_id)) {
            $selected = MediaAsset::query()->find($sponsor->logo_media_id);
            if ($selected !== null) {
                $media->prepend($selected);
            }
        }

        return [
            'user' => $this->presentUser($request),
            'editionName' => $edition->name,
            'sponsor' => $sponsor === null ? null : $this->presentSponsor($sponsor),
            'logoMediaOptions' => $media->map(fn (MediaAsset $asset): array => [
                'id' => $asset->id,
                'url' => $asset->url,
                'filename' => $asset->filename,
                'alt' => $asset->alt,
                'lifecycle' => $asset->lifecycle,
            ])->values()->all(),
            'canEdit' => $this->hasPermission($request, $authorization, PermissionKey::SponsorsManage),
            'canPublish' => $this->hasPermission($request, $authorization, PermissionKey::ContentPublish),
        ];
    }

    private function validatedPayload(Request $request, Edition $edition, ?string $id = null): array
    {
        $nameRule = Rule::unique('sponsors', 'name')->where(fn ($query) => $query->where('edition_id', $edition->id));
        if ($id !== null) {
            $nameRule = $nameRule->ignore($id);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:255', $nameRule],
            'tier' => ['required', Rule::in(['utama', 'pendukung', 'pendamping', 'pelengkap'])],
            'website' => ['nullable', 'string', 'max:2000'],
            'logo_media_id' => ['nullable', 'uuid'],
            'display_order' => ['required', 'integer', 'min:0', 'max:2147483647'],
            'active' => ['nullable', 'boolean'],
            'version' => $id === null ? ['nullable', 'integer', 'min:1'] : ['required', 'integer', 'min:1'],
        ]);

        $website = trim((string) ($validated['website'] ?? ''));
        if ($website !== '' && ! preg_match('/^https:\/\//i', $website)) {
            throw ValidationException::withMessages(['website' => 'Website sponsor harus menggunakan URL https.']);
        }
        if ($website === '') {
            $website = null;
        }

        $logoMediaId = $validated['logo_media_id'] ?? null;
        if ($logoMediaId !== null && $this->readyImage((string) $logoMediaId) === null) {
            throw ValidationException::withMessages(['logo_media_id' => 'Logo harus berupa gambar siap pakai.']);
        }

        return [
            'name' => trim($validated['name']),
            'tier' => $validated['tier'],
            'website' => $website,
            'logo_media_id' => $logoMediaId,
            'display_order' => (int) $validated['display_order'],
            'active' => $validated['active'] ?? null,
            'version' => $validated['version'] ?? null,
        ];
    }

    private function resolveEdition(Request $request, ActiveEditionContext $editionContext): ?Edition
    {
        $resolved = $editionContext->resolve($request->cookie(ActiveEditionContext::COOKIE_NAME));

        return $resolved === null ? null : Edition::query()->find($resolved['id']);
    }

    private function findSponsor(string $id, Edition $edition): Sponsor
    {
        return Sponsor::query()->with('logoMedia')->where('edition_id', $edition->id)->whereKey($id)->firstOrFail();
    }

    private function lockedSponsor(string $id, Edition $edition): Sponsor
    {
        return Sponsor::query()->where('edition_id', $edition->id)->whereKey($id)->lockForUpdate()->firstOrFail();
    }

    private function readyImage(string $id): ?MediaAsset
    {
        return MediaAsset::query()->whereKey($id)->where('lifecycle', 'ready')->where('mime_type', 'like', 'image/%')->first();
    }

    private function assertVersion(Sponsor $sponsor, int $version): void
    {
        if ((int) $sponsor->version !== $version) {
            throw ValidationException::withMessages(['version' => 'Versi sponsor telah berubah. Muat ulang halaman.']);
        }
    }

    private function snapshot(Sponsor $sponsor): array
    {
        return [
            'id' => $sponsor->id,
            'edition_id' => $sponsor->edition_id,
            'name' => $sponsor->name,
            'tier' => $sponsor->tier,
            'website' => $sponsor->website,
            'logo_media_id' => $sponsor->logo_media_id,
            'display_order' => (int) $sponsor->display_order,
            'active' => (bool) $sponsor->active,
            'version' => (int) $sponsor->version,
        ];
    }

    private function presentSponsor(Sponsor $sponsor): array
    {
        return [
            'id' => $sponsor->id,
            'editionId' => $sponsor->edition_id,
            'name' => $sponsor->name,
            'tier' => $sponsor->tier,
            'website' => $sponsor->website,
            'logoMediaId' => $sponsor->logo_media_id,
            'displayOrder' => (int) $sponsor->display_order,
            'active' => (bool) $sponsor->active,
            'version' => (int) $sponsor->version,
            'createdAt' => $sponsor->created_at?->toIso8601String(),
            'logo' => $sponsor->logoMedia === null ? null : [
                'id' => $sponsor->logoMedia->id,
                'url' => $sponsor->logoMedia->url,
                'filename' => $sponsor->logoMedia->filename,
                'alt' => $sponsor->logoMedia->alt,
            ],
        ];
    }

    private function recordAudit(
        User $actor,
        string $action,
        ?array $before,
        ?Sponsor $sponsor,
        array $changedFields,
    ): void {
        AuditLog::create([
            'actor_user_id' => $actor->id,
            'actor_label' => $actor->email,
            'action' => $action,
            'resource_type' => 'sponsor',
            'resource_id' => $sponsor?->id ?? ($before['id'] ?? null),
            'resource_label' => $sponsor?->name ?? ($before['name'] ?? 'Sponsor'),
            'before_json' => $before,
            'after_json' => $sponsor === null ? null : $this->snapshot($sponsor),
            'changed_fields_json' => $changedFields,
            'source' => 'laravel-admin-sponsors',
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

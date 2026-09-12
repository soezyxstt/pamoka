<?php

namespace App\Http\Controllers;

use App\Enums\PermissionKey;
use App\Models\AuditLog;
use App\Models\Edition;
use App\Models\EditionProgram;
use App\Models\MediaAsset;
use App\Models\User;
use App\Services\ActiveEditionContext;
use App\Services\AuthorizationService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class AdminEditionSettingsController extends Controller
{
    public function index(
        Request $request,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): Response {
        $this->ensurePermission($request, $authorization, PermissionKey::ContentView);
        $edition = $this->resolveEdition($request, $editionContext);
        $programs = $edition === null
            ? []
            : EditionProgram::query()
                ->where('edition_id', $edition->id)
                ->orderBy('display_order')
                ->orderBy('id')
                ->get()
                ->map(fn (EditionProgram $program): array => $this->presentProgram($program))
                ->values()
                ->all();

        return Inertia::render('Admin/EditionSettings/Index', [
            'user' => $this->presentUser($request),
            'editionName' => $edition?->name ?? 'Edisi aktif',
            'edition' => $edition === null ? null : $this->presentEdition($edition),
            'programs' => $programs,
            'mediaOptions' => $this->mediaOptions($edition?->logo_media_id),
            'canEdit' => $this->hasPermission($request, $authorization, PermissionKey::ContentEdit),
        ]);
    }

    public function update(
        Request $request,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::ContentEdit);
        $edition = $this->requireEdition($request, $editionContext);
        $validated = $request->validate([
            'logo_media_id' => ['nullable', 'uuid'],
            'slogan' => ['nullable', 'string', 'max:160'],
            'version' => ['required', 'integer', 'min:1'],
        ]);
        $logoMediaId = filled($validated['logo_media_id'] ?? null) ? (string) $validated['logo_media_id'] : null;
        if ($logoMediaId !== null && $this->readyImage($logoMediaId) === null) {
            throw ValidationException::withMessages(['logo_media_id' => 'Logo harus berupa gambar siap pakai.']);
        }
        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($actor, $edition, $validated, $logoMediaId): void {
            $current = Edition::query()->whereKey($edition->id)->lockForUpdate()->firstOrFail();
            $this->assertVersion((int) $current->version, (int) $validated['version'], 'Versi identitas edisi telah berubah. Muat ulang halaman.');
            $before = $this->editionSnapshot($current);
            $current->forceFill([
                'logo_media_id' => $logoMediaId,
                'slogan' => filled($validated['slogan'] ?? null) ? trim((string) $validated['slogan']) : null,
                'version' => (int) $current->version + 1,
            ])->save();
            $this->recordAudit(
                $actor,
                'edition.settings.update',
                'edition',
                $current->id,
                $current->name,
                $before,
                $this->editionSnapshot($current),
                ['logo_media_id', 'slogan', 'version'],
            );
        });

        return to_route('admin.edition-settings.index')->with('status', 'Identitas edisi disimpan.');
    }

    public function storeProgram(
        Request $request,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::ContentEdit);
        $edition = $this->requireEdition($request, $editionContext);
        $payload = $this->programPayload($request);
        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($actor, $edition, $payload): void {
            $program = EditionProgram::create([
                'id' => (string) Str::uuid(),
                'edition_id' => $edition->id,
                ...$payload,
            ]);
            $this->recordAudit(
                $actor,
                'edition.program.create',
                'edition_program',
                $program->id,
                $program->title,
                null,
                $this->programSnapshot($program),
                ['edition_id', 'title', 'description', 'display_order', 'active'],
            );
        });

        return to_route('admin.edition-settings.index')->with('status', 'Program unggulan disimpan.');
    }

    public function updateProgram(
        Request $request,
        string $id,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::ContentEdit);
        $edition = $this->requireEdition($request, $editionContext);
        $payload = $this->programPayload($request);
        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($actor, $edition, $id, $payload): void {
            $program = EditionProgram::query()
                ->where('edition_id', $edition->id)
                ->whereKey($id)
                ->lockForUpdate()
                ->firstOrFail();
            $before = $this->programSnapshot($program);
            $program->forceFill($payload)->save();
            $this->recordAudit(
                $actor,
                'edition.program.update',
                'edition_program',
                $program->id,
                $program->title,
                $before,
                $this->programSnapshot($program),
                ['title', 'description', 'display_order', 'active'],
            );
        });

        return to_route('admin.edition-settings.index')->with('status', 'Program unggulan diperbarui.');
    }

    public function reorderPrograms(
        Request $request,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::ContentEdit);
        $edition = $this->requireEdition($request, $editionContext);
        $validated = $request->validate([
            'program_ids' => ['required', 'array', 'min:1'],
            'program_ids.*' => ['required', 'uuid'],
        ]);
        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($actor, $edition, $validated): void {
            $ids = array_values(array_map('strval', $validated['program_ids']));
            if (count($ids) !== count(array_unique($ids))) {
                throw ValidationException::withMessages(['program_ids' => 'Program yang sama tidak boleh diurutkan lebih dari sekali.']);
            }
            $programs = EditionProgram::query()
                ->where('edition_id', $edition->id)
                ->whereIn('id', $ids)
                ->lockForUpdate()
                ->get();
            if ($programs->count() !== count($ids)) {
                throw ValidationException::withMessages(['program_ids' => 'Satu atau beberapa program tidak ditemukan pada edisi terpilih.']);
            }
            foreach ($ids as $index => $id) {
                EditionProgram::query()->whereKey($id)->update([
                    'display_order' => $index,
                    'updated_at' => now(),
                ]);
            }
            $this->recordAudit(
                $actor,
                'edition.program.reorder',
                'edition_program',
                $edition->id,
                'Urutan program edisi '.$edition->name,
                ['program_ids' => $programs->sortBy('display_order')->pluck('id')->values()->all()],
                ['program_ids' => $ids],
                ['display_order'],
            );
        });

        return to_route('admin.edition-settings.index')->with('status', 'Urutan program diperbarui.');
    }

    public function destroyProgram(
        Request $request,
        string $id,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::ContentEdit);
        $edition = $this->requireEdition($request, $editionContext);
        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($actor, $edition, $id): void {
            $program = EditionProgram::query()
                ->where('edition_id', $edition->id)
                ->whereKey($id)
                ->lockForUpdate()
                ->firstOrFail();
            $before = $this->programSnapshot($program);
            $program->delete();
            $this->recordAudit(
                $actor,
                'edition.program.delete',
                'edition_program',
                $id,
                $edition->name.' · '.$before['title'],
                $before,
                null,
                ['deleted'],
            );
        });

        return to_route('admin.edition-settings.index')->with('status', 'Program unggulan dihapus.');
    }

    /**
     * @return array{title: string, description: string|null, display_order: int, active: bool}
     */
    private function programPayload(Request $request): array
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'min:2', 'max:160'],
            'description' => ['nullable', 'string', 'max:500'],
            'display_order' => ['required', 'integer', 'min:0', 'max:2147483647'],
            'active' => ['nullable', 'boolean'],
        ]);

        return [
            'title' => trim($validated['title']),
            'description' => filled($validated['description'] ?? null) ? trim((string) $validated['description']) : null,
            'display_order' => (int) $validated['display_order'],
            'active' => array_key_exists('active', $validated) ? (bool) $validated['active'] : true,
        ];
    }

    private function resolveEdition(Request $request, ActiveEditionContext $editionContext): ?Edition
    {
        $resolved = $editionContext->resolve($request->cookie(ActiveEditionContext::COOKIE_NAME));

        return $resolved === null ? null : Edition::query()->with('logoMedia')->find($resolved['id']);
    }

    private function requireEdition(Request $request, ActiveEditionContext $editionContext): Edition
    {
        $edition = $this->resolveEdition($request, $editionContext);
        abort_if($edition === null, 422, 'Konteks edisi aktif tidak ditemukan.');

        return $edition;
    }

    /**
     * @return list<array{id: string, url: string, filename: string, alt: string|null}>
     */
    private function mediaOptions(?string $selectedId = null): array
    {
        $media = MediaAsset::query()
            ->where('lifecycle', 'ready')
            ->where('mime_type', 'like', 'image/%')
            ->orderByDesc('created_at')
            ->limit(100)
            ->get();
        if ($selectedId !== null && ! $media->contains('id', $selectedId)) {
            $selected = MediaAsset::query()->find($selectedId);
            if ($selected !== null) {
                $media->prepend($selected);
            }
        }

        return $media->map(fn (MediaAsset $asset): array => [
            'id' => $asset->id,
            'url' => $asset->url,
            'filename' => $asset->filename,
            'alt' => $asset->alt,
        ])->values()->all();
    }

    private function readyImage(string $id): ?MediaAsset
    {
        return MediaAsset::query()->whereKey($id)->where('lifecycle', 'ready')->where('mime_type', 'like', 'image/%')->first();
    }

    private function presentEdition(Edition $edition): array
    {
        return [
            'id' => $edition->id,
            'year' => (int) $edition->year,
            'name' => $edition->name,
            'lifecycle' => $edition->lifecycle,
            'slogan' => $edition->slogan,
            'logoMediaId' => $edition->logo_media_id,
            'version' => (int) $edition->version,
            'logo' => $edition->logoMedia === null ? null : [
                'id' => $edition->logoMedia->id,
                'url' => $edition->logoMedia->url,
                'filename' => $edition->logoMedia->filename,
                'alt' => $edition->logoMedia->alt,
            ],
        ];
    }

    private function presentProgram(EditionProgram $program): array
    {
        return [
            'id' => $program->id,
            'title' => $program->title,
            'description' => $program->description,
            'displayOrder' => (int) $program->display_order,
            'active' => (bool) $program->active,
        ];
    }

    private function editionSnapshot(Edition $edition): array
    {
        return [
            'id' => $edition->id,
            'logo_media_id' => $edition->logo_media_id,
            'slogan' => $edition->slogan,
            'version' => (int) $edition->version,
        ];
    }

    private function programSnapshot(EditionProgram $program): array
    {
        return [
            'id' => $program->id,
            'edition_id' => $program->edition_id,
            'title' => $program->title,
            'description' => $program->description,
            'display_order' => (int) $program->display_order,
            'active' => (bool) $program->active,
        ];
    }

    private function recordAudit(
        User $actor,
        string $action,
        string $resourceType,
        ?string $resourceId,
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
            'source' => 'laravel-admin-edition-settings',
            'created_at' => now(),
        ]);
    }

    private function assertVersion(int $current, int $provided, string $message): void
    {
        if ($current !== $provided) {
            throw ValidationException::withMessages(['version' => $message]);
        }
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

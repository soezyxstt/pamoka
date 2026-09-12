<?php

namespace App\Http\Controllers;

use App\Enums\PermissionKey;
use App\Models\AuditLog;
use App\Models\CommitteeAssignment;
use App\Models\CommitteeUnit;
use App\Models\Edition;
use App\Models\MediaAsset;
use App\Models\Person;
use App\Models\User;
use App\Services\ActiveEditionContext;
use App\Services\AuthorizationService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class AdminCommitteeController extends Controller
{
    public function index(
        Request $request,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): Response {
        $this->ensurePermission($request, $authorization, PermissionKey::ContentView);
        $edition = $this->resolveEdition($request, $editionContext);

        $units = $edition === null
            ? []
            : CommitteeUnit::query()
                ->withCount('assignments')
                ->where('edition_id', $edition->id)
                ->orderBy('display_order')
                ->orderBy('name')
                ->get()
                ->map(fn (CommitteeUnit $unit): array => $this->presentUnit($unit))
                ->values()
                ->all();

        $members = $edition === null
            ? []
            : CommitteeAssignment::query()
                ->with(['unit', 'person.portraitMedia'])
                ->where('edition_id', $edition->id)
                ->orderBy('display_order')
                ->orderBy('id')
                ->get()
                ->map(fn (CommitteeAssignment $assignment): array => $this->presentAssignment($assignment))
                ->values()
                ->all();

        $people = Person::query()
            ->with('portraitMedia')
            ->orderBy('name')
            ->get()
            ->map(fn (Person $person): array => $this->presentPersonOption($person))
            ->values()
            ->all();

        return Inertia::render('Admin/Committee/Index', [
            'user' => $this->presentUser($request),
            'editionName' => $edition?->name ?? 'Edisi aktif',
            'editionId' => $edition?->id,
            'units' => $units,
            'members' => $members,
            'people' => $people,
            'mediaOptions' => $this->mediaOptions(),
            'canEdit' => $this->hasPermission($request, $authorization, PermissionKey::ContentEdit),
        ]);
    }

    public function storeUnit(
        Request $request,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::ContentEdit);
        $edition = $this->requireEdition($request, $editionContext);
        $payload = $this->unitPayload($request);
        /** @var User $actor */
        $actor = $request->user();

        $unit = DB::transaction(function () use ($actor, $edition, $payload): CommitteeUnit {
            $units = CommitteeUnit::query()
                ->where('edition_id', $edition->id)
                ->lockForUpdate()
                ->get();
            $id = (string) Str::uuid();
            $this->assertTree($units, null, $payload['parent_id'], $id);

            $unit = CommitteeUnit::create([
                'id' => $id,
                'edition_id' => $edition->id,
                'parent_id' => $payload['parent_id'],
                'name' => $payload['name'],
                'display_order' => $payload['display_order'],
                'active' => $payload['active'],
            ]);
            $this->recordAudit(
                $actor,
                'committee.unit.create',
                'committee_unit',
                $unit->id,
                $edition->name.' · '.$unit->name,
                null,
                $this->unitSnapshot($unit),
                ['edition_id', 'parent_id', 'name', 'display_order', 'active'],
            );

            return $unit;
        });

        return to_route('admin.committee.index')->with('status', 'Unit panitia disimpan.');
    }

    public function updateUnit(
        Request $request,
        string $id,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::ContentEdit);
        $edition = $this->requireEdition($request, $editionContext);
        $payload = $this->unitPayload($request);
        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($actor, $edition, $id, $payload): void {
            $unit = CommitteeUnit::query()
                ->where('edition_id', $edition->id)
                ->whereKey($id)
                ->lockForUpdate()
                ->firstOrFail();
            $units = CommitteeUnit::query()
                ->where('edition_id', $edition->id)
                ->lockForUpdate()
                ->get();
            $this->assertTree($units, $unit->id, $payload['parent_id']);
            $before = $this->unitSnapshot($unit);

            $unit->forceFill([
                'parent_id' => $payload['parent_id'],
                'name' => $payload['name'],
                'display_order' => $payload['display_order'],
                'active' => $payload['active'],
            ])->save();

            $this->recordAudit(
                $actor,
                'committee.unit.update',
                'committee_unit',
                $unit->id,
                $edition->name.' · '.$unit->name,
                $before,
                $this->unitSnapshot($unit),
                ['parent_id', 'name', 'display_order', 'active'],
            );
        });

        return to_route('admin.committee.index')->with('status', 'Unit panitia diperbarui.');
    }

    public function reorderUnits(
        Request $request,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::ContentEdit);
        $edition = $this->requireEdition($request, $editionContext);
        $validated = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.id' => ['required', 'uuid'],
            'items.*.display_order' => ['required', 'integer', 'min:0', 'max:2147483647'],
        ]);
        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($actor, $edition, $validated): void {
            $items = collect($validated['items']);
            $ids = $items->pluck('id')->map(fn (mixed $id): string => (string) $id)->all();
            if (count($ids) !== count(array_unique($ids))) {
                throw ValidationException::withMessages(['items' => 'Unit yang sama tidak boleh diurutkan lebih dari sekali.']);
            }

            $units = CommitteeUnit::query()
                ->where('edition_id', $edition->id)
                ->whereIn('id', $ids)
                ->lockForUpdate()
                ->get();
            if ($units->count() !== count($ids)) {
                throw ValidationException::withMessages(['items' => 'Satu atau beberapa unit tidak ditemukan pada edisi terpilih.']);
            }
            if ($units->pluck('parent_id')->map(fn (mixed $parent): string => $parent ?? 'root')->unique()->count() !== 1) {
                throw ValidationException::withMessages(['items' => 'Unit yang diurutkan harus berada pada induk yang sama.']);
            }

            $allUnits = CommitteeUnit::query()->where('edition_id', $edition->id)->lockForUpdate()->get();
            $this->assertTree($allUnits);
            $before = $units->sortBy('display_order')->pluck('id')->values()->all();
            foreach ($items as $item) {
                CommitteeUnit::query()
                    ->where('edition_id', $edition->id)
                    ->whereKey($item['id'])
                    ->update([
                        'display_order' => (int) $item['display_order'],
                        'updated_at' => now(),
                    ]);
            }

            $this->recordAudit(
                $actor,
                'committee.unit.reorder',
                'committee_unit',
                $edition->id,
                'Urutan unit panitia '.$edition->name,
                ['order' => $before],
                ['order' => $ids],
                ['display_order'],
            );
        });

        return to_route('admin.committee.index')->with('status', 'Urutan unit panitia diperbarui.');
    }

    public function destroyUnit(
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
            $unit = CommitteeUnit::query()
                ->where('edition_id', $edition->id)
                ->whereKey($id)
                ->lockForUpdate()
                ->firstOrFail();
            $before = $this->unitSnapshot($unit);
            $unit->delete();
            $this->recordAudit(
                $actor,
                'committee.unit.delete',
                'committee_unit',
                $id,
                $edition->name.' · '.$unit->name,
                $before,
                null,
                ['deleted'],
            );
        });

        return to_route('admin.committee.index')->with('status', 'Unit panitia dihapus.');
    }

    public function storeAssignment(
        Request $request,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::ContentEdit);
        $edition = $this->requireEdition($request, $editionContext);
        $payload = $this->assignmentPayload($request);
        /** @var User $actor */
        $actor = $request->user();

        $assignment = DB::transaction(function () use ($actor, $edition, $payload): CommitteeAssignment {
            $unit = CommitteeUnit::query()
                ->where('edition_id', $edition->id)
                ->whereKey($payload['committee_unit_id'])
                ->firstOrFail();
            $person = Person::query()->whereKey($payload['person_id'])->firstOrFail();
            $this->assertAssignmentIsUnique($edition, $payload['committee_unit_id'], $payload['person_id'], $payload['title']);

            $assignment = CommitteeAssignment::create([
                'edition_id' => $edition->id,
                'committee_unit_id' => $unit->id,
                'person_id' => $person->id,
                'title' => $payload['title'],
                'display_order' => $payload['display_order'],
                'active' => $payload['active'],
                'version' => 1,
            ]);
            $this->recordAudit(
                $actor,
                'committee.assignment.create',
                'committee_assignment',
                $assignment->id,
                $edition->name.' · '.$person->name.' · '.$assignment->title,
                null,
                $this->assignmentSnapshot($assignment),
                ['edition_id', 'committee_unit_id', 'person_id', 'title', 'display_order', 'active'],
            );

            return $assignment;
        });

        return to_route('admin.committee.index')->with('status', 'Penugasan panitia disimpan.');
    }

    public function updateAssignment(
        Request $request,
        string $id,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::ContentEdit);
        $edition = $this->requireEdition($request, $editionContext);
        $payload = $this->assignmentPayload($request, true);
        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($actor, $edition, $id, $payload): void {
            $assignment = CommitteeAssignment::query()
                ->where('edition_id', $edition->id)
                ->whereKey($id)
                ->lockForUpdate()
                ->firstOrFail();
            $this->assertVersion($assignment->version, (int) $payload['version']);
            $unit = CommitteeUnit::query()
                ->where('edition_id', $edition->id)
                ->whereKey($payload['committee_unit_id'])
                ->firstOrFail();
            $person = Person::query()->whereKey($payload['person_id'])->firstOrFail();
            $this->assertAssignmentIsUnique($edition, $unit->id, $person->id, $payload['title'], $assignment->id);
            $before = $this->assignmentSnapshot($assignment);

            $assignment->forceFill([
                'committee_unit_id' => $unit->id,
                'person_id' => $person->id,
                'title' => $payload['title'],
                'display_order' => $payload['display_order'],
                'active' => $payload['active'],
                'version' => (int) $assignment->version + 1,
            ])->save();
            $this->recordAudit(
                $actor,
                'committee.assignment.update',
                'committee_assignment',
                $assignment->id,
                $edition->name.' · '.$person->name.' · '.$assignment->title,
                $before,
                $this->assignmentSnapshot($assignment),
                ['committee_unit_id', 'person_id', 'title', 'display_order', 'active', 'version'],
            );
        });

        return to_route('admin.committee.index')->with('status', 'Penugasan panitia diperbarui.');
    }

    public function destroyAssignment(
        Request $request,
        string $id,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::ContentEdit);
        $edition = $this->requireEdition($request, $editionContext);
        $version = $request->validate(['version' => ['required', 'integer', 'min:1']])['version'];
        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($actor, $edition, $id, $version): void {
            $assignment = CommitteeAssignment::query()
                ->where('edition_id', $edition->id)
                ->whereKey($id)
                ->lockForUpdate()
                ->firstOrFail();
            $this->assertVersion($assignment->version, (int) $version);
            $before = $this->assignmentSnapshot($assignment);
            $assignment->delete();
            $this->recordAudit(
                $actor,
                'committee.assignment.delete',
                'committee_assignment',
                $id,
                $edition->name.' · '.$before['title'],
                $before,
                null,
                ['deleted'],
            );
        });

        return to_route('admin.committee.index')->with('status', 'Penugasan panitia dihapus.');
    }

    public function storeQuickPerson(
        Request $request,
        AuthorizationService $authorization,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::ContentEdit);
        $validated = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:255'],
            'short_bio' => ['nullable', 'string', 'max:10000'],
            'portrait_media_id' => ['nullable', 'uuid'],
        ]);
        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($actor, $validated): void {
            $id = (string) Str::uuid();
            $portraitMediaId = filled($validated['portrait_media_id'] ?? null) ? (string) $validated['portrait_media_id'] : null;
            if ($portraitMediaId !== null && $this->readyImage($portraitMediaId) === null) {
                throw ValidationException::withMessages([
                    'portrait_media_id' => 'Foto profil harus berupa gambar siap pakai.',
                ]);
            }

            $name = trim($validated['name']);
            $slug = $this->uniquePersonSlug(Str::slug($name), $id);
            $person = Person::create([
                'id' => $id,
                'name' => $name,
                'slug' => $slug,
                'short_bio' => filled($validated['short_bio'] ?? null) ? trim((string) $validated['short_bio']) : null,
                'portrait_media_id' => $portraitMediaId,
                'version' => 1,
            ]);
            $this->recordAudit(
                $actor,
                'person.create',
                'person',
                $person->id,
                $person->name,
                null,
                [
                    'id' => $person->id,
                    'name' => $person->name,
                    'slug' => $person->slug,
                    'short_bio' => $person->short_bio,
                    'portrait_media_id' => $person->portrait_media_id,
                    'version' => (int) $person->version,
                ],
                ['name', 'slug', 'short_bio', 'portrait_media_id'],
            );
        });

        return to_route('admin.committee.index')->with('status', 'Profil orang disimpan.');
    }

    /**
     * @return array{name: string, parent_id: string|null, display_order: int, active: bool}
     */
    private function unitPayload(Request $request): array
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:255'],
            'parent_id' => ['nullable', 'uuid'],
            'display_order' => ['required', 'integer', 'min:0', 'max:2147483647'],
            'active' => ['nullable', 'boolean'],
        ]);

        return [
            'name' => trim($validated['name']),
            'parent_id' => filled($validated['parent_id'] ?? null) ? (string) $validated['parent_id'] : null,
            'display_order' => (int) $validated['display_order'],
            'active' => array_key_exists('active', $validated) ? (bool) $validated['active'] : true,
        ];
    }

    /**
     * @return array{committee_unit_id: string, person_id: string, title: string, display_order: int, active: bool, version: int|null}
     */
    private function assignmentPayload(Request $request, bool $existing = false): array
    {
        $validated = $request->validate([
            'unit_id' => ['required', 'uuid'],
            'person_id' => ['required', 'uuid'],
            'title' => ['required', 'string', 'min:2', 'max:255'],
            'display_order' => ['required', 'integer', 'min:0', 'max:2147483647'],
            'active' => ['nullable', 'boolean'],
            'version' => $existing ? ['required', 'integer', 'min:1'] : ['nullable', 'integer', 'min:1'],
        ]);

        return [
            'committee_unit_id' => (string) $validated['unit_id'],
            'person_id' => (string) $validated['person_id'],
            'title' => trim($validated['title']),
            'display_order' => (int) $validated['display_order'],
            'active' => array_key_exists('active', $validated) ? (bool) $validated['active'] : true,
            'version' => isset($validated['version']) ? (int) $validated['version'] : null,
        ];
    }

    private function assertAssignmentIsUnique(
        Edition $edition,
        string $unitId,
        string $personId,
        string $title,
        ?string $ignoreId = null,
    ): void {
        $exists = CommitteeAssignment::query()
            ->where('edition_id', $edition->id)
            ->where('committee_unit_id', $unitId)
            ->where('person_id', $personId)
            ->where('title', $title)
            ->when($ignoreId !== null, fn ($query) => $query->where('id', '!=', $ignoreId))
            ->exists();
        if ($exists) {
            throw ValidationException::withMessages([
                'title' => 'Penugasan dengan profil dan jabatan yang sama sudah ada pada unit ini.',
            ]);
        }
    }

    private function assertVersion(int $current, int $provided): void
    {
        if ($current !== $provided) {
            throw ValidationException::withMessages([
                'version' => 'Versi penugasan telah berubah. Muat ulang halaman.',
            ]);
        }
    }

    private function assertTree(
        Collection $units,
        ?string $targetId = null,
        ?string $newParentId = null,
        ?string $newUnitId = null,
    ): void {
        $parents = [];
        foreach ($units as $unit) {
            $parents[(string) $unit->id] = $unit->parent_id === null ? null : (string) $unit->parent_id;
        }

        if ($targetId !== null) {
            if (! array_key_exists($targetId, $parents)) {
                throw ValidationException::withMessages(['parent_id' => 'Unit panitia tidak ditemukan pada edisi ini.']);
            }
            $parents[$targetId] = $newParentId;
        }
        if ($newUnitId !== null) {
            $parents[$newUnitId] = $newParentId;
        }

        $states = [];
        $depths = [];
        $visit = function (string $id) use (&$visit, &$states, &$depths, $parents): int {
            if (($states[$id] ?? null) === 'visiting') {
                throw ValidationException::withMessages(['parent_id' => 'Terdeteksi struktur melingkar pada hierarki unit.']);
            }
            if (($states[$id] ?? null) === 'visited') {
                return $depths[$id];
            }
            if (! array_key_exists($id, $parents)) {
                throw ValidationException::withMessages(['parent_id' => 'Unit induk tidak ditemukan pada edisi ini.']);
            }

            $states[$id] = 'visiting';
            $parentId = $parents[$id];
            $depth = 1;
            if ($parentId !== null) {
                $depth = $visit($parentId) + 1;
            }
            if ($depth > 4) {
                throw ValidationException::withMessages([
                    'parent_id' => 'Struktur panitia maksimal 4 tingkat kedalaman.',
                ]);
            }
            $depths[$id] = $depth;
            $states[$id] = 'visited';

            return $depth;
        };

        foreach (array_keys($parents) as $id) {
            $visit((string) $id);
        }
    }

    private function requireEdition(Request $request, ActiveEditionContext $editionContext): Edition
    {
        $edition = $this->resolveEdition($request, $editionContext);
        abort_if($edition === null, 422, 'Konteks edisi aktif tidak ditemukan.');

        return $edition;
    }

    private function resolveEdition(Request $request, ActiveEditionContext $editionContext): ?Edition
    {
        $resolved = $editionContext->resolve($request->cookie(ActiveEditionContext::COOKIE_NAME));

        return $resolved === null ? null : Edition::query()->find($resolved['id']);
    }

    /**
     * @return list<array{id: string, url: string, filename: string, alt: string|null}>
     */
    private function mediaOptions(): array
    {
        return MediaAsset::query()
            ->where('lifecycle', 'ready')
            ->where('mime_type', 'like', 'image/%')
            ->orderByDesc('created_at')
            ->limit(100)
            ->get()
            ->map(fn (MediaAsset $asset): array => [
                'id' => $asset->id,
                'url' => $asset->url,
                'filename' => $asset->filename,
                'alt' => $asset->alt,
            ])
            ->values()
            ->all();
    }

    private function readyImage(string $id): ?MediaAsset
    {
        return MediaAsset::query()
            ->whereKey($id)
            ->where('lifecycle', 'ready')
            ->where('mime_type', 'like', 'image/%')
            ->first();
    }

    private function uniquePersonSlug(string $base, string $personId): string
    {
        $base = $base !== '' ? $base : 'profil';
        $candidate = $base;
        $suffix = 2;
        while (Person::query()->where('slug', $candidate)->exists()) {
            $candidate = $base.'-'.substr(str_replace('-', '', $personId), 0, 6);
            if (Person::query()->where('slug', $candidate)->exists()) {
                $candidate = $base.'-'.$suffix;
                $suffix++;
            }
        }

        return $candidate;
    }

    private function presentUnit(CommitteeUnit $unit): array
    {
        return [
            'id' => $unit->id,
            'editionId' => $unit->edition_id,
            'parentId' => $unit->parent_id,
            'name' => $unit->name,
            'displayOrder' => (int) $unit->display_order,
            'active' => (bool) $unit->active,
            'memberCount' => (int) ($unit->assignments_count ?? 0),
        ];
    }

    private function presentAssignment(CommitteeAssignment $assignment): array
    {
        $person = $assignment->person;

        return [
            'id' => $assignment->id,
            'editionId' => $assignment->edition_id,
            'unitId' => $assignment->committee_unit_id,
            'personId' => $assignment->person_id,
            'title' => $assignment->title,
            'displayOrder' => (int) $assignment->display_order,
            'active' => (bool) $assignment->active,
            'version' => (int) $assignment->version,
            'unitName' => $assignment->unit?->name,
            'personName' => $person?->name,
            'personSlug' => $person?->slug,
            'portraitUrl' => $person?->portraitMedia?->url,
            'shortBio' => $person?->short_bio,
        ];
    }

    private function presentPersonOption(Person $person): array
    {
        return [
            'id' => $person->id,
            'name' => $person->name,
            'slug' => $person->slug,
            'shortBio' => $person->short_bio,
            'portraitMediaId' => $person->portrait_media_id,
            'portraitUrl' => $person->portraitMedia?->url,
        ];
    }

    private function unitSnapshot(CommitteeUnit $unit): array
    {
        return [
            'id' => $unit->id,
            'edition_id' => $unit->edition_id,
            'parent_id' => $unit->parent_id,
            'name' => $unit->name,
            'display_order' => (int) $unit->display_order,
            'active' => (bool) $unit->active,
        ];
    }

    private function assignmentSnapshot(CommitteeAssignment $assignment): array
    {
        return [
            'id' => $assignment->id,
            'edition_id' => $assignment->edition_id,
            'committee_unit_id' => $assignment->committee_unit_id,
            'person_id' => $assignment->person_id,
            'title' => $assignment->title,
            'display_order' => (int) $assignment->display_order,
            'active' => (bool) $assignment->active,
            'version' => (int) $assignment->version,
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
            'source' => 'laravel-admin-committee',
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

<?php

namespace App\Http\Controllers;

use App\Enums\PermissionKey;
use App\Enums\SocialPlatform;
use App\Models\AuditLog;
use App\Models\Edition;
use App\Models\MediaAsset;
use App\Models\OrganizationAssignment;
use App\Models\OrganizationMembership;
use App\Models\OrganizationPeriod;
use App\Models\OrganizationUnit;
use App\Models\Person;
use App\Models\PersonSocialLink;
use App\Models\User;
use App\Services\AuthorizationService;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class AdminOrganizationController extends Controller
{
    public function index(Request $request, AuthorizationService $authorization): Response
    {
        $this->ensurePermission($request, $authorization, PermissionKey::ContentView);

        $periods = OrganizationPeriod::query()
            ->withCount(['editions', 'units', 'memberships'])
            ->orderByDesc('start_year')
            ->orderBy('label')
            ->get();
        $people = Person::query()
            ->with(['portraitMedia', 'socialLinks'])
            ->withCount('organizationMemberships')
            ->orderBy('name')
            ->get();
        $legacy = OrganizationAssignment::query()
            ->with('person')
            ->orderBy('display_order')
            ->orderBy('id')
            ->get();
        $mappedPersonIds = OrganizationMembership::query()->pluck('person_id')->unique()->all();

        return Inertia::render('Admin/Organization/Index', [
            'user' => $this->presentUser($request),
            'periods' => $periods->map(fn (OrganizationPeriod $period): array => $this->presentPeriod($period, [
                'connectedEditionsCount' => (int) $period->editions_count,
                'unitCount' => (int) $period->units_count,
                'memberCount' => (int) $period->memberships_count,
            ]))->values()->all(),
            'people' => $people->map(fn (Person $person): array => $this->presentPerson($person, [
                'membershipCount' => (int) $person->organization_memberships_count,
            ]))->values()->all(),
            'legacyAssignments' => $legacy
                ->map(fn (OrganizationAssignment $assignment): array => $this->presentLegacy($assignment, in_array($assignment->person_id, $mappedPersonIds, true)))
                ->values()
                ->all(),
            'mediaOptions' => $this->mediaOptions(),
            'canEdit' => $this->hasPermission($request, $authorization, PermissionKey::PeopleManage),
        ]);
    }

    public function show(Request $request, string $id, AuthorizationService $authorization): Response
    {
        $this->ensurePermission($request, $authorization, PermissionKey::ContentView);

        $period = OrganizationPeriod::query()->findOrFail($id);
        $units = OrganizationUnit::query()
            ->where('organization_period_id', $period->id)
            ->orderBy('display_order')
            ->orderBy('name')
            ->get();
        $members = OrganizationMembership::query()
            ->where('organization_period_id', $period->id)
            ->with('person')
            ->orderBy('display_order')
            ->orderBy('id')
            ->get();
        $editions = Edition::query()
            ->with('organizationPeriod')
            ->orderBy('year')
            ->orderBy('id')
            ->get();
        $people = Person::query()
            ->with('portraitMedia')
            ->orderBy('name')
            ->get();
        $legacy = OrganizationAssignment::query()
            ->with('person')
            ->orderBy('display_order')
            ->orderBy('id')
            ->get();
        $mappedPersonIds = OrganizationMembership::query()->pluck('person_id')->unique()->all();

        return Inertia::render('Admin/Organization/Period', [
            'user' => $this->presentUser($request),
            'period' => $this->presentPeriod($period),
            'units' => $units->map(fn (OrganizationUnit $unit): array => $this->presentUnit($unit))->values()->all(),
            'members' => $members->map(fn (OrganizationMembership $member): array => $this->presentMembership($member))->values()->all(),
            'availableEditions' => $editions->map(fn (Edition $edition): array => [
                'id' => $edition->id,
                'year' => (int) $edition->year,
                'name' => $edition->name,
                'slug' => $edition->slug,
                'lifecycle' => $edition->lifecycle,
                'organizationPeriodId' => $edition->organization_period_id,
                'organizationPeriodLabel' => $edition->organizationPeriod?->label,
            ])->values()->all(),
            'peopleOptions' => $people->map(fn (Person $person): array => [
                'id' => $person->id,
                'name' => $person->name,
                'slug' => $person->slug,
                'portraitUrl' => $person->portraitMedia?->url,
            ])->values()->all(),
            'legacyAssignments' => $legacy
                ->map(fn (OrganizationAssignment $assignment): array => $this->presentLegacy($assignment, in_array($assignment->person_id, $mappedPersonIds, true)))
                ->values()
                ->all(),
            'canEdit' => $this->hasPermission($request, $authorization, PermissionKey::PeopleManage),
        ]);
    }

    public function storePeriod(Request $request, AuthorizationService $authorization): RedirectResponse
    {
        $this->ensurePermission($request, $authorization, PermissionKey::PeopleManage);
        $payload = $this->validatedPeriod($request);
        /** @var User $actor */
        $actor = $request->user();

        $period = DB::transaction(function () use ($actor, $payload): OrganizationPeriod {
            $period = new OrganizationPeriod;
            $period->forceFill([
                'id' => (string) Str::uuid(),
                'label' => $payload['label'],
                'start_year' => $payload['start_year'],
                'end_year' => $payload['end_year'],
                'vision' => $payload['vision'],
                'mission_json' => $payload['missions'],
                'lifecycle' => $payload['lifecycle'],
                'version' => 1,
            ])->save();
            $this->recordAudit($actor, 'organization.period.create', 'organization_period', $period->id, $period->label, null, $this->snapshotPeriod($period), ['label', 'start_year', 'end_year', 'vision', 'mission_json', 'lifecycle']);

            return $period;
        });

        return to_route('admin.organization.index')->with('status', "Periode {$period->label} dibuat.");
    }

    public function updatePeriod(Request $request, string $id, AuthorizationService $authorization): RedirectResponse
    {
        $this->ensurePermission($request, $authorization, PermissionKey::PeopleManage);
        $payload = $this->validatedPeriod($request, true);
        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($actor, $id, $payload): void {
            $period = OrganizationPeriod::query()->whereKey($id)->lockForUpdate()->firstOrFail();
            $this->assertVersion($period, (int) $payload['version'], 'version', 'Versi periode telah berubah. Muat ulang halaman.');
            $before = $this->snapshotPeriod($period);
            $period->forceFill([
                'label' => $payload['label'],
                'start_year' => $payload['start_year'],
                'end_year' => $payload['end_year'],
                'vision' => $payload['vision'],
                'mission_json' => $payload['missions'],
                'lifecycle' => $payload['lifecycle'],
                'version' => (int) $period->version + 1,
            ])->save();
            $this->recordAudit($actor, 'organization.period.update', 'organization_period', $period->id, $period->label, $before, $this->snapshotPeriod($period), ['label', 'start_year', 'end_year', 'vision', 'mission_json', 'lifecycle', 'version']);
        });

        return to_route('admin.organization.periods.show', $id)->with('status', 'Metadata periode disimpan.');
    }

    public function setPeriodEditions(Request $request, string $id, AuthorizationService $authorization): RedirectResponse
    {
        $this->ensurePermission($request, $authorization, PermissionKey::PeopleManage);
        $validated = $request->validate([
            'period_version' => ['required', 'integer', 'min:1'],
            'edition_ids' => ['nullable', 'array'],
            'edition_ids.*' => ['required', 'uuid', 'distinct', 'exists:editions,id'],
            'confirmed_reassignment_ids' => ['nullable', 'array'],
            'confirmed_reassignment_ids.*' => ['required', 'uuid', 'distinct'],
        ]);
        $editionIds = array_values($validated['edition_ids'] ?? []);
        $confirmedIds = array_values($validated['confirmed_reassignment_ids'] ?? []);
        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($actor, $id, $validated, $editionIds, $confirmedIds): void {
            $period = OrganizationPeriod::query()->whereKey($id)->lockForUpdate()->firstOrFail();
            $this->assertVersion($period, (int) $validated['period_version'], 'period_version', 'Versi periode telah berubah. Muat ulang halaman.');
            $allEditions = Edition::query()->lockForUpdate()->get();
            $selected = $allEditions->whereIn('id', $editionIds);
            $conflicts = $selected->filter(fn (Edition $edition): bool => $edition->organization_period_id !== null && $edition->organization_period_id !== $period->id);
            $missingConfirmation = $conflicts->filter(fn (Edition $edition): bool => ! in_array($edition->id, $confirmedIds, true));
            if ($missingConfirmation->isNotEmpty()) {
                throw ValidationException::withMessages([
                    'edition_ids' => 'Konfirmasi pemindahan setiap edisi yang masih terhubung ke periode lain.',
                ]);
            }

            $before = [
                'edition_ids' => $allEditions->where('organization_period_id', $period->id)->pluck('id')->values()->all(),
                'version' => (int) $period->version,
            ];
            foreach ($allEditions as $edition) {
                $shouldBeLinked = in_array($edition->id, $editionIds, true);
                if (($edition->organization_period_id === $period->id) === $shouldBeLinked) {
                    continue;
                }
                $edition->forceFill([
                    'organization_period_id' => $shouldBeLinked ? $period->id : null,
                    'version' => (int) $edition->version + 1,
                ])->save();
            }
            $period->forceFill(['version' => (int) $period->version + 1])->save();
            $this->recordAudit($actor, 'organization.period.editions.update', 'organization_period', $period->id, $period->label, $before, [
                'edition_ids' => $editionIds,
                'reassigned_edition_ids' => $conflicts->pluck('id')->values()->all(),
                'version' => (int) $period->version,
            ], ['edition_ids', 'version']);
        });

        return to_route('admin.organization.periods.show', $id)->with('status', 'Edisi terhubung diperbarui.');
    }

    public function destroyPeriod(Request $request, string $id, AuthorizationService $authorization): RedirectResponse
    {
        $this->ensurePermission($request, $authorization, PermissionKey::PeopleManage);
        $version = $request->validate(['version' => ['required', 'integer', 'min:1']])['version'];
        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($actor, $id, $version): void {
            $period = OrganizationPeriod::query()->whereKey($id)->lockForUpdate()->firstOrFail();
            $this->assertVersion($period, (int) $version, 'version', 'Versi periode telah berubah. Muat ulang halaman.');
            $before = $this->snapshotPeriod($period);
            Edition::query()->where('organization_period_id', $period->id)->update([
                'organization_period_id' => null,
                'version' => DB::raw('version + 1'),
                'updated_at' => now(),
            ]);
            $period->delete();
            $this->recordAudit($actor, 'organization.period.delete', 'organization_period', $id, $before['label'], $before, null, ['deleted']);
        });

        return to_route('admin.organization.index')->with('status', 'Periode dihapus.');
    }

    public function storeUnit(Request $request, AuthorizationService $authorization): RedirectResponse
    {
        $this->ensurePermission($request, $authorization, PermissionKey::PeopleManage);
        $payload = $request->validate([
            'organization_period_id' => ['required', 'uuid', 'exists:organization_periods,id'],
            'parent_id' => ['nullable', 'uuid'],
            'name' => ['required', 'string', 'min:2', 'max:255'],
            'display_order' => ['required', 'integer', 'min:0', 'max:2147483647'],
            'active' => ['required', 'boolean'],
        ]);
        /** @var User $actor */
        $actor = $request->user();
        $unitId = (string) Str::uuid();

        DB::transaction(function () use ($actor, $payload, $unitId): void {
            $period = OrganizationPeriod::query()->whereKey($payload['organization_period_id'])->lockForUpdate()->firstOrFail();
            $units = OrganizationUnit::query()->where('organization_period_id', $period->id)->lockForUpdate()->get();
            $this->assertTreeWithCandidate($units, $unitId, $payload['parent_id'] ?? null);
            $unit = new OrganizationUnit;
            $unit->id = $unitId;
            $unit->forceFill([
                'organization_period_id' => $period->id,
                'parent_id' => $payload['parent_id'] ?? null,
                'name' => trim($payload['name']),
                'display_order' => (int) $payload['display_order'],
                'active' => (bool) $payload['active'],
            ])->save();
            $this->recordAudit($actor, 'organization.unit.create', 'organization_unit', $unit->id, $unit->name, null, $this->snapshotUnit($unit), ['organization_period_id', 'parent_id', 'name', 'display_order', 'active']);
        });

        return to_route('admin.organization.periods.show', $payload['organization_period_id'])->with('status', 'Unit organisasi dibuat.');
    }

    public function updateUnit(Request $request, string $id, AuthorizationService $authorization): RedirectResponse
    {
        $this->ensurePermission($request, $authorization, PermissionKey::PeopleManage);
        $payload = $request->validate([
            'parent_id' => ['nullable', 'uuid'],
            'name' => ['required', 'string', 'min:2', 'max:255'],
            'display_order' => ['required', 'integer', 'min:0', 'max:2147483647'],
            'active' => ['required', 'boolean'],
        ]);
        /** @var User $actor */
        $actor = $request->user();
        $periodId = '';

        DB::transaction(function () use ($actor, $id, $payload, &$periodId): void {
            $unit = OrganizationUnit::query()->whereKey($id)->lockForUpdate()->firstOrFail();
            $periodId = $unit->organization_period_id;
            $units = OrganizationUnit::query()->where('organization_period_id', $periodId)->lockForUpdate()->get();
            $this->assertTreeWithCandidate($units, $unit->id, $payload['parent_id'] ?? null);
            $before = $this->snapshotUnit($unit);
            $unit->forceFill([
                'parent_id' => $payload['parent_id'] ?? null,
                'name' => trim($payload['name']),
                'display_order' => (int) $payload['display_order'],
                'active' => (bool) $payload['active'],
            ])->save();
            $this->recordAudit($actor, 'organization.unit.update', 'organization_unit', $unit->id, $unit->name, $before, $this->snapshotUnit($unit), ['parent_id', 'name', 'display_order', 'active']);
        });

        return to_route('admin.organization.periods.show', $periodId)->with('status', 'Unit organisasi diperbarui.');
    }

    public function reorderUnits(Request $request, AuthorizationService $authorization): RedirectResponse
    {
        $this->ensurePermission($request, $authorization, PermissionKey::PeopleManage);
        $items = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.id' => ['required', 'uuid', 'distinct'],
            'items.*.display_order' => ['required', 'integer', 'min:0', 'max:2147483647'],
        ])['items'];
        /** @var User $actor */
        $actor = $request->user();
        $periodId = '';

        DB::transaction(function () use ($actor, $items, &$periodId): void {
            $ids = collect($items)->pluck('id')->values();
            $units = OrganizationUnit::query()->whereIn('id', $ids)->lockForUpdate()->get();
            if ($units->count() !== $ids->count()) {
                throw ValidationException::withMessages(['items' => 'Satu atau beberapa unit tidak ditemukan.']);
            }
            if ($units->pluck('organization_period_id')->unique()->count() !== 1 || $units->pluck('parent_id')->unique()->count() !== 1) {
                throw ValidationException::withMessages(['items' => 'Unit yang diurutkan harus berada pada periode dan tingkat induk yang sama.']);
            }
            $periodId = (string) $units->first()->organization_period_id;
            $this->validateOrganizationTree(OrganizationUnit::query()->where('organization_period_id', $periodId)->get());
            $before = $units->sortBy('display_order')->pluck('id')->values()->all();
            foreach ($items as $item) {
                $unit = $units->firstWhere('id', $item['id']);
                $unit->forceFill(['display_order' => (int) $item['display_order']])->save();
            }
            $this->recordAudit($actor, 'organization.unit.reorder', 'organization_unit', $periodId, 'Urutan unit organisasi', ['order' => $before], ['order' => $ids->all()], ['display_order']);
        });

        return to_route('admin.organization.periods.show', $periodId)->with('status', 'Urutan unit diperbarui.');
    }

    public function destroyUnit(Request $request, string $id, AuthorizationService $authorization): RedirectResponse
    {
        $this->ensurePermission($request, $authorization, PermissionKey::PeopleManage);
        /** @var User $actor */
        $actor = $request->user();
        $periodId = '';

        DB::transaction(function () use ($actor, $id, &$periodId): void {
            $unit = OrganizationUnit::query()->whereKey($id)->lockForUpdate()->firstOrFail();
            $periodId = $unit->organization_period_id;
            $before = $this->snapshotUnit($unit);
            $unit->delete();
            $this->recordAudit($actor, 'organization.unit.delete', 'organization_unit', $id, $before['name'], $before, null, ['deleted']);
        });

        return to_route('admin.organization.periods.show', $periodId)->with('status', 'Unit organisasi dihapus.');
    }

    public function storeMembership(Request $request, AuthorizationService $authorization): RedirectResponse
    {
        $this->ensurePermission($request, $authorization, PermissionKey::PeopleManage);
        $payload = $request->validate([
            'organization_period_id' => ['required', 'uuid', 'exists:organization_periods,id'],
            'organization_unit_id' => ['required', 'uuid'],
            'person_id' => ['required', 'uuid', 'exists:people,id'],
            'title' => ['required', 'string', 'min:2', 'max:255'],
            'display_order' => ['required', 'integer', 'min:0', 'max:2147483647'],
            'active' => ['required', 'boolean'],
        ]);
        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($actor, $payload): void {
            $unit = OrganizationUnit::query()
                ->whereKey($payload['organization_unit_id'])
                ->where('organization_period_id', $payload['organization_period_id'])
                ->firstOrFail();
            $person = Person::query()->findOrFail($payload['person_id']);
            $membership = OrganizationMembership::create([
                'organization_period_id' => $payload['organization_period_id'],
                'organization_unit_id' => $unit->id,
                'person_id' => $person->id,
                'title' => trim($payload['title']),
                'display_order' => (int) $payload['display_order'],
                'active' => (bool) $payload['active'],
                'version' => 1,
            ]);
            $this->recordAudit($actor, 'organization.membership.create', 'organization_membership', $membership->id, $person->name.' - '.$membership->title, null, $this->snapshotMembership($membership), ['organization_period_id', 'organization_unit_id', 'person_id', 'title', 'display_order', 'active']);
        });

        return to_route('admin.organization.periods.show', $payload['organization_period_id'])->with('status', 'Penugasan pengurus dibuat.');
    }

    public function updateMembership(Request $request, string $id, AuthorizationService $authorization): RedirectResponse
    {
        $this->ensurePermission($request, $authorization, PermissionKey::PeopleManage);
        $payload = $request->validate([
            'organization_unit_id' => ['required', 'uuid'],
            'person_id' => ['required', 'uuid', 'exists:people,id'],
            'title' => ['required', 'string', 'min:2', 'max:255'],
            'display_order' => ['required', 'integer', 'min:0', 'max:2147483647'],
            'active' => ['required', 'boolean'],
            'version' => ['required', 'integer', 'min:1'],
        ]);
        /** @var User $actor */
        $actor = $request->user();
        $periodId = '';

        DB::transaction(function () use ($actor, $id, $payload, &$periodId): void {
            $membership = OrganizationMembership::query()->whereKey($id)->lockForUpdate()->firstOrFail();
            $periodId = $membership->organization_period_id;
            $this->assertVersion($membership, (int) $payload['version'], 'version', 'Versi penugasan telah berubah. Muat ulang halaman.');
            $unit = OrganizationUnit::query()->whereKey($payload['organization_unit_id'])->where('organization_period_id', $periodId)->firstOrFail();
            $person = Person::query()->findOrFail($payload['person_id']);
            $before = $this->snapshotMembership($membership);
            $membership->forceFill([
                'organization_unit_id' => $unit->id,
                'person_id' => $person->id,
                'title' => trim($payload['title']),
                'display_order' => (int) $payload['display_order'],
                'active' => (bool) $payload['active'],
                'version' => (int) $membership->version + 1,
            ])->save();
            $this->recordAudit($actor, 'organization.membership.update', 'organization_membership', $membership->id, $person->name.' - '.$membership->title, $before, $this->snapshotMembership($membership), ['organization_unit_id', 'person_id', 'title', 'display_order', 'active', 'version']);
        });

        return to_route('admin.organization.periods.show', $periodId)->with('status', 'Penugasan pengurus diperbarui.');
    }

    public function destroyMembership(Request $request, string $id, AuthorizationService $authorization): RedirectResponse
    {
        $this->ensurePermission($request, $authorization, PermissionKey::PeopleManage);
        /** @var User $actor */
        $actor = $request->user();
        $periodId = '';

        DB::transaction(function () use ($actor, $id, &$periodId): void {
            $membership = OrganizationMembership::query()->whereKey($id)->lockForUpdate()->firstOrFail();
            $periodId = $membership->organization_period_id;
            $before = $this->snapshotMembership($membership);
            $membership->delete();
            $this->recordAudit($actor, 'organization.membership.delete', 'organization_membership', $id, $before['title'], $before, null, ['deleted']);
        });

        return to_route('admin.organization.periods.show', $periodId)->with('status', 'Penugasan pengurus dihapus.');
    }

    public function storePerson(Request $request, AuthorizationService $authorization): RedirectResponse
    {
        $this->ensurePermission($request, $authorization, PermissionKey::PeopleManage);
        $payload = $this->validatedPerson($request);
        /** @var User $actor */
        $actor = $request->user();
        $personId = (string) Str::uuid();

        DB::transaction(function () use ($actor, $payload, $personId): void {
            $this->assertReadyPortrait($payload['portrait_media_id']);
            $person = new Person;
            $person->id = $personId;
            $person->forceFill([
                'name' => $payload['name'],
                'slug' => $this->uniquePersonSlug($payload['slug'] ?: $payload['name'], null, $personId),
                'gender' => $payload['gender'],
                'short_bio' => $payload['short_bio'],
                'portrait_media_id' => $payload['portrait_media_id'],
                'version' => 1,
            ])->save();
            $this->replaceSocialLinks($person, $payload['social_links']);
            $person->load('socialLinks');
            $this->recordAudit($actor, 'person.create', 'person', $person->id, $person->name, null, $this->snapshotPerson($person), ['name', 'slug', 'gender', 'short_bio', 'portrait_media_id', 'social_links']);
        });

        return to_route('admin.organization.index')->with('status', 'Profil orang dibuat.');
    }

    public function updatePerson(Request $request, string $id, AuthorizationService $authorization): RedirectResponse
    {
        $this->ensurePermission($request, $authorization, PermissionKey::PeopleManage);
        $payload = $this->validatedPerson($request, true);
        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($actor, $id, $payload): void {
            $person = Person::query()->whereKey($id)->with('socialLinks')->lockForUpdate()->firstOrFail();
            $this->assertVersion($person, (int) $payload['version'], 'version', 'Versi profil telah berubah. Muat ulang halaman.');
            $this->assertReadyPortrait($payload['portrait_media_id']);
            $before = $this->snapshotPerson($person);
            $person->forceFill([
                'name' => $payload['name'],
                'slug' => $this->uniquePersonSlug($payload['slug'] ?: $payload['name'], $person->id, $person->id),
                'gender' => $payload['gender'],
                'short_bio' => $payload['short_bio'],
                'portrait_media_id' => $payload['portrait_media_id'],
                'version' => (int) $person->version + 1,
            ])->save();
            $this->replaceSocialLinks($person, $payload['social_links']);
            $person->load('socialLinks');
            $this->recordAudit($actor, 'person.update', 'person', $person->id, $person->name, $before, $this->snapshotPerson($person), ['name', 'slug', 'gender', 'short_bio', 'portrait_media_id', 'social_links', 'version']);
        });

        return to_route('admin.organization.index')->with('status', 'Profil orang diperbarui.');
    }

    public function destroyPerson(Request $request, string $id, AuthorizationService $authorization): RedirectResponse
    {
        $this->ensurePermission($request, $authorization, PermissionKey::PeopleManage);
        $version = $request->validate(['version' => ['required', 'integer', 'min:1']])['version'];
        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($actor, $id, $version): void {
            $person = Person::query()->whereKey($id)->with('socialLinks')->lockForUpdate()->firstOrFail();
            $this->assertVersion($person, (int) $version, 'version', 'Versi profil telah berubah. Muat ulang halaman.');
            $before = $this->snapshotPerson($person);
            OrganizationAssignment::query()->where('person_id', $person->id)->delete();
            $person->delete();
            $this->recordAudit($actor, 'person.delete', 'person', $id, $before['name'], $before, null, ['deleted']);
        });

        return to_route('admin.organization.index')->with('status', 'Profil orang dihapus.');
    }

    public function mapLegacy(Request $request, AuthorizationService $authorization): RedirectResponse
    {
        $this->ensurePermission($request, $authorization, PermissionKey::PeopleManage);
        $payload = $request->validate([
            'legacy_assignment_id' => ['required', 'uuid', 'exists:organization_assignments,id'],
            'organization_period_id' => ['required', 'uuid', 'exists:organization_periods,id'],
            'organization_unit_id' => ['required', 'uuid'],
            'title' => ['nullable', 'string', 'max:255'],
            'person_id' => ['nullable', 'uuid', 'exists:people,id'],
        ]);
        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($actor, $payload): void {
            $legacy = OrganizationAssignment::query()->with('person')->findOrFail($payload['legacy_assignment_id']);
            $unit = OrganizationUnit::query()->whereKey($payload['organization_unit_id'])->where('organization_period_id', $payload['organization_period_id'])->firstOrFail();
            $person = Person::query()->findOrFail($payload['person_id'] ?? $legacy->person_id);
            $membership = OrganizationMembership::create([
                'organization_period_id' => $payload['organization_period_id'],
                'organization_unit_id' => $unit->id,
                'person_id' => $person->id,
                'title' => trim(($payload['title'] ?? null) ?: $legacy->title),
                'display_order' => (int) ($legacy->display_order ?? 0),
                'active' => (bool) $legacy->active,
                'version' => 1,
            ]);
            $this->recordAudit($actor, 'organization.legacy.map', 'organization_membership', $membership->id, 'Pemetaan '.$legacy->title, null, [
                'legacy_assignment_id' => $legacy->id,
                'organization_period_id' => $membership->organization_period_id,
                'organization_unit_id' => $membership->organization_unit_id,
                'person_id' => $membership->person_id,
                'title' => $membership->title,
            ], ['organization_period_id', 'organization_unit_id', 'person_id', 'title']);
        });

        return to_route('admin.organization.periods.show', $payload['organization_period_id'])->with('status', 'Penugasan lama dipetakan.');
    }

    /** @return array<string, mixed> */
    private function validatedPeriod(Request $request, bool $existing = false): array
    {
        $validated = $request->validate([
            'label' => ['required', 'string', 'min:2', 'max:255'],
            'start_year' => ['required', 'integer', 'min:1900', 'max:9999'],
            'end_year' => ['required', 'integer', 'min:1900', 'max:9999'],
            'vision' => ['nullable', 'string', 'max:10000'],
            'missions' => ['nullable', 'array', 'max:50'],
            'missions.*' => ['nullable', 'string', 'max:2000'],
            'lifecycle' => ['required', Rule::in(['draft', 'active', 'archived'])],
            'version' => $existing ? ['required', 'integer', 'min:1'] : ['nullable', 'integer', 'min:1'],
        ]);
        if ((int) $validated['start_year'] > (int) $validated['end_year']) {
            throw ValidationException::withMessages(['end_year' => 'Tahun selesai tidak boleh lebih kecil dari tahun mulai.']);
        }

        return [
            'label' => trim($validated['label']),
            'start_year' => (int) $validated['start_year'],
            'end_year' => (int) $validated['end_year'],
            'vision' => filled($validated['vision'] ?? null) ? trim($validated['vision']) : null,
            'missions' => collect($validated['missions'] ?? [])->map(fn (mixed $mission): string => trim((string) $mission))->filter()->values()->all(),
            'lifecycle' => $validated['lifecycle'],
            'version' => $validated['version'] ?? null,
        ];
    }

    /** @return array<string, mixed> */
    private function validatedPerson(Request $request, bool $existing = false): array
    {
        $platforms = array_map(static fn (SocialPlatform $platform): string => $platform->value, SocialPlatform::cases());
        $validated = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:255'],
            'slug' => ['nullable', 'string', 'max:255', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/'],
            'gender' => ['nullable', 'string', 'in:L,P'],
            'short_bio' => ['nullable', 'string', 'max:10000'],
            'portrait_media_id' => ['nullable', 'uuid'],
            'social_links' => ['nullable', 'array', 'max:30'],
            'social_links.*.platform' => ['required', Rule::in($platforms)],
            'social_links.*.label' => ['nullable', 'string', 'max:255'],
            'social_links.*.url' => ['required', 'string', 'max:2000', 'url', 'starts_with:https://'],
            'social_links.*.display_order' => ['nullable', 'integer', 'min:0', 'max:2147483647'],
            'version' => $existing ? ['required', 'integer', 'min:1'] : ['nullable', 'integer', 'min:1'],
        ]);
        foreach ($validated['social_links'] ?? [] as $index => $link) {
            if ($link['platform'] === SocialPlatform::Other->value && blank($link['label'] ?? null)) {
                throw ValidationException::withMessages(["social_links.{$index}.label" => 'Label wajib diisi untuk platform lainnya.']);
            }
        }

        return [
            'name' => trim($validated['name']),
            'slug' => filled($validated['slug'] ?? null) ? Str::slug($validated['slug']) : null,
            'gender' => $validated['gender'] ?? null,
            'short_bio' => filled($validated['short_bio'] ?? null) ? trim($validated['short_bio']) : null,
            'portrait_media_id' => filled($validated['portrait_media_id'] ?? null) ? $validated['portrait_media_id'] : null,
            'social_links' => collect($validated['social_links'] ?? [])->values()->map(fn (array $link, int $index): array => [
                'platform' => $link['platform'],
                'label' => filled($link['label'] ?? null) ? trim($link['label']) : null,
                'url' => trim($link['url']),
                'display_order' => (int) ($link['display_order'] ?? $index),
            ])->all(),
            'version' => $validated['version'] ?? null,
        ];
    }

    /** @param Collection<int, OrganizationUnit> $units */
    private function assertTreeWithCandidate(Collection $units, string $candidateId, ?string $parentId): void
    {
        $parentIds = $units->mapWithKeys(fn (OrganizationUnit $unit): array => [$unit->id => $unit->parent_id])->all();
        if ($parentId !== null && ! array_key_exists($parentId, $parentIds)) {
            throw ValidationException::withMessages(['parent_id' => 'Unit induk harus berasal dari periode yang sama.']);
        }
        $parentIds[$candidateId] = $parentId;
        $this->validateParentMap($parentIds);
    }

    /** @param EloquentCollection<int, OrganizationUnit> $units */
    private function validateOrganizationTree(EloquentCollection $units): void
    {
        $this->validateParentMap($units->mapWithKeys(fn (OrganizationUnit $unit): array => [$unit->id => $unit->parent_id])->all());
    }

    /** @param array<string, string|null> $parentIds */
    private function validateParentMap(array $parentIds): void
    {
        $state = [];
        $depths = [];
        $visit = function (string $id) use (&$visit, &$state, &$depths, $parentIds): int {
            if (($state[$id] ?? null) === 'visiting') {
                throw ValidationException::withMessages(['parent_id' => 'Terdeteksi struktur melingkar pada hierarki unit.']);
            }
            if (($state[$id] ?? null) === 'visited') {
                return $depths[$id];
            }
            if (! array_key_exists($id, $parentIds)) {
                throw ValidationException::withMessages(['parent_id' => 'Unit induk tidak ditemukan pada periode ini.']);
            }
            $state[$id] = 'visiting';
            $parentId = $parentIds[$id];
            $depth = $parentId === null ? 1 : $visit($parentId) + 1;
            if ($depth > 4) {
                throw ValidationException::withMessages(['parent_id' => 'Struktur organisasi maksimal 4 tingkat kedalaman.']);
            }
            $depths[$id] = $depth;
            $state[$id] = 'visited';

            return $depth;
        };

        foreach (array_keys($parentIds) as $id) {
            $visit($id);
        }
    }

    private function assertReadyPortrait(?string $mediaId): void
    {
        if ($mediaId === null) {
            return;
        }
        $ready = MediaAsset::query()->whereKey($mediaId)->where('lifecycle', 'ready')->where('mime_type', 'like', 'image/%')->exists();
        if (! $ready) {
            throw ValidationException::withMessages(['portrait_media_id' => 'Foto portrait harus berupa gambar siap pakai.']);
        }
    }

    /** @param list<array<string, mixed>> $links */
    private function replaceSocialLinks(Person $person, array $links): void
    {
        $person->socialLinks()->delete();
        foreach ($links as $link) {
            $person->socialLinks()->create([
                'platform' => $link['platform'],
                'label' => $link['label'],
                'url' => $link['url'],
                'display_order' => $link['display_order'],
            ]);
        }
    }

    private function uniquePersonSlug(string $value, ?string $ignoreId, string $suffixId): string
    {
        $base = Str::slug($value) ?: 'profil';
        $slug = $base;
        $counter = 0;
        while (Person::query()->where('slug', $slug)->when($ignoreId !== null, fn ($query) => $query->where('id', '!=', $ignoreId))->exists()) {
            $counter++;
            $slug = $base.'-'.substr($suffixId, 0, 4).($counter > 1 ? '-'.$counter : '');
        }

        return $slug;
    }

    /** @return list<array{id: string, url: string, filename: string, alt: ?string}> */
    private function mediaOptions(): array
    {
        return MediaAsset::query()
            ->where('lifecycle', 'ready')
            ->where('mime_type', 'like', 'image/%')
            ->orderByDesc('created_at')
            ->limit(200)
            ->get()
            ->map(fn (MediaAsset $asset): array => [
                'id' => $asset->id,
                'url' => $asset->url,
                'filename' => $asset->filename,
                'alt' => $asset->alt,
            ])->values()->all();
    }

    /** @return array<string, mixed> */
    private function presentPeriod(OrganizationPeriod $period, array $extra = []): array
    {
        return array_merge([
            'id' => $period->id,
            'label' => $period->label,
            'startYear' => (int) $period->start_year,
            'endYear' => (int) $period->end_year,
            'vision' => $period->vision,
            'missions' => $period->mission_json ?? [],
            'lifecycle' => $period->lifecycle,
            'version' => (int) $period->version,
            'createdAt' => $period->created_at?->toIso8601String(),
            'updatedAt' => $period->updated_at?->toIso8601String(),
        ], $extra);
    }

    /** @return array<string, mixed> */
    private function presentUnit(OrganizationUnit $unit): array
    {
        return [
            'id' => $unit->id,
            'periodId' => $unit->organization_period_id,
            'parentId' => $unit->parent_id,
            'name' => $unit->name,
            'displayOrder' => (int) $unit->display_order,
            'active' => (bool) $unit->active,
        ];
    }

    /** @return array<string, mixed> */
    private function presentMembership(OrganizationMembership $membership): array
    {
        return [
            'id' => $membership->id,
            'periodId' => $membership->organization_period_id,
            'unitId' => $membership->organization_unit_id,
            'personId' => $membership->person_id,
            'title' => $membership->title,
            'displayOrder' => (int) $membership->display_order,
            'active' => (bool) $membership->active,
            'version' => (int) $membership->version,
            'personName' => $membership->person?->name ?? 'Anonim',
            'personSlug' => $membership->person?->slug,
            'portraitUrl' => $membership->person?->portraitMedia?->url,
        ];
    }

    /** @return array<string, mixed> */
    private function presentPerson(Person $person, array $extra = []): array
    {
        return array_merge([
            'id' => $person->id,
            'name' => $person->name,
            'slug' => $person->slug,
            'gender' => $person->gender,
            'shortBio' => $person->short_bio,
            'portraitMediaId' => $person->portrait_media_id,
            'portraitAsset' => $person->portraitMedia === null ? null : [
                'id' => $person->portraitMedia->id,
                'url' => $person->portraitMedia->url,
                'filename' => $person->portraitMedia->filename,
                'alt' => $person->portraitMedia->alt,
            ],
            'version' => (int) $person->version,
            'socialLinks' => $person->socialLinks->map(fn (PersonSocialLink $link): array => [
                'id' => $link->id,
                'platform' => $link->platform instanceof SocialPlatform ? $link->platform->value : (string) $link->platform,
                'label' => $link->label,
                'url' => $link->url,
                'displayOrder' => (int) $link->display_order,
            ])->values()->all(),
        ], $extra);
    }

    /** @return array<string, mixed> */
    private function presentLegacy(OrganizationAssignment $assignment, bool $mapped): array
    {
        return [
            'id' => $assignment->id,
            'editionId' => $assignment->edition_id,
            'personId' => $assignment->person_id,
            'personName' => $assignment->person?->name ?? 'Anonim',
            'title' => $assignment->title,
            'group' => $assignment->group,
            'termLabel' => $assignment->term_label,
            'displayOrder' => (int) $assignment->display_order,
            'active' => (bool) $assignment->active,
            'isMapped' => $mapped,
        ];
    }

    /** @return array<string, mixed> */
    private function snapshotPeriod(OrganizationPeriod $period): array
    {
        return [
            'id' => $period->id,
            'label' => $period->label,
            'start_year' => (int) $period->start_year,
            'end_year' => (int) $period->end_year,
            'vision' => $period->vision,
            'mission_json' => $period->mission_json ?? [],
            'lifecycle' => $period->lifecycle,
            'version' => (int) $period->version,
        ];
    }

    /** @return array<string, mixed> */
    private function snapshotUnit(OrganizationUnit $unit): array
    {
        return [
            'id' => $unit->id,
            'organization_period_id' => $unit->organization_period_id,
            'parent_id' => $unit->parent_id,
            'name' => $unit->name,
            'display_order' => (int) $unit->display_order,
            'active' => (bool) $unit->active,
        ];
    }

    /** @return array<string, mixed> */
    private function snapshotMembership(OrganizationMembership $membership): array
    {
        return [
            'id' => $membership->id,
            'organization_period_id' => $membership->organization_period_id,
            'organization_unit_id' => $membership->organization_unit_id,
            'person_id' => $membership->person_id,
            'title' => $membership->title,
            'display_order' => (int) $membership->display_order,
            'active' => (bool) $membership->active,
            'version' => (int) $membership->version,
        ];
    }

    /** @return array<string, mixed> */
    private function snapshotPerson(Person $person): array
    {
        return [
            'id' => $person->id,
            'name' => $person->name,
            'slug' => $person->slug,
            'gender' => $person->gender,
            'short_bio' => $person->short_bio,
            'portrait_media_id' => $person->portrait_media_id,
            'social_links' => $person->socialLinks->map(fn (PersonSocialLink $link): array => [
                'platform' => $link->platform instanceof SocialPlatform ? $link->platform->value : (string) $link->platform,
                'label' => $link->label,
                'url' => $link->url,
                'display_order' => (int) $link->display_order,
            ])->values()->all(),
            'version' => (int) $person->version,
        ];
    }

    private function assertVersion(object $model, int $version, string $field, string $message): void
    {
        if ((int) $model->version !== $version) {
            throw ValidationException::withMessages([$field => $message]);
        }
    }

    /** @param array<string, mixed>|null $before @param array<string, mixed>|null $after */
    private function recordAudit(User $actor, string $action, string $resourceType, string $resourceId, string $resourceLabel, ?array $before, ?array $after, array $changedFields): void
    {
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
            'source' => 'laravel-admin-organization',
            'created_at' => now(),
        ]);
    }

    /** @return array{id: string, name: string, email: string} */
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

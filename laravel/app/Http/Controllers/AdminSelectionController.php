<?php

namespace App\Http\Controllers;

use App\Enums\PermissionKey;
use App\Enums\StageDecision;
use App\Models\AuditLog;
use App\Models\Category;
use App\Models\Edition;
use App\Models\EditionTitle;
use App\Models\Participant;
use App\Models\ParticipantStageEntry;
use App\Models\SelectionStage;
use App\Models\User;
use App\Services\ActiveEditionContext;
use App\Services\AuthorizationService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class AdminSelectionController extends Controller
{
    public function stagesIndex(
        Request $request,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): Response {
        $this->ensurePermission($request, $authorization, PermissionKey::ContentView);
        $edition = $this->resolveEdition($request, $editionContext);

        $stages = $edition === null
            ? collect()
            : SelectionStage::query()
                ->where('edition_id', $edition->id)
                ->withCount('stageEntries')
                ->withCount([
                    'stageEntries as pending_count' => fn ($query) => $query->where('decision', StageDecision::Pending->value),
                    'stageEntries as advanced_count' => fn ($query) => $query->where('decision', StageDecision::Advanced->value),
                    'stageEntries as eliminated_count' => fn ($query) => $query->where('decision', StageDecision::Eliminated->value),
                ])
                ->orderBy('display_order')
                ->orderBy('id')
                ->get();

        return Inertia::render('Admin/Participants/Stages/Index', [
            'user' => $this->presentUser($request),
            'editionName' => $edition?->name ?? 'Edisi aktif',
            'stages' => $stages->map(fn (SelectionStage $stage): array => $this->presentStage($stage, [
                'total' => (int) $stage->stage_entries_count,
                'pending' => (int) $stage->pending_count,
                'advanced' => (int) $stage->advanced_count,
                'eliminated' => (int) $stage->eliminated_count,
            ]))->values()->all(),
            'canEdit' => $this->hasPermission($request, $authorization, PermissionKey::ParticipantsManage),
        ]);
    }

    public function stageWorkspace(
        Request $request,
        string $id,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): Response {
        $this->ensurePermission($request, $authorization, PermissionKey::ContentView);
        $edition = $this->resolveEdition($request, $editionContext);
        abort_if($edition === null, 404);

        $stage = SelectionStage::query()
            ->where('edition_id', $edition->id)
            ->whereKey($id)
            ->firstOrFail();
        $allStages = SelectionStage::query()
            ->where('edition_id', $edition->id)
            ->orderBy('display_order')
            ->orderBy('id')
            ->get();
        $stageIndex = $allStages->search(fn (SelectionStage $candidate): bool => $candidate->id === $stage->id);
        $nextStage = $stageIndex === false ? null : ($allStages->get($stageIndex + 1));
        $previousStage = $stageIndex === false ? null : ($allStages->get($stageIndex - 1));

        $entries = ParticipantStageEntry::query()
            ->where('stage_id', $stage->id)
            ->with(['participant.category'])
            ->get()
            ->sortBy([
                ['participant.number', 'asc'],
                ['participant.name', 'asc'],
            ]);

        return Inertia::render('Admin/Participants/Stages/Workspace', [
            'user' => $this->presentUser($request),
            'editionName' => $edition->name,
            'stage' => $this->presentStage($stage),
            'nextStage' => $nextStage === null ? null : $this->presentStageSummary($nextStage),
            'previousStage' => $previousStage === null ? null : [
                'id' => $previousStage->id,
                'name' => $previousStage->name,
            ],
            'categories' => Category::query()
                ->where('edition_id', $edition->id)
                ->orderBy('display_order')
                ->orderBy('id')
                ->get()
                ->map(fn (Category $category): array => [
                    'id' => $category->id,
                    'code' => $category->code->value,
                    'label' => $category->label,
                ])->values()->all(),
            'entries' => $entries->map(fn (ParticipantStageEntry $entry): array => [
                'id' => $entry->id,
                'participantId' => $entry->participant_id,
                'decision' => $entry->decision->value,
                'decidedAt' => $entry->decided_at?->toIso8601String(),
                'reason' => $entry->reason,
                'version' => (int) $entry->version,
                'participantNumber' => (int) $entry->participant->number,
                'participantName' => $entry->participant->name,
                'participantSlug' => $entry->participant->slug,
                'participantActive' => (bool) $entry->participant->active,
                'categoryCode' => $entry->participant->category?->code->value ?? '',
                'categoryLabel' => $entry->participant->category?->label ?? '',
                'categoryId' => $entry->participant->category_id,
            ])->values()->all(),
            'canEdit' => $this->hasPermission($request, $authorization, PermissionKey::ParticipantsManage),
        ]);
    }

    public function titlesIndex(
        Request $request,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): Response {
        $this->ensurePermission($request, $authorization, PermissionKey::ContentView);
        $edition = $this->resolveEdition($request, $editionContext);

        if ($edition === null) {
            return Inertia::render('Admin/Participants/Titles/Index', [
                'user' => $this->presentUser($request),
                'editionName' => 'Edisi aktif',
                'finalStage' => null,
                'finalists' => [],
                'titles' => [],
                'finalistsWithoutTitle' => 0,
                'canEdit' => false,
            ]);
        }

        $finalStage = SelectionStage::query()
            ->where('edition_id', $edition->id)
            ->where('final_stage', true)
            ->first();
        $titles = EditionTitle::query()
            ->where('edition_id', $edition->id)
            ->with('participants')
            ->orderBy('display_order')
            ->orderBy('id')
            ->get();
        $finalists = $finalStage === null
            ? collect()
            : Participant::query()
                ->where('edition_id', $edition->id)
                ->where('current_stage_id', $finalStage->id)
                ->with('category')
                ->get()
                ->sortBy([
                    ['category.display_order', 'asc'],
                    ['number', 'asc'],
                    ['name', 'asc'],
                ]);
        $participantsWithTitle = $titles
            ->flatMap(fn (EditionTitle $title) => $title->participants->pluck('id'))
            ->unique();

        return Inertia::render('Admin/Participants/Titles/Index', [
            'user' => $this->presentUser($request),
            'editionName' => $edition->name,
            'finalStage' => $finalStage === null ? null : [
                'id' => $finalStage->id,
                'name' => $finalStage->name,
            ],
            'finalists' => $finalists->map(fn (Participant $participant): array => [
                'id' => $participant->id,
                'number' => (int) $participant->number,
                'name' => $participant->name,
                'categoryCode' => $participant->category?->code->value ?? '',
            ])->values()->all(),
            'titles' => $titles->map(fn (EditionTitle $title): array => [
                'id' => $title->id,
                'name' => $title->name,
                'description' => $title->description,
                'capacity' => (int) $title->capacity,
                'displayOrder' => (int) $title->display_order,
                'active' => (bool) $title->active,
                'version' => (int) $title->version,
                'participantIds' => $title->participants->pluck('id')->values()->all(),
            ])->values()->all(),
            'finalistsWithoutTitle' => $finalists->filter(fn (Participant $participant): bool => ! $participantsWithTitle->contains($participant->id))->count(),
            'canEdit' => $this->hasPermission($request, $authorization, PermissionKey::ParticipantsManage),
        ]);
    }

    public function storeStage(
        Request $request,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::ParticipantsManage);
        $edition = $this->requiredEdition($request, $editionContext);
        $payload = $this->validatedStage($request);
        /** @var User $actor */
        $actor = $request->user();

        $stage = DB::transaction(function () use ($actor, $edition, $payload): SelectionStage {
            $slug = Str::slug($payload['name']);
            if ($slug === '') {
                throw ValidationException::withMessages(['name' => 'Nama tahap menghasilkan slug kosong.']);
            }
            if (SelectionStage::query()->where('edition_id', $edition->id)->where('slug', $slug)->exists()) {
                throw ValidationException::withMessages(['name' => 'Nama tahap sudah digunakan pada edisi ini.']);
            }
            if ($payload['final_stage'] && SelectionStage::query()->where('edition_id', $edition->id)->where('final_stage', true)->exists()) {
                throw ValidationException::withMessages(['final_stage' => 'Edisi ini sudah memiliki tahap final.']);
            }
            $displayOrder = ((int) SelectionStage::query()->where('edition_id', $edition->id)->max('display_order')) + 1;
            $stage = SelectionStage::create([
                'edition_id' => $edition->id,
                'name' => $payload['name'],
                'slug' => $slug,
                'display_order' => $displayOrder,
                'target_participant_count' => $payload['target_participant_count'],
                'lifecycle' => 'draft',
                'final_stage' => $payload['final_stage'],
                'version' => 1,
            ]);
            $this->recordAudit($actor, 'selection_stage.create', null, $this->snapshotStage($stage), $stage->id, $stage->name, ['edition_id', 'name', 'slug', 'display_order', 'target_participant_count', 'final_stage', 'version']);

            return $stage;
        });

        return to_route('admin.selection.stages.index')->with('status', "Tahap {$stage->name} dibuat.");
    }

    public function updateStage(
        Request $request,
        string $id,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::ParticipantsManage);
        $edition = $this->requiredEdition($request, $editionContext);
        $payload = $this->validatedStage($request, true);
        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($actor, $edition, $id, $payload): void {
            $stage = $this->lockedStage($id, $edition);
            $this->assertVersion($stage, (int) $payload['version'], 'stage');
            $entryCount = $stage->stageEntries()->count();
            if ($payload['target_participant_count'] < $entryCount) {
                throw ValidationException::withMessages(['target_participant_count' => 'Target tidak boleh kurang dari peserta yang sudah masuk.']);
            }
            if ($payload['final_stage'] && ! $stage->final_stage && SelectionStage::query()
                ->where('edition_id', $edition->id)
                ->where('final_stage', true)
                ->where('id', '!=', $stage->id)
                ->exists()) {
                throw ValidationException::withMessages(['final_stage' => 'Edisi ini sudah memiliki tahap final.']);
            }
            if ($stage->final_stage && ! $payload['final_stage']) {
                $usedByTitle = DB::table('participant_title_assignments')
                    ->join('participants', 'participants.id', '=', 'participant_title_assignments.participant_id')
                    ->where('participants.edition_id', $edition->id)
                    ->where('participants.current_stage_id', $stage->id)
                    ->exists();
                $usedByVoting = DB::table('voting_campaigns')
                    ->where('edition_id', $edition->id)
                    ->where('eligibility_stage_id', $stage->id)
                    ->exists();
                $usedBySnapshot = DB::table('voting_campaign_participants')
                    ->where('source_stage_id', $stage->id)
                    ->exists();
                if ($usedByTitle || $usedByVoting || $usedBySnapshot) {
                    throw ValidationException::withMessages(['final_stage' => 'Tahap final yang sudah dipakai tidak dapat diubah.']);
                }
            }

            $before = $this->snapshotStage($stage);
            $stage->forceFill([
                'name' => $payload['name'],
                'target_participant_count' => $payload['target_participant_count'],
                'final_stage' => $payload['final_stage'],
                'version' => (int) $stage->version + 1,
            ])->save();
            $this->recordAudit($actor, 'selection_stage.update', $before, $this->snapshotStage($stage), $stage->id, $stage->name, ['name', 'target_participant_count', 'final_stage', 'version']);
        });

        return to_route('admin.selection.stages.index')->with('status', 'Tahap seleksi diperbarui.');
    }

    public function reorderStages(
        Request $request,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::ParticipantsManage);
        $edition = $this->requiredEdition($request, $editionContext);
        $items = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.id' => ['required', 'uuid'],
            'items.*.version' => ['required', 'integer', 'min:1'],
        ])['items'];
        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($actor, $edition, $items): void {
            if (count(collect($items)->pluck('id')->unique()) !== count($items)) {
                throw ValidationException::withMessages(['items' => 'Urutan tahap tidak valid.']);
            }
            $stages = SelectionStage::query()
                ->where('edition_id', $edition->id)
                ->orderBy('display_order')
                ->orderBy('id')
                ->lockForUpdate()
                ->get();
            $ids = collect($items)->pluck('id');
            if ($stages->count() !== count($items) || $stages->contains(fn (SelectionStage $stage): bool => ! $ids->contains($stage->id))) {
                throw ValidationException::withMessages(['items' => 'Urutan harus memuat seluruh tahap edisi aktif.']);
            }
            if ($stages->contains(fn (SelectionStage $stage): bool => $stage->stageEntries()->exists())) {
                throw ValidationException::withMessages(['items' => 'Tahap yang sudah dipakai tidak dapat dipindahkan.']);
            }
            $beforeOrder = $stages->pluck('id')->values()->all();
            foreach ($items as $displayOrder => $item) {
                $stage = $stages->firstWhere('id', $item['id']);
                if ($stage === null || (int) $stage->version !== (int) $item['version']) {
                    throw ValidationException::withMessages(['items' => 'Urutan tahap telah berubah. Muat ulang halaman.']);
                }
                $stage->forceFill([
                    'display_order' => $displayOrder,
                    'version' => (int) $stage->version + 1,
                ])->save();
            }
            $this->recordAudit($actor, 'selection_stage.reorder', ['order' => $beforeOrder], ['order' => $ids->values()->all()], $edition->id, 'Urutan tahap', ['display_order', 'version']);
        });

        return to_route('admin.selection.stages.index')->with('status', 'Urutan tahap disimpan.');
    }

    public function openStage(
        Request $request,
        string $id,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::ParticipantsManage);
        $edition = $this->requiredEdition($request, $editionContext);
        $version = $request->validate(['version' => ['required', 'integer', 'min:1']])['version'];
        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($actor, $edition, $id, $version): void {
            $stage = $this->lockedStage($id, $edition);
            $this->assertVersion($stage, (int) $version, 'stage');
            if ($stage->lifecycle !== 'draft') {
                throw ValidationException::withMessages(['stage' => 'Hanya tahap draft yang dapat dibuka.']);
            }
            if (SelectionStage::query()->where('edition_id', $edition->id)->where('lifecycle', 'active')->exists()) {
                throw ValidationException::withMessages(['stage' => 'Tutup tahap aktif sebelum membuka tahap lain.']);
            }
            $previous = SelectionStage::query()
                ->where('edition_id', $edition->id)
                ->where('display_order', '<', $stage->display_order)
                ->orderByDesc('display_order')
                ->first();
            if ($previous !== null && $previous->lifecycle !== 'closed') {
                throw ValidationException::withMessages(['stage' => 'Tahap sebelumnya harus ditutup terlebih dahulu.']);
            }
            $before = $this->snapshotStage($stage);
            $stage->forceFill(['lifecycle' => 'active', 'version' => (int) $stage->version + 1])->save();
            $this->recordAudit($actor, 'selection_stage.open', $before, $this->snapshotStage($stage), $stage->id, $stage->name, ['lifecycle', 'version']);
        });

        return to_route('admin.selection.stage.workspace', ['id' => $id])->with('status', 'Tahap seleksi dibuka.');
    }

    public function setStageDecisions(
        Request $request,
        string $id,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::ParticipantsManage);
        $edition = $this->requiredEdition($request, $editionContext);
        $validated = $request->validate([
            'decision' => ['required', Rule::in([StageDecision::Advanced->value, StageDecision::Eliminated->value])],
            'entries' => ['required', 'array', 'min:1'],
            'entries.*.id' => ['required', 'uuid'],
            'entries.*.version' => ['required', 'integer', 'min:1'],
            'reason' => ['nullable', 'string', 'max:2000'],
        ]);
        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($actor, $edition, $id, $validated): void {
            $stage = $this->lockedStage($id, $edition);
            if ($stage->lifecycle !== 'active') {
                throw ValidationException::withMessages(['stage' => 'Keputusan hanya dapat dibuat pada tahap aktif.']);
            }
            $items = collect($validated['entries']);
            if ($items->pluck('id')->unique()->count() !== $items->count()) {
                throw ValidationException::withMessages(['entries' => 'Daftar peserta tidak valid.']);
            }
            $entries = ParticipantStageEntry::query()
                ->whereIn('id', $items->pluck('id'))
                ->with('participant')
                ->lockForUpdate()
                ->get();
            if ($entries->count() !== $items->count() || $entries->contains(fn (ParticipantStageEntry $entry): bool => $entry->stage_id !== $stage->id || $entry->participant->edition_id !== $edition->id)) {
                throw ValidationException::withMessages(['entries' => 'Peserta harus berasal dari tahap dan edisi aktif.']);
            }
            foreach ($entries as $entry) {
                $expected = (int) $items->firstWhere('id', $entry->id)['version'];
                if ((int) $entry->version !== $expected) {
                    throw ValidationException::withMessages(['entries' => 'Keputusan peserta telah berubah. Muat ulang halaman.']);
                }
            }
            $nextStage = SelectionStage::query()
                ->where('edition_id', $edition->id)
                ->where('display_order', '>', $stage->display_order)
                ->orderBy('display_order')
                ->first();
            if ($validated['decision'] === StageDecision::Advanced->value && $nextStage !== null) {
                $currentAdvanced = ParticipantStageEntry::query()
                    ->where('stage_id', $stage->id)
                    ->where('decision', StageDecision::Advanced->value)
                    ->count();
                $selectedAdvanced = $entries->where('decision', StageDecision::Advanced)->count();
                if ($currentAdvanced - $selectedAdvanced + $entries->count() > (int) $nextStage->target_participant_count) {
                    throw ValidationException::withMessages(['entries' => 'Jumlah peserta lolos melebihi target tahap berikutnya.']);
                }
            }
            $reason = trim((string) ($validated['reason'] ?? '')) ?: null;
            $before = $entries->map(fn (ParticipantStageEntry $entry): array => [
                'id' => $entry->id,
                'decision' => $entry->decision->value,
                'version' => (int) $entry->version,
            ])->values()->all();
            foreach ($entries as $entry) {
                $entry->forceFill([
                    'decision' => $validated['decision'],
                    'decided_at' => now(),
                    'decided_by_user_id' => $actor->id,
                    'reason' => $reason,
                    'version' => (int) $entry->version + 1,
                ])->save();
                $entry->participant->forceFill([
                    'selection_status' => $validated['decision'] === StageDecision::Advanced->value ? 'active' : 'eliminated',
                ])->save();
            }
            $this->recordAudit($actor, 'participant_stage_entry.bulk_decision', ['entries' => $before], [
                'entries' => $entries->map(fn (ParticipantStageEntry $entry): array => [
                    'id' => $entry->id,
                    'decision' => $validated['decision'],
                    'version' => (int) $entry->version,
                ])->values()->all(),
            ], $stage->id, $stage->name, ['decision', 'decided_at', 'decided_by_user_id', 'reason', 'version', 'selection_status'], $reason);
        });

        return to_route('admin.selection.stage.workspace', ['id' => $id])->with('status', 'Keputusan peserta disimpan.');
    }

    public function rollbackDecision(
        Request $request,
        string $stageId,
        string $entryId,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::ParticipantsManage);
        $edition = $this->requiredEdition($request, $editionContext);
        $validated = $request->validate([
            'version' => ['required', 'integer', 'min:1'],
            'reason' => ['required', 'string', 'min:5', 'max:2000'],
        ]);
        /** @var User $actor */
        $actor = $request->user();
        $reason = trim($validated['reason']);

        DB::transaction(function () use ($actor, $edition, $stageId, $entryId, $validated, $reason): void {
            $entry = ParticipantStageEntry::query()
                ->whereKey($entryId)
                ->with(['stage', 'participant'])
                ->lockForUpdate()
                ->firstOrFail();
            if ($entry->stage_id !== $stageId || $entry->stage->edition_id !== $edition->id || $entry->participant->edition_id !== $edition->id) {
                throw ValidationException::withMessages(['entry' => 'Keputusan tidak ditemukan pada edisi aktif.']);
            }
            if ($entry->stage->lifecycle !== 'active') {
                throw ValidationException::withMessages(['entry' => 'Rollback hanya tersedia pada tahap aktif.']);
            }
            $this->assertVersion($entry, (int) $validated['version'], 'entry');
            if ($entry->decision === StageDecision::Pending) {
                throw ValidationException::withMessages(['entry' => 'Keputusan peserta masih pending.']);
            }
            $hasDownstream = ParticipantStageEntry::query()
                ->where('participant_id', $entry->participant_id)
                ->whereHas('stage', fn ($query) => $query->where('edition_id', $edition->id)->where('display_order', '>', $entry->stage->display_order))
                ->exists();
            $hasSnapshot = DB::table('voting_campaign_participants')->where('participant_id', $entry->participant_id)->exists();
            $hasTitle = DB::table('participant_title_assignments')->where('participant_id', $entry->participant_id)->exists();
            if ($hasDownstream || $hasSnapshot || $hasTitle) {
                throw ValidationException::withMessages(['entry' => 'Keputusan tidak dapat dirollback karena peserta sudah dipakai pada proses berikutnya.']);
            }
            $hasPrevious = SelectionStage::query()
                ->where('edition_id', $edition->id)
                ->where('display_order', '<', $entry->stage->display_order)
                ->exists();
            $before = ['decision' => $entry->decision->value, 'version' => (int) $entry->version];
            $entry->forceFill([
                'decision' => StageDecision::Pending,
                'decided_at' => null,
                'decided_by_user_id' => null,
                'reason' => $reason,
                'version' => (int) $entry->version + 1,
            ])->save();
            $entry->participant->forceFill(['selection_status' => $hasPrevious ? 'active' : 'registered'])->save();
            $this->recordAudit($actor, 'participant_stage_entry.rollback', $before, [
                'decision' => StageDecision::Pending->value,
                'version' => (int) $entry->version,
            ], $entry->id, $entry->stage->name, ['decision', 'decided_at', 'decided_by_user_id', 'reason', 'version', 'selection_status'], $reason);
        });

        return to_route('admin.selection.stage.workspace', ['id' => $stageId])->with('status', 'Keputusan dikembalikan ke pending.');
    }

    public function closeStage(
        Request $request,
        string $id,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::ParticipantsManage);
        $edition = $this->requiredEdition($request, $editionContext);
        $validated = $request->validate([
            'version' => ['required', 'integer', 'min:1'],
            'allow_under_target' => ['nullable', 'boolean'],
            'reason' => ['nullable', 'string', 'max:2000'],
        ]);
        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($actor, $edition, $id, $validated): void {
            $stage = $this->lockedStage($id, $edition);
            $this->assertVersion($stage, (int) $validated['version'], 'stage');
            if ($stage->lifecycle !== 'active') {
                throw ValidationException::withMessages(['stage' => 'Hanya tahap aktif yang dapat ditutup.']);
            }
            $entries = ParticipantStageEntry::query()->where('stage_id', $stage->id)->with('participant')->lockForUpdate()->get();
            if ($entries->contains(fn (ParticipantStageEntry $entry): bool => $entry->decision === StageDecision::Pending)) {
                throw ValidationException::withMessages(['stage' => 'Selesaikan seluruh keputusan peserta sebelum menutup tahap.']);
            }
            $advanced = $entries->where('decision', StageDecision::Advanced);
            $nextStage = SelectionStage::query()
                ->where('edition_id', $edition->id)
                ->where('display_order', '>', $stage->display_order)
                ->orderBy('display_order')
                ->lockForUpdate()
                ->first();
            if (! $stage->final_stage && $nextStage === null) {
                throw ValidationException::withMessages(['stage' => 'Buat tahap berikutnya atau tandai tahap ini sebagai final.']);
            }
            $reason = trim((string) ($validated['reason'] ?? '')) ?: null;
            $allowUnderTarget = (bool) ($validated['allow_under_target'] ?? false);
            if ($nextStage !== null) {
                if ($advanced->count() > (int) $nextStage->target_participant_count) {
                    throw ValidationException::withMessages(['stage' => 'Jumlah peserta lolos melebihi target tahap berikutnya.']);
                }
                if ($advanced->count() < (int) $nextStage->target_participant_count && (! $allowUnderTarget || $reason === null || mb_strlen($reason) < 5)) {
                    throw ValidationException::withMessages(['reason' => 'Konfirmasi dan alasan minimal 5 karakter diperlukan untuk menutup di bawah target.']);
                }
            }
            $before = $this->snapshotStage($stage);
            $stage->forceFill(['lifecycle' => 'closed', 'version' => (int) $stage->version + 1])->save();
            $advancedParticipantIds = $advanced->pluck('participant_id')->values();
            if ($stage->final_stage) {
                if ($advancedParticipantIds->isNotEmpty()) {
                    Participant::query()->where('edition_id', $edition->id)->whereIn('id', $advancedParticipantIds)->update([
                        'selection_status' => 'completed',
                        'updated_at' => now(),
                    ]);
                }
            } elseif ($nextStage !== null) {
                if ($nextStage->lifecycle === 'closed') {
                    throw ValidationException::withMessages(['stage' => 'Tahap berikutnya sudah ditutup.']);
                }
                if ($nextStage->lifecycle === 'draft') {
                    $nextStage->forceFill(['lifecycle' => 'active', 'version' => (int) $nextStage->version + 1])->save();
                }
                foreach ($advanced as $entry) {
                    if (ParticipantStageEntry::query()->where('participant_id', $entry->participant_id)->where('stage_id', $nextStage->id)->exists()) {
                        throw ValidationException::withMessages(['stage' => 'Peserta sudah memiliki entri pada tahap berikutnya.']);
                    }
                    ParticipantStageEntry::create([
                        'participant_id' => $entry->participant_id,
                        'stage_id' => $nextStage->id,
                        'decision' => StageDecision::Pending,
                        'version' => 1,
                    ]);
                    $entry->participant->forceFill([
                        'current_stage_id' => $nextStage->id,
                        'selection_status' => 'active',
                    ])->save();
                }
            }
            $this->recordAudit($actor, 'selection_stage.close', $before, [
                'lifecycle' => 'closed',
                'version' => (int) $stage->version,
                'advancedParticipantIds' => $advancedParticipantIds->all(),
                'nextStageId' => $nextStage?->id,
            ], $stage->id, $stage->name, ['lifecycle', 'version', 'participantStageEntries', 'currentStageId', 'selectionStatus'], $reason);
        });

        return to_route('admin.selection.stage.workspace', ['id' => $id])->with('status', 'Tahap seleksi ditutup.');
    }

    public function reopenStage(
        Request $request,
        string $id,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::ParticipantsManage);
        $edition = $this->requiredEdition($request, $editionContext);
        $validated = $request->validate([
            'version' => ['required', 'integer', 'min:1'],
            'reason' => ['required', 'string', 'min:5', 'max:2000'],
        ]);
        /** @var User $actor */
        $actor = $request->user();
        $reason = trim($validated['reason']);

        DB::transaction(function () use ($actor, $edition, $id, $validated, $reason): void {
            $stage = $this->lockedStage($id, $edition);
            $this->assertVersion($stage, (int) $validated['version'], 'stage');
            if ($stage->lifecycle !== 'closed') {
                throw ValidationException::withMessages(['stage' => 'Hanya tahap tertutup yang dapat dibuka kembali.']);
            }
            if ($stage->final_stage) {
                throw ValidationException::withMessages(['stage' => 'Tahap final yang selesai tidak dapat dibuka kembali dari alur seleksi.']);
            }
            $nextStage = SelectionStage::query()
                ->where('edition_id', $edition->id)
                ->where('display_order', '>', $stage->display_order)
                ->orderBy('display_order')
                ->lockForUpdate()
                ->first();
            if ($nextStage === null || $nextStage->lifecycle !== 'active') {
                throw ValidationException::withMessages(['stage' => 'Tahap berikutnya tidak berada pada kondisi yang dapat dipulihkan.']);
            }
            $nextEntries = ParticipantStageEntry::query()->where('stage_id', $nextStage->id)->with('participant')->lockForUpdate()->get();
            if ($nextEntries->contains(fn (ParticipantStageEntry $entry): bool => $entry->decision !== StageDecision::Pending)) {
                throw ValidationException::withMessages(['stage' => 'Tahap berikutnya sudah memiliki keputusan dan tidak dapat dipulihkan.']);
            }
            $nextParticipantIds = $nextEntries->pluck('participant_id');
            if ($nextParticipantIds->isNotEmpty()) {
                if (DB::table('voting_campaign_participants')->whereIn('participant_id', $nextParticipantIds)->exists() || DB::table('participant_title_assignments')->whereIn('participant_id', $nextParticipantIds)->exists()) {
                    throw ValidationException::withMessages(['stage' => 'Peserta tahap berikutnya sudah digunakan pada proses lanjutan.']);
                }
            }
            if (ParticipantStageEntry::query()
                ->whereIn('stage_id', SelectionStage::query()->where('edition_id', $edition->id)->where('display_order', '>', $nextStage->display_order)->pluck('id'))
                ->exists()) {
                throw ValidationException::withMessages(['stage' => 'Alur seleksi sudah berlanjut melewati tahap berikutnya.']);
            }
            $before = $this->snapshotStage($stage);
            $stage->forceFill(['lifecycle' => 'active', 'version' => (int) $stage->version + 1])->save();
            $nextStage->forceFill(['lifecycle' => 'draft', 'version' => (int) $nextStage->version + 1])->save();
            if ($nextParticipantIds->isNotEmpty()) {
                ParticipantStageEntry::query()->where('stage_id', $nextStage->id)->whereIn('participant_id', $nextParticipantIds)->delete();
                Participant::query()->where('edition_id', $edition->id)->whereIn('id', $nextParticipantIds)->update([
                    'current_stage_id' => $stage->id,
                    'selection_status' => 'active',
                    'updated_at' => now(),
                ]);
            }
            $this->recordAudit($actor, 'selection_stage.reopen', $before, [
                'lifecycle' => 'active',
                'nextStageId' => $nextStage->id,
                'nextLifecycle' => 'draft',
                'restoredParticipantIds' => $nextParticipantIds->all(),
            ], $stage->id, $stage->name, ['lifecycle', 'participantStageEntries', 'currentStageId', 'selectionStatus', 'version'], $reason);
        });

        return to_route('admin.selection.stage.workspace', ['id' => $id])->with('status', 'Tahap seleksi dibuka kembali.');
    }

    public function destroyStage(
        Request $request,
        string $id,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::ParticipantsManage);
        $edition = $this->requiredEdition($request, $editionContext);
        $version = $request->validate(['version' => ['required', 'integer', 'min:1']])['version'];
        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($actor, $edition, $id, $version): void {
            $stage = $this->lockedStage($id, $edition);
            $this->assertVersion($stage, (int) $version, 'stage');
            $used = $stage->stageEntries()->exists()
                || Participant::query()->where('current_stage_id', $stage->id)->exists()
                || DB::table('voting_campaigns')->where('eligibility_stage_id', $stage->id)->exists()
                || DB::table('voting_campaign_participants')->where('source_stage_id', $stage->id)->exists();
            if ($used) {
                throw ValidationException::withMessages(['stage' => 'Tahap yang sudah digunakan tidak dapat dihapus.']);
            }
            $before = $this->snapshotStage($stage);
            $stage->delete();
            $remaining = SelectionStage::query()->where('edition_id', $edition->id)->orderBy('display_order')->orderBy('id')->lockForUpdate()->get();
            foreach ($remaining as $displayOrder => $item) {
                $item->forceFill(['display_order' => $displayOrder, 'version' => (int) $item->version + 1])->save();
            }
            $this->recordAudit($actor, 'selection_stage.delete', $before, null, $stage->id, $stage->name, ['deleted', 'display_order']);
        });

        return to_route('admin.selection.stages.index')->with('status', 'Tahap seleksi dihapus.');
    }

    public function storeTitle(
        Request $request,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::ParticipantsManage);
        $edition = $this->requiredEdition($request, $editionContext);
        $payload = $this->validatedTitle($request);
        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($actor, $edition, $payload): void {
            if (EditionTitle::query()->where('edition_id', $edition->id)->where('name', $payload['name'])->exists()) {
                throw ValidationException::withMessages(['name' => 'Nama gelar sudah digunakan pada edisi ini.']);
            }
            $displayOrder = ((int) EditionTitle::query()->where('edition_id', $edition->id)->max('display_order')) + 1;
            $title = EditionTitle::create([
                'edition_id' => $edition->id,
                'name' => $payload['name'],
                'description' => $payload['description'],
                'capacity' => $payload['capacity'],
                'display_order' => $displayOrder,
                'active' => true,
                'version' => 1,
            ]);
            $this->recordAudit($actor, 'edition_title.create', null, $this->snapshotTitle($title), $title->id, $title->name, ['edition_id', 'name', 'description', 'capacity', 'display_order', 'active', 'version']);
        });

        return to_route('admin.selection.titles.index')->with('status', 'Gelar dibuat.');
    }

    public function updateTitle(
        Request $request,
        string $id,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::ParticipantsManage);
        $edition = $this->requiredEdition($request, $editionContext);
        $payload = $this->validatedTitle($request, true);
        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($actor, $edition, $id, $payload): void {
            $title = $this->lockedTitle($id, $edition);
            $this->assertVersion($title, (int) $payload['version'], 'title');
            $assignmentCount = DB::table('participant_title_assignments')->where('edition_title_id', $title->id)->count();
            if ($payload['capacity'] < $assignmentCount) {
                throw ValidationException::withMessages(['capacity' => "Jumlah slot tidak boleh kurang dari {$assignmentCount} gelar yang sudah terisi."]);
            }
            if (EditionTitle::query()->where('edition_id', $edition->id)->where('name', $payload['name'])->where('id', '!=', $title->id)->exists()) {
                throw ValidationException::withMessages(['name' => 'Nama gelar sudah digunakan pada edisi ini.']);
            }
            $before = $this->snapshotTitle($title);
            $title->forceFill([
                'name' => $payload['name'],
                'description' => $payload['description'],
                'capacity' => $payload['capacity'],
                'version' => (int) $title->version + 1,
            ])->save();
            $this->recordAudit($actor, 'edition_title.update', $before, $this->snapshotTitle($title), $title->id, $title->name, ['name', 'description', 'capacity', 'version']);
        });

        return to_route('admin.selection.titles.index')->with('status', 'Gelar diperbarui.');
    }

    public function reorderTitles(
        Request $request,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::ParticipantsManage);
        $edition = $this->requiredEdition($request, $editionContext);
        $items = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.id' => ['required', 'uuid'],
            'items.*.version' => ['required', 'integer', 'min:1'],
        ])['items'];
        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($actor, $edition, $items): void {
            $titles = EditionTitle::query()->where('edition_id', $edition->id)->orderBy('display_order')->orderBy('id')->lockForUpdate()->get();
            $ids = collect($items)->pluck('id');
            if ($ids->unique()->count() !== $ids->count() || $titles->count() !== count($items) || $titles->contains(fn (EditionTitle $title): bool => ! $ids->contains($title->id))) {
                throw ValidationException::withMessages(['items' => 'Urutan harus memuat seluruh gelar edisi aktif.']);
            }
            $beforeOrder = $titles->pluck('id')->values()->all();
            foreach ($items as $displayOrder => $item) {
                $title = $titles->firstWhere('id', $item['id']);
                if ($title === null || (int) $title->version !== (int) $item['version']) {
                    throw ValidationException::withMessages(['items' => 'Urutan gelar telah berubah. Muat ulang halaman.']);
                }
                $title->forceFill(['display_order' => $displayOrder, 'version' => (int) $title->version + 1])->save();
            }
            $this->recordAudit($actor, 'edition_title.reorder', ['order' => $beforeOrder], ['order' => $ids->values()->all()], $edition->id, 'Urutan gelar', ['display_order', 'version']);
        });

        return to_route('admin.selection.titles.index')->with('status', 'Urutan gelar disimpan.');
    }

    public function toggleTitle(
        Request $request,
        string $id,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::ParticipantsManage);
        $edition = $this->requiredEdition($request, $editionContext);
        $validated = $request->validate([
            'version' => ['required', 'integer', 'min:1'],
            'active' => ['required', 'boolean'],
        ]);
        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($actor, $edition, $id, $validated): void {
            $title = $this->lockedTitle($id, $edition);
            $this->assertVersion($title, (int) $validated['version'], 'title');
            $before = $this->snapshotTitle($title);
            $title->forceFill(['active' => (bool) $validated['active'], 'version' => (int) $title->version + 1])->save();
            $this->recordAudit($actor, 'edition_title.active.update', $before, $this->snapshotTitle($title), $title->id, $title->name, ['active', 'version']);
        });

        return to_route('admin.selection.titles.index')->with('status', 'Status gelar diperbarui.');
    }

    public function destroyTitle(
        Request $request,
        string $id,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::ParticipantsManage);
        $edition = $this->requiredEdition($request, $editionContext);
        $version = $request->validate(['version' => ['required', 'integer', 'min:1']])['version'];
        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($actor, $edition, $id, $version): void {
            $title = $this->lockedTitle($id, $edition);
            $this->assertVersion($title, (int) $version, 'title');
            if (DB::table('participant_title_assignments')->where('edition_title_id', $title->id)->exists()) {
                throw ValidationException::withMessages(['title' => 'Gelar yang sudah diberikan tidak dapat dihapus.']);
            }
            $before = $this->snapshotTitle($title);
            $title->delete();
            $this->recordAudit($actor, 'edition_title.delete', $before, null, $title->id, $title->name, ['deleted']);
        });

        return to_route('admin.selection.titles.index')->with('status', 'Gelar dihapus.');
    }

    public function assignTitle(
        Request $request,
        string $id,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::ParticipantsManage);
        $edition = $this->requiredEdition($request, $editionContext);
        $validated = $request->validate([
            'participant_id' => ['required', 'uuid'],
            'version' => ['required', 'integer', 'min:1'],
        ]);
        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($actor, $edition, $id, $validated): void {
            $title = $this->lockedTitle($id, $edition);
            $this->assertVersion($title, (int) $validated['version'], 'title');
            if (! $title->active) {
                throw ValidationException::withMessages(['title' => 'Gelar nonaktif tidak dapat diberikan.']);
            }
            $participant = Participant::query()->where('edition_id', $edition->id)->whereKey($validated['participant_id'])->with('currentStage')->lockForUpdate()->first();
            if ($participant === null) {
                throw ValidationException::withMessages(['participant_id' => 'Peserta tidak ditemukan pada edisi aktif.']);
            }
            if ($participant->currentStage === null || ! $participant->currentStage->final_stage) {
                throw ValidationException::withMessages(['participant_id' => 'Gelar hanya dapat diberikan kepada peserta tahap final.']);
            }
            if (DB::table('participant_title_assignments')->where('edition_title_id', $title->id)->where('participant_id', $participant->id)->exists()) {
                throw ValidationException::withMessages(['participant_id' => 'Peserta sudah menerima gelar ini.']);
            }
            $assignmentCount = DB::table('participant_title_assignments')->where('edition_title_id', $title->id)->count();
            if ($assignmentCount >= (int) $title->capacity) {
                throw ValidationException::withMessages(['title' => 'Jumlah slot gelar sudah penuh.']);
            }
            $before = $this->snapshotTitle($title);
            $title->forceFill(['version' => (int) $title->version + 1])->save();
            DB::table('participant_title_assignments')->insert([
                'edition_title_id' => $title->id,
                'participant_id' => $participant->id,
                'assigned_at' => now(),
                'assigned_by_user_id' => $actor->id,
            ]);
            $this->recordAudit($actor, 'edition_title.assign', $before, [
                'assignmentCount' => $assignmentCount + 1,
                'participantId' => $participant->id,
                'version' => (int) $title->version,
            ], $title->id, $title->name, ['assignments', 'version']);
        });

        return to_route('admin.selection.titles.index')->with('status', 'Gelar diberikan.');
    }

    public function unassignTitle(
        Request $request,
        string $id,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::ParticipantsManage);
        $edition = $this->requiredEdition($request, $editionContext);
        $validated = $request->validate([
            'participant_id' => ['required', 'uuid'],
            'version' => ['required', 'integer', 'min:1'],
        ]);
        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($actor, $edition, $id, $validated): void {
            $title = $this->lockedTitle($id, $edition);
            $this->assertVersion($title, (int) $validated['version'], 'title');
            $participant = Participant::query()->where('edition_id', $edition->id)->whereKey($validated['participant_id'])->first();
            if ($participant === null) {
                throw ValidationException::withMessages(['participant_id' => 'Peserta tidak ditemukan pada edisi aktif.']);
            }
            $assignment = DB::table('participant_title_assignments')
                ->where('edition_title_id', $title->id)
                ->where('participant_id', $participant->id);
            if (! $assignment->exists()) {
                throw ValidationException::withMessages(['participant_id' => 'Peserta belum menerima gelar ini.']);
            }
            $assignmentCount = DB::table('participant_title_assignments')->where('edition_title_id', $title->id)->count();
            $before = $this->snapshotTitle($title);
            $title->forceFill(['version' => (int) $title->version + 1])->save();
            $assignment->delete();
            $this->recordAudit($actor, 'edition_title.unassign', $before, [
                'assignmentCount' => $assignmentCount - 1,
                'participantId' => $participant->id,
                'version' => (int) $title->version,
            ], $title->id, $title->name, ['assignments', 'version']);
        });

        return to_route('admin.selection.titles.index')->with('status', 'Gelar dilepas.');
    }

    private function validatedStage(Request $request, bool $existing = false): array
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:255'],
            'target_participant_count' => ['required', 'integer', 'min:1', 'max:2147483647'],
            'final_stage' => ['nullable', 'boolean'],
            'version' => $existing ? ['required', 'integer', 'min:1'] : ['nullable', 'integer', 'min:1'],
        ]);

        return [
            'name' => trim($validated['name']),
            'target_participant_count' => (int) $validated['target_participant_count'],
            'final_stage' => (bool) ($validated['final_stage'] ?? false),
            'version' => $validated['version'] ?? null,
        ];
    }

    private function validatedTitle(Request $request, bool $existing = false): array
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'capacity' => ['required', 'integer', 'min:1', 'max:2147483647'],
            'version' => $existing ? ['required', 'integer', 'min:1'] : ['nullable', 'integer', 'min:1'],
        ]);

        return [
            'name' => trim($validated['name']),
            'description' => filled($validated['description'] ?? null) ? trim($validated['description']) : null,
            'capacity' => (int) $validated['capacity'],
            'version' => $validated['version'] ?? null,
        ];
    }

    private function resolveEdition(Request $request, ActiveEditionContext $editionContext): ?Edition
    {
        $resolved = $editionContext->resolve($request->cookie(ActiveEditionContext::COOKIE_NAME));

        return $resolved === null ? null : Edition::query()->find($resolved['id']);
    }

    private function requiredEdition(Request $request, ActiveEditionContext $editionContext): Edition
    {
        $edition = $this->resolveEdition($request, $editionContext);
        abort_if($edition === null, 422, 'Konteks edisi aktif tidak ditemukan.');

        return $edition;
    }

    private function lockedStage(string $id, Edition $edition): SelectionStage
    {
        return SelectionStage::query()->where('edition_id', $edition->id)->whereKey($id)->lockForUpdate()->firstOrFail();
    }

    private function lockedTitle(string $id, Edition $edition): EditionTitle
    {
        return EditionTitle::query()->where('edition_id', $edition->id)->whereKey($id)->lockForUpdate()->firstOrFail();
    }

    private function assertVersion(object $model, int $version, string $field): void
    {
        if ((int) $model->version !== $version) {
            $errorField = $field === 'stage' ? 'version' : $field;

            throw ValidationException::withMessages([$errorField => 'Versi data telah berubah. Muat ulang halaman.']);
        }
    }

    private function presentStage(SelectionStage $stage, ?array $stats = null): array
    {
        return [
            'id' => $stage->id,
            'editionId' => $stage->edition_id,
            'name' => $stage->name,
            'slug' => $stage->slug,
            'displayOrder' => (int) $stage->display_order,
            'targetParticipantCount' => (int) $stage->target_participant_count,
            'lifecycle' => $stage->lifecycle,
            'finalStage' => (bool) $stage->final_stage,
            'version' => (int) $stage->version,
            'stats' => $stats ?? [
                'total' => (int) ($stage->stage_entries_count ?? $stage->stageEntries()->count()),
                'pending' => (int) ($stage->pending_count ?? 0),
                'advanced' => (int) ($stage->advanced_count ?? 0),
                'eliminated' => (int) ($stage->eliminated_count ?? 0),
            ],
        ];
    }

    private function presentStageSummary(SelectionStage $stage): array
    {
        return [
            'id' => $stage->id,
            'name' => $stage->name,
            'displayOrder' => (int) $stage->display_order,
            'targetParticipantCount' => (int) $stage->target_participant_count,
            'lifecycle' => $stage->lifecycle,
            'finalStage' => (bool) $stage->final_stage,
        ];
    }

    private function snapshotStage(SelectionStage $stage): array
    {
        return [
            'id' => $stage->id,
            'edition_id' => $stage->edition_id,
            'name' => $stage->name,
            'slug' => $stage->slug,
            'display_order' => (int) $stage->display_order,
            'target_participant_count' => (int) $stage->target_participant_count,
            'lifecycle' => $stage->lifecycle,
            'final_stage' => (bool) $stage->final_stage,
            'version' => (int) $stage->version,
        ];
    }

    private function snapshotTitle(EditionTitle $title): array
    {
        return [
            'id' => $title->id,
            'edition_id' => $title->edition_id,
            'name' => $title->name,
            'description' => $title->description,
            'capacity' => (int) $title->capacity,
            'display_order' => (int) $title->display_order,
            'active' => (bool) $title->active,
            'version' => (int) $title->version,
        ];
    }

    private function recordAudit(
        User $actor,
        string $action,
        ?array $before,
        ?array $after,
        string $resourceId,
        string $resourceLabel,
        array $changedFields,
        ?string $reason = null,
    ): void {
        AuditLog::create([
            'actor_user_id' => $actor->id,
            'actor_label' => $actor->email,
            'action' => $action,
            'resource_type' => str_starts_with($action, 'edition_title.') ? 'editionTitle' : (str_starts_with($action, 'participant_stage_entry.') ? 'participantStageEntry' : 'selectionStage'),
            'resource_id' => $resourceId,
            'resource_label' => $resourceLabel,
            'before_json' => $before,
            'after_json' => $after,
            'changed_fields_json' => $changedFields,
            'source' => 'laravel-admin-selection',
            'reason' => $reason,
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

<?php

namespace App\Http\Controllers;

use App\Enums\PermissionKey;
use App\Models\AuditLog;
use App\Models\Edition;
use App\Models\Participant;
use App\Models\SelectionStage;
use App\Models\User;
use App\Models\VoteDailyTally;
use App\Models\VotingCampaign;
use App\Models\VotingCampaignParticipant;
use App\Services\ActiveEditionContext;
use App\Services\AuthorizationService;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class AdminVotingController extends Controller
{
    public function index(
        Request $request,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): Response {
        $this->ensurePermission($request, $authorization, PermissionKey::VotingView);
        $edition = $this->resolveEdition($request, $editionContext);

        if ($edition === null) {
            return Inertia::render('Admin/Voting/Index', [
                'user' => $this->presentUser($request),
                'edition' => null,
                'editionName' => 'Edisi aktif',
                'campaigns' => [],
                'stages' => [],
                'participants' => [],
                'tallies' => [],
                'canManage' => $this->hasPermission($request, $authorization, PermissionKey::VotingManage),
                'canTally' => $this->hasPermission($request, $authorization, PermissionKey::VotingTally),
            ]);
        }

        $campaigns = VotingCampaign::query()
            ->with('eligibilityStage')
            ->where('edition_id', $edition->id)
            ->orderByDesc('starts_at')
            ->orderByDesc('id')
            ->get();
        $stages = SelectionStage::query()
            ->where('edition_id', $edition->id)
            ->orderBy('display_order')
            ->orderBy('id')
            ->get();
        $campaignIds = $campaigns->modelKeys();
        $snapshots = $campaignIds === []
            ? collect()
            : VotingCampaignParticipant::query()
                ->with(['participant.category', 'participant.qrisMedia'])
                ->whereIn('campaign_id', $campaignIds)
                ->whereHas('participant', fn ($query) => $query->where('edition_id', $edition->id))
                ->get()
                ->sortBy([
                    ['campaign_id', 'asc'],
                    ['participant.category.display_order', 'asc'],
                    ['participant.display_order', 'asc'],
                    ['participant.number', 'asc'],
                ]);
        $tallies = $campaignIds === []
            ? collect()
            : VoteDailyTally::query()
                ->whereIn('campaign_id', $campaignIds)
                ->orderByDesc('local_date')
                ->get();

        return Inertia::render('Admin/Voting/Index', [
            'user' => $this->presentUser($request),
            'edition' => [
                'id' => $edition->id,
                'year' => (int) $edition->year,
                'name' => $edition->name,
                'lifecycle' => $edition->lifecycle,
            ],
            'editionName' => $edition->name,
            'campaigns' => $campaigns->map(fn (VotingCampaign $campaign): array => $this->presentCampaign($campaign))->values()->all(),
            'stages' => $stages->map(fn (SelectionStage $stage): array => $this->presentStage($stage))->values()->all(),
            'participants' => $snapshots->map(fn (VotingCampaignParticipant $snapshot): array => $this->presentSnapshot($snapshot))->values()->all(),
            'tallies' => $tallies->map(fn (VoteDailyTally $tally): array => $this->presentTally($tally))->values()->all(),
            'canManage' => $this->hasPermission($request, $authorization, PermissionKey::VotingManage),
            'canTally' => $this->hasPermission($request, $authorization, PermissionKey::VotingTally),
        ]);
    }

    public function storeCampaign(
        Request $request,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::VotingManage);
        $edition = $this->requireEdition($request, $editionContext);
        $validated = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:160'],
            'slug' => ['required', 'string', 'max:160', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/'],
            'eligibility_stage_id' => ['required', 'uuid'],
            'starts_at' => ['required', 'date_format:Y-m-d\\TH:i'],
            'ends_at' => ['required', 'date_format:Y-m-d\\TH:i'],
            'price_per_point' => ['required', 'integer', 'min:1'],
        ]);
        $name = trim((string) $validated['name']);
        $slug = strtolower(trim((string) $validated['slug']));
        $stage = $this->stageForEdition($edition, (string) $validated['eligibility_stage_id']);
        $startsAt = $this->parseWibDate((string) $validated['starts_at'], 'starts_at');
        $endsAt = $this->parseWibDate((string) $validated['ends_at'], 'ends_at');
        if ($startsAt->greaterThanOrEqualTo($endsAt)) {
            throw ValidationException::withMessages(['ends_at' => 'Waktu selesai harus setelah waktu mulai.']);
        }
        if (VotingCampaign::query()->where('slug', $slug)->exists()) {
            throw ValidationException::withMessages(['slug' => 'Slug kampanye sudah digunakan.']);
        }
        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($actor, $edition, $stage, $name, $slug, $startsAt, $endsAt, $validated): void {
            $campaign = VotingCampaign::create([
                'id' => (string) Str::uuid(),
                'edition_id' => $edition->id,
                'eligibility_stage_id' => $stage->id,
                'name' => $name,
                'slug' => $slug,
                'timezone' => 'Asia/Jakarta',
                'starts_at' => $startsAt,
                'ends_at' => $endsAt,
                'status' => 'draft',
                'price_per_point' => (int) $validated['price_per_point'],
                'result_visibility' => 'hidden',
                'version' => 1,
            ]);
            $this->recordAudit(
                $actor,
                'voting.campaign.create',
                'voting_campaign',
                $campaign->id,
                $campaign->name,
                null,
                $this->campaignSnapshot($campaign),
                ['edition_id', 'eligibility_stage_id', 'name', 'slug', 'starts_at', 'ends_at', 'price_per_point', 'status', 'result_visibility', 'version'],
                null,
            );
        });

        return to_route('admin.voting.index')->with('status', 'Kampanye voting dibuat sebagai draf.');
    }

    public function updateCampaignStage(
        Request $request,
        string $id,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::VotingManage);
        $edition = $this->requireEdition($request, $editionContext);
        $validated = $request->validate([
            'stage_id' => ['required', 'uuid'],
            'version' => ['required', 'integer', 'min:1'],
        ]);
        $stage = $this->stageForEdition($edition, (string) $validated['stage_id']);
        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($actor, $edition, $id, $stage, $validated): void {
            $campaign = $this->lockedCampaign($id, $edition);
            $this->assertVersion((int) $campaign->version, (int) $validated['version'], 'Kampanye telah diubah. Muat ulang halaman.');
            if ($campaign->status !== 'draft') {
                throw ValidationException::withMessages(['stage_id' => 'Tahap sumber hanya dapat diubah saat kampanye masih draf.']);
            }
            if ($campaign->campaignParticipants()->exists()) {
                throw ValidationException::withMessages(['stage_id' => 'Tahap sumber tidak dapat diubah setelah snapshot dibuat.']);
            }
            $before = $this->campaignSnapshot($campaign);
            $campaign->forceFill([
                'eligibility_stage_id' => $stage->id,
                'version' => (int) $campaign->version + 1,
            ])->save();
            $this->recordAudit($actor, 'voting.campaign.stage.update', 'voting_campaign', $campaign->id, $campaign->name, $before, $this->campaignSnapshot($campaign), ['eligibility_stage_id', 'version'], null);
        });

        return to_route('admin.voting.index')->with('status', 'Tahap sumber disimpan.');
    }

    public function startCampaign(
        Request $request,
        string $id,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::VotingManage);
        $edition = $this->requireEdition($request, $editionContext);
        $validated = $request->validate([
            'confirmation' => ['required', 'string', 'max:160'],
            'reason' => ['required', 'string', 'max:500'],
            'version' => ['required', 'integer', 'min:1'],
        ]);
        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($actor, $edition, $id, $validated): void {
            $campaign = $this->lockedCampaign($id, $edition);
            $this->assertVersion((int) $campaign->version, (int) $validated['version'], 'Kampanye telah diubah. Muat ulang halaman.');
            if ($campaign->status !== 'draft') {
                throw ValidationException::withMessages(['version' => 'Hanya kampanye draf yang dapat dimulai.']);
            }
            if (trim((string) $validated['confirmation']) !== $campaign->name) {
                throw ValidationException::withMessages(['confirmation' => 'Ketik nama kampanye untuk mengonfirmasi.']);
            }
            if ($campaign->eligibility_stage_id === null) {
                throw ValidationException::withMessages(['stage_id' => 'Pilih tahap sumber sebelum memulai voting.']);
            }
            $this->stageForEdition($edition, $campaign->eligibility_stage_id);
            if ($campaign->campaignParticipants()->exists()) {
                throw ValidationException::withMessages(['version' => 'Snapshot kampanye sudah pernah dibuat.']);
            }
            $eligible = Participant::query()
                ->where('edition_id', $edition->id)
                ->where('current_stage_id', $campaign->eligibility_stage_id)
                ->where('active', true)
                ->where('selection_status', '!=', 'eliminated')
                ->get(['id']);
            if ($eligible->isEmpty()) {
                throw ValidationException::withMessages(['stage_id' => 'Tahap sumber belum memiliki peserta aktif.']);
            }
            $now = now();
            foreach ($eligible as $participant) {
                VotingCampaignParticipant::create([
                    'campaign_id' => $campaign->id,
                    'participant_id' => $participant->id,
                    'source_stage_id' => $campaign->eligibility_stage_id,
                    'added_at' => $now,
                ]);
            }
            $before = $this->campaignSnapshot($campaign);
            $campaign->forceFill([
                'status' => 'active',
                'started_at' => $now,
                'version' => (int) $campaign->version + 1,
            ])->save();
            $this->recordAudit($actor, 'voting.campaign.start', 'voting_campaign', $campaign->id, $campaign->name, $before, $this->campaignSnapshot($campaign) + ['snapshot_count' => $eligible->count()], ['status', 'started_at', 'snapshot', 'version'], (string) $validated['reason']);
        });

        return to_route('admin.voting.index')->with('status', 'Voting dimulai dan snapshot peserta dibuat.');
    }

    public function closeCampaign(
        Request $request,
        string $id,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::VotingManage);
        $edition = $this->requireEdition($request, $editionContext);
        $validated = $request->validate([
            'confirmation' => ['required', 'string', 'max:160'],
            'reason' => ['required', 'string', 'max:500'],
            'version' => ['required', 'integer', 'min:1'],
        ]);
        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($actor, $edition, $id, $validated): void {
            $campaign = $this->lockedCampaign($id, $edition);
            $this->assertVersion((int) $campaign->version, (int) $validated['version'], 'Kampanye telah diubah. Muat ulang halaman.');
            if ($campaign->status !== 'active') {
                throw ValidationException::withMessages(['version' => 'Hanya kampanye aktif yang dapat ditutup.']);
            }
            if (trim((string) $validated['confirmation']) !== $campaign->name) {
                throw ValidationException::withMessages(['confirmation' => 'Ketik nama kampanye untuk mengonfirmasi.']);
            }
            $before = $this->campaignSnapshot($campaign);
            $campaign->forceFill([
                'status' => 'closed',
                'closed_at' => now(),
                'version' => (int) $campaign->version + 1,
            ])->save();
            $this->recordAudit($actor, 'voting.campaign.close', 'voting_campaign', $campaign->id, $campaign->name, $before, $this->campaignSnapshot($campaign), ['status', 'closed_at', 'version'], (string) $validated['reason']);
        });

        return to_route('admin.voting.index')->with('status', 'Voting ditutup.');
    }

    public function updateVisibility(
        Request $request,
        string $id,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::VotingManage);
        $edition = $this->requireEdition($request, $editionContext);
        $validated = $request->validate([
            'visibility' => ['required', 'in:hidden,visible'],
            'reason' => ['required', 'string', 'max:500'],
            'version' => ['required', 'integer', 'min:1'],
        ]);
        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($actor, $edition, $id, $validated): void {
            $campaign = $this->lockedCampaign($id, $edition);
            $this->assertVersion((int) $campaign->version, (int) $validated['version'], 'Kampanye telah diubah. Muat ulang halaman.');
            if ($validated['visibility'] === 'visible' && $campaign->status === 'draft') {
                throw ValidationException::withMessages(['visibility' => 'Hasil kampanye draf belum dapat ditampilkan.']);
            }
            $before = $this->campaignSnapshot($campaign);
            $campaign->forceFill([
                'result_visibility' => $validated['visibility'],
                'version' => (int) $campaign->version + 1,
            ])->save();
            $this->recordAudit($actor, 'voting.campaign.visibility.update', 'voting_campaign', $campaign->id, $campaign->name, $before, $this->campaignSnapshot($campaign), ['result_visibility', 'version'], (string) $validated['reason']);
        });

        return to_route('admin.voting.index')->with('status', 'Visibilitas hasil diperbarui.');
    }

    public function storeTally(
        Request $request,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::VotingTally);
        $edition = $this->requireEdition($request, $editionContext);
        $validated = $request->validate([
            'campaign_id' => ['required', 'uuid'],
            'participant_id' => ['required', 'uuid'],
            'local_date' => ['required', 'date_format:Y-m-d'],
            'amount' => ['required', 'integer', 'min:0'],
            'version' => ['required', 'integer', 'min:0'],
            'reason' => ['required', 'string', 'max:500'],
        ]);
        $this->assertLocalDate((string) $validated['local_date']);
        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($actor, $edition, $validated): void {
            $campaign = VotingCampaign::query()->where('edition_id', $edition->id)->whereKey($validated['campaign_id'])->lockForUpdate()->firstOrFail();
            if ($campaign->status !== 'active') {
                throw ValidationException::withMessages(['campaign_id' => 'Tally hanya dapat diubah saat voting aktif.']);
            }
            $snapshot = VotingCampaignParticipant::query()
                ->where('campaign_id', $campaign->id)
                ->where('participant_id', $validated['participant_id'])
                ->first();
            if ($snapshot === null) {
                throw ValidationException::withMessages(['participant_id' => 'Peserta tidak ada pada snapshot kampanye.']);
            }
            $participant = Participant::query()->with('qrisMedia')->where('edition_id', $edition->id)->find($validated['participant_id']);
            if ($participant === null) {
                throw ValidationException::withMessages(['participant_id' => 'Peserta tidak ditemukan pada edisi aktif.']);
            }
            $qris = $participant->qrisMedia;
            if ($qris === null || $qris->lifecycle !== 'ready' || ! str_starts_with(strtolower($qris->mime_type), 'image/')) {
                throw ValidationException::withMessages(['participant_id' => 'Peserta belum memiliki gambar QRIS yang siap.']);
            }
            $firstDate = $campaign->starts_at->setTimezone($campaign->timezone)->format('Y-m-d');
            $lastDate = $campaign->ends_at->setTimezone($campaign->timezone)->format('Y-m-d');
            if ($validated['local_date'] < $firstDate || $validated['local_date'] > $lastDate) {
                throw ValidationException::withMessages(['local_date' => 'Tanggal tally berada di luar periode kampanye.']);
            }
            $tally = VoteDailyTally::query()
                ->where('campaign_id', $campaign->id)
                ->where('participant_id', $participant->id)
                ->where('local_date', $validated['local_date'])
                ->lockForUpdate()
                ->first();
            $expectedVersion = (int) $validated['version'];
            if (($tally?->version ?? 0) !== $expectedVersion) {
                throw ValidationException::withMessages(['version' => 'Tally telah diubah. Muat ulang halaman.']);
            }
            $before = $tally === null ? null : $this->tallySnapshot($tally);
            $nextVersion = $expectedVersion + 1;
            if ($tally === null) {
                $tally = VoteDailyTally::create([
                    'id' => (string) Str::uuid(),
                    'campaign_id' => $campaign->id,
                    'participant_id' => $participant->id,
                    'local_date' => $validated['local_date'],
                    'amount' => (int) $validated['amount'],
                    'version' => $nextVersion,
                ]);
            } else {
                $tally->forceFill(['amount' => (int) $validated['amount'], 'version' => $nextVersion])->save();
            }
            $this->recordAudit($actor, $before === null ? 'voting.tally.create' : 'voting.tally.correct', 'vote_daily_tally', $tally->id, $participant->name, $before, $this->tallySnapshot($tally), ['amount', 'version'], (string) $validated['reason']);
        });

        return to_route('admin.voting.index')->with('status', 'Tally harian disimpan.');
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

    private function lockedCampaign(string $id, Edition $edition): VotingCampaign
    {
        return VotingCampaign::query()->where('edition_id', $edition->id)->whereKey($id)->lockForUpdate()->firstOrFail();
    }

    private function stageForEdition(Edition $edition, string $id): SelectionStage
    {
        return SelectionStage::query()->where('edition_id', $edition->id)->whereKey($id)->first()
            ?? throw ValidationException::withMessages(['stage_id' => 'Tahap sumber tidak ditemukan pada edisi aktif.']);
    }

    private function parseWibDate(string $value, string $field): CarbonImmutable
    {
        $date = CarbonImmutable::createFromFormat('Y-m-d\\TH:i', $value, 'Asia/Jakarta');
        if ($date === false || $date->format('Y-m-d\\TH:i') !== $value) {
            throw ValidationException::withMessages([$field => 'Tanggal dan waktu WIB tidak valid.']);
        }

        return $date->utc();
    }

    private function assertLocalDate(string $value): void
    {
        $date = CarbonImmutable::createFromFormat('!Y-m-d', $value, 'UTC');
        if ($date === false || $date->format('Y-m-d') !== $value) {
            throw ValidationException::withMessages(['local_date' => 'Tanggal lokal tidak valid.']);
        }
    }

    private function assertVersion(int $actual, int $provided, string $message): void
    {
        if ($actual !== $provided) {
            throw ValidationException::withMessages(['version' => $message]);
        }
    }

    private function presentCampaign(VotingCampaign $campaign): array
    {
        return [
            'id' => $campaign->id,
            'editionId' => $campaign->edition_id,
            'editionName' => $campaign->edition?->name,
            'year' => $campaign->edition?->year,
            'name' => $campaign->name,
            'slug' => $campaign->slug,
            'timezone' => $campaign->timezone,
            'status' => $campaign->status,
            'statusLabel' => match ($campaign->status) {
                'active' => 'Aktif',
                'closed' => 'Ditutup',
                default => 'Draf',
            },
            'pricePerPoint' => (int) $campaign->price_per_point,
            'startsAt' => $campaign->starts_at?->toIso8601String(),
            'endsAt' => $campaign->ends_at?->toIso8601String(),
            'eligibilityStageId' => $campaign->eligibility_stage_id,
            'stageName' => $campaign->eligibilityStage?->name,
            'resultVisibility' => $campaign->result_visibility,
            'startedAt' => $campaign->started_at?->toIso8601String(),
            'closedAt' => $campaign->closed_at?->toIso8601String(),
            'version' => (int) $campaign->version,
        ];
    }

    private function presentStage(SelectionStage $stage): array
    {
        return [
            'id' => $stage->id,
            'name' => $stage->name,
            'displayOrder' => (int) $stage->display_order,
            'finalStage' => (bool) $stage->final_stage,
            'lifecycle' => $stage->lifecycle,
        ];
    }

    private function presentSnapshot(VotingCampaignParticipant $snapshot): array
    {
        $participant = $snapshot->participant;
        $category = $participant?->category;
        $qris = $participant?->qrisMedia;
        $qrisReady = $qris !== null && $qris->lifecycle === 'ready' && str_starts_with(strtolower($qris->mime_type), 'image/');

        return [
            'campaignId' => $snapshot->campaign_id,
            'id' => $participant?->id,
            'editionId' => $participant?->edition_id,
            'name' => $participant?->name,
            'number' => $participant?->number,
            'categoryCode' => $category?->code?->value ?? (string) $category?->code,
            'categoryLabel' => $category?->label,
            'qrisMediaId' => $participant?->qris_media_id,
            'qrisUrl' => $qrisReady ? $qris->url : null,
            'qrisMimeType' => $qris?->mime_type,
            'qrisLifecycle' => $qris?->lifecycle,
            'qrisReady' => $qrisReady,
        ];
    }

    private function presentTally(VoteDailyTally $tally): array
    {
        return [
            'id' => $tally->id,
            'campaignId' => $tally->campaign_id,
            'participantId' => $tally->participant_id,
            'localDate' => $tally->local_date,
            'amount' => (int) $tally->amount,
            'version' => (int) $tally->version,
            'updatedAt' => $tally->updated_at?->toIso8601String(),
        ];
    }

    private function campaignSnapshot(VotingCampaign $campaign): array
    {
        return [
            'id' => $campaign->id,
            'edition_id' => $campaign->edition_id,
            'eligibility_stage_id' => $campaign->eligibility_stage_id,
            'name' => $campaign->name,
            'slug' => $campaign->slug,
            'status' => $campaign->status,
            'price_per_point' => (int) $campaign->price_per_point,
            'result_visibility' => $campaign->result_visibility,
            'starts_at' => $campaign->starts_at?->toIso8601String(),
            'ends_at' => $campaign->ends_at?->toIso8601String(),
            'started_at' => $campaign->started_at?->toIso8601String(),
            'closed_at' => $campaign->closed_at?->toIso8601String(),
            'version' => (int) $campaign->version,
        ];
    }

    private function tallySnapshot(VoteDailyTally $tally): array
    {
        return [
            'id' => $tally->id,
            'campaign_id' => $tally->campaign_id,
            'participant_id' => $tally->participant_id,
            'local_date' => $tally->local_date,
            'amount' => (int) $tally->amount,
            'version' => (int) $tally->version,
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
        ?string $reason,
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
            'source' => 'laravel-admin-voting',
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

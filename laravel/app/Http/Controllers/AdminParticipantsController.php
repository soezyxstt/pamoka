<?php

namespace App\Http\Controllers;

use App\Enums\ParticipantMediaRole;
use App\Enums\PermissionKey;
use App\Enums\SocialPlatform;
use App\Enums\StageDecision;
use App\Models\AuditLog;
use App\Models\Category;
use App\Models\Edition;
use App\Models\MediaAsset;
use App\Models\Participant;
use App\Models\ParticipantAchievement;
use App\Models\ParticipantMedia;
use App\Models\ParticipantSocialLink;
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

class AdminParticipantsController extends Controller
{
    public function index(
        Request $request,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): Response {
        $this->ensurePermission($request, $authorization, PermissionKey::ContentView);
        $edition = $this->resolveEdition($request, $editionContext);

        $participants = $edition === null
            ? []
            : Participant::query()
                ->where('edition_id', $edition->id)
                ->with(['category', 'currentStage', 'media.mediaAsset'])
                ->withCount(['achievements', 'socialLinks', 'media', 'titles'])
                ->orderBy('display_order')
                ->orderBy('number')
                ->orderBy('id')
                ->get()
                ->map(fn (Participant $participant): array => $this->presentListItem($participant))
                ->values()
                ->all();

        return Inertia::render('Admin/Participants/Index', [
            'user' => $this->presentUser($request),
            'editionName' => $edition?->name ?? 'Edisi aktif',
            'categories' => $edition === null ? [] : $edition->categories()
                ->orderBy('display_order')
                ->orderBy('id')
                ->get()
                ->map(fn (Category $category): array => [
                    'id' => $category->id,
                    'code' => $category->code->value,
                    'label' => $category->label,
                ])
                ->values()
                ->all(),
            'stages' => $edition === null ? [] : $edition->selectionStages()
                ->orderBy('display_order')
                ->orderBy('id')
                ->get()
                ->map(fn (SelectionStage $stage): array => [
                    'id' => $stage->id,
                    'name' => $stage->name,
                ])
                ->values()
                ->all(),
            'participants' => $participants,
            'canEdit' => $this->hasPermission($request, $authorization, PermissionKey::ParticipantsManage),
        ]);
    }

    public function create(
        Request $request,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): Response {
        $this->ensurePermission($request, $authorization, PermissionKey::ParticipantsManage);
        $edition = $this->resolveEdition($request, $editionContext);
        abort_if($edition === null, 404);

        return Inertia::render('Admin/Participants/Form', $this->formProps($request, $authorization, $edition, null));
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

        $participant = $this->findParticipant($id, $edition);

        return Inertia::render('Admin/Participants/Form', $this->formProps($request, $authorization, $edition, $participant));
    }

    public function store(
        Request $request,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::ParticipantsManage);
        $edition = $this->resolveEdition($request, $editionContext);
        abort_if($edition === null, 422, 'Konteks edisi aktif tidak ditemukan.');
        $payload = $this->validatedIdentity($request, $edition);
        /** @var User $actor */
        $actor = $request->user();

        $participant = DB::transaction(function () use ($actor, $edition, $payload): Participant {
            $category = Category::query()
                ->where('edition_id', $edition->id)
                ->whereKey($payload['category_id'])
                ->where('active', true)
                ->first();
            if ($category === null) {
                throw ValidationException::withMessages([
                    'category_id' => 'Kategori harus berasal dari edisi aktif.',
                ]);
            }

            $firstStage = SelectionStage::query()
                ->where('edition_id', $edition->id)
                ->orderBy('display_order')
                ->orderBy('id')
                ->first();
            if ($firstStage === null) {
                throw ValidationException::withMessages([
                    'stage' => 'Buat tahap seleksi pertama sebelum menambahkan pendaftar.',
                ]);
            }
            if ($firstStage->lifecycle === 'closed') {
                throw ValidationException::withMessages([
                    'stage' => 'Tahap seleksi pertama sudah ditutup.',
                ]);
            }

            $this->assertIdentityAvailable($edition, $category, $payload['number'], $payload['slug']);

            $participant = Participant::create([
                'edition_id' => $edition->id,
                'category_id' => $category->id,
                'stage' => $firstStage->slug,
                'current_stage_id' => $firstStage->id,
                'selection_status' => 'registered',
                'number' => $payload['number'],
                'name' => $payload['name'],
                'slug' => $payload['slug'],
                'bio' => $payload['bio'],
                'display_order' => $payload['display_order'],
                'active' => true,
                'version' => 1,
            ]);

            ParticipantStageEntry::create([
                'participant_id' => $participant->id,
                'stage_id' => $firstStage->id,
                'decision' => 'pending',
                'version' => 1,
            ]);

            $this->recordAudit($actor, 'participant.create', null, $participant, [
                'edition_id',
                'category_id',
                'stage',
                'current_stage_id',
                'selection_status',
                'number',
                'name',
                'slug',
                'bio',
                'display_order',
                'active',
                'version',
            ]);

            return $participant;
        });

        return to_route('admin.participants.edit', ['id' => $participant->id])
            ->with('status', 'Pendaftar berhasil ditambahkan.');
    }

    public function update(
        Request $request,
        string $id,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::ParticipantsManage);
        $edition = $this->resolveEdition($request, $editionContext);
        abort_if($edition === null, 422, 'Konteks edisi aktif tidak ditemukan.');
        $payload = $this->validatedIdentity($request, $edition, $id);
        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($actor, $edition, $id, $payload): void {
            $participant = $this->lockedParticipant($id, $edition);
            $this->assertVersion($participant, (int) $payload['version']);
            $category = Category::query()
                ->where('edition_id', $edition->id)
                ->whereKey($payload['category_id'])
                ->first();
            if ($category === null) {
                throw ValidationException::withMessages([
                    'category_id' => 'Kategori harus berasal dari edisi yang sama.',
                ]);
            }

            $this->assertIdentityAvailable($edition, $category, $payload['number'], $payload['slug'], $participant->id);
            $before = $this->snapshot($participant);
            $participant->forceFill([
                'category_id' => $category->id,
                'number' => $payload['number'],
                'name' => $payload['name'],
                'slug' => $payload['slug'],
                'bio' => $payload['bio'],
                'display_order' => $payload['display_order'],
                'active' => $payload['active'] === null ? (bool) $participant->active : (bool) $payload['active'],
                'version' => (int) $participant->version + 1,
            ])->save();
            $this->recordAudit($actor, 'participant.update', $before, $participant, [
                'category_id',
                'number',
                'name',
                'slug',
                'bio',
                'display_order',
                'active',
                'version',
            ], $payload['reason']);
        });

        return to_route('admin.participants.edit', ['id' => $id])
            ->with('status', 'Identitas peserta disimpan.');
    }

    public function updateProfile(
        Request $request,
        string $id,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::ParticipantsManage);
        $edition = $this->resolveEdition($request, $editionContext);
        abort_if($edition === null, 422, 'Konteks edisi aktif tidak ditemukan.');

        $roleValues = array_map(static fn (ParticipantMediaRole $role): string => $role->value, ParticipantMediaRole::cases());
        $platformValues = array_map(static fn (SocialPlatform $platform): string => $platform->value, SocialPlatform::cases());
        $validated = $request->validate([
            'version' => ['required', 'integer', 'min:1'],
            'reason' => ['nullable', 'string', 'max:2000'],
            'payment_url' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'qris_media_id' => ['sometimes', 'nullable', 'uuid'],
            'achievements' => ['sometimes', 'array', 'max:100'],
            'achievements.*.text' => ['required', 'string', 'max:2000'],
            'achievements.*.display_order' => ['nullable', 'integer', 'min:0', 'max:2147483647'],
            'social_links' => ['sometimes', 'array', 'max:30'],
            'social_links.*.platform' => ['required', Rule::in($platformValues)],
            'social_links.*.label' => ['nullable', 'string', 'max:255'],
            'social_links.*.url' => ['required', 'string', 'max:2000'],
            'social_links.*.display_order' => ['nullable', 'integer', 'min:0', 'max:2147483647'],
            'media' => ['sometimes', 'array', 'max:100'],
            'media.*.role' => ['required', Rule::in($roleValues)],
            'media.*.media_asset_id' => ['required', 'uuid'],
            'media.*.caption' => ['nullable', 'string', 'max:2000'],
            'media.*.display_order' => ['nullable', 'integer', 'min:0', 'max:2147483647'],
            'media.*.active' => ['nullable', 'boolean'],
        ]);

        if ($request->exists('media')) {
            $this->ensurePermission($request, $authorization, PermissionKey::MediaManage);
        }

        $achievements = array_map(
            static fn (array $item, int $index): array => [
                'text' => trim((string) $item['text']),
                'display_order' => (int) ($item['display_order'] ?? $index),
            ],
            $validated['achievements'] ?? [],
            array_keys($validated['achievements'] ?? []),
        );
        $achievements = array_values(array_filter($achievements, static fn (array $item): bool => $item['text'] !== ''));

        $socialLinks = array_map(
            static fn (array $item, int $index): array => [
                'platform' => (string) $item['platform'],
                'label' => trim((string) ($item['label'] ?? '')) ?: null,
                'url' => trim((string) $item['url']),
                'display_order' => (int) ($item['display_order'] ?? $index),
            ],
            $validated['social_links'] ?? [],
            array_keys($validated['social_links'] ?? []),
        );

        foreach ($socialLinks as $index => $link) {
            if (! $this->isHttpUrl($link['url'])) {
                throw ValidationException::withMessages([
                    "social_links.{$index}.url" => 'Tautan sosial harus menggunakan URL http atau https.',
                ]);
            }
            if ($link['platform'] === SocialPlatform::Other->value && $link['label'] === null) {
                throw ValidationException::withMessages([
                    "social_links.{$index}.label" => 'Label wajib diisi untuk platform lainnya.',
                ]);
            }
        }

        $media = array_map(
            static fn (array $item, int $index): array => [
                'role' => (string) $item['role'],
                'media_asset_id' => (string) $item['media_asset_id'],
                'caption' => trim((string) ($item['caption'] ?? '')) ?: null,
                'display_order' => (int) ($item['display_order'] ?? $index),
                'active' => array_key_exists('active', $item) ? (bool) $item['active'] : true,
            ],
            $validated['media'] ?? [],
            array_keys($validated['media'] ?? []),
        );

        if (count(array_filter($media, static fn (array $item): bool => $item['role'] === ParticipantMediaRole::Closeup->value && $item['active'])) > 1) {
            throw ValidationException::withMessages([
                'media' => 'Hanya satu foto closeup yang boleh aktif sebagai foto utama.',
            ]);
        }

        $qrisMediaId = array_key_exists('qris_media_id', $validated)
            ? ($validated['qris_media_id'] ?: null)
            : null;
        $paymentUrl = array_key_exists('payment_url', $validated)
            ? (trim((string) $validated['payment_url']) ?: null)
            : null;
        if (array_key_exists('payment_url', $validated) && $paymentUrl !== null && ! $this->isHttpUrl($paymentUrl)) {
            throw ValidationException::withMessages([
                'payment_url' => 'URL pembayaran harus menggunakan URL http atau https.',
            ]);
        }

        /** @var User $actor */
        $actor = $request->user();
        DB::transaction(function () use ($actor, $edition, $id, $validated, $achievements, $socialLinks, $media, $qrisMediaId, $paymentUrl): void {
            $participant = $this->lockedParticipant($id, $edition);
            $this->assertVersion($participant, (int) $validated['version']);
            $participant->load(['achievements', 'socialLinks', 'media', 'qrisMedia']);

            if (array_key_exists('qris_media_id', $validated) && $qrisMediaId !== null && $this->readyImage($qrisMediaId) === null) {
                throw ValidationException::withMessages([
                    'qris_media_id' => 'QRIS harus berupa aset gambar yang berstatus siap.',
                ]);
            }

            if (array_key_exists('media', $validated)) {
                foreach ($media as $item) {
                    if ($this->readyImage($item['media_asset_id']) === null) {
                        throw ValidationException::withMessages([
                            'media' => 'Semua foto peserta harus berupa aset gambar yang berstatus siap.',
                        ]);
                    }
                }
            }

            $before = [
                ...$this->snapshot($participant),
                'achievements' => $participant->achievements->map(fn (ParticipantAchievement $item): array => [
                    'text' => $item->text,
                    'display_order' => (int) $item->display_order,
                ])->values()->all(),
                'social_links' => $participant->socialLinks->map(fn (ParticipantSocialLink $item): array => [
                    'platform' => $item->platform->value,
                    'label' => $item->label,
                    'url' => $item->url,
                    'display_order' => (int) $item->display_order,
                ])->values()->all(),
                'media' => $participant->media->map(fn (ParticipantMedia $item): array => [
                    'role' => $item->role->value,
                    'media_asset_id' => $item->media_asset_id,
                    'caption' => $item->caption,
                    'display_order' => (int) $item->display_order,
                    'active' => (bool) $item->active,
                ])->values()->all(),
            ];

            if (array_key_exists('achievements', $validated)) {
                $participant->achievements()->delete();
                foreach ($achievements as $item) {
                    ParticipantAchievement::create([
                        'participant_id' => $participant->id,
                        ...$item,
                    ]);
                }
            }

            if (array_key_exists('social_links', $validated)) {
                $participant->socialLinks()->delete();
                foreach ($socialLinks as $item) {
                    ParticipantSocialLink::create([
                        'participant_id' => $participant->id,
                        ...$item,
                    ]);
                }
            }

            if (array_key_exists('media', $validated)) {
                $participant->media()->delete();
                foreach ($media as $item) {
                    ParticipantMedia::create([
                        'participant_id' => $participant->id,
                        ...$item,
                    ]);
                }
            }

            $changes = [];
            $attributes = [];
            if (array_key_exists('payment_url', $validated)) {
                $attributes['payment_url'] = $paymentUrl;
                $changes[] = 'payment_url';
            }
            if (array_key_exists('qris_media_id', $validated)) {
                $attributes['qris_media_id'] = $qrisMediaId;
                $changes[] = 'qris_media_id';
            }
            if (array_key_exists('achievements', $validated)) {
                $changes[] = 'achievements';
            }
            if (array_key_exists('social_links', $validated)) {
                $changes[] = 'social_links';
            }
            if (array_key_exists('media', $validated)) {
                $changes[] = 'media';
            }

            $attributes['version'] = (int) $participant->version + 1;
            $participant->forceFill($attributes)->save();

            $after = [
                ...$this->snapshot($participant),
                'achievements' => array_key_exists('achievements', $validated) ? $achievements : $before['achievements'],
                'social_links' => array_key_exists('social_links', $validated) ? $socialLinks : $before['social_links'],
                'media' => array_key_exists('media', $validated) ? $media : $before['media'],
            ];
            $this->recordAudit($actor, 'participant.profile.update', $before, $participant, [...$changes, 'version'], $validated['reason'] ?? null, $before, $after);
        });

        return to_route('admin.participants.edit', ['id' => $id])
            ->with('status', 'Profil peserta disimpan.');
    }

    public function toggle(
        Request $request,
        string $id,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::ParticipantsManage);
        $edition = $this->resolveEdition($request, $editionContext);
        abort_if($edition === null, 422, 'Konteks edisi aktif tidak ditemukan.');
        $version = $request->validate(['version' => ['required', 'integer', 'min:1']])['version'];
        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($actor, $edition, $id, $version): void {
            $participant = $this->lockedParticipant($id, $edition);
            $this->assertVersion($participant, (int) $version);
            $before = $this->snapshot($participant);
            $participant->forceFill([
                'active' => ! $participant->active,
                'version' => (int) $participant->version + 1,
            ])->save();
            $this->recordAudit($actor, 'participant.active.toggle', $before, $participant, ['active', 'version']);
        });

        return to_route('admin.participants.index')->with('status', 'Status peserta diperbarui.');
    }

    public function destroy(
        Request $request,
        string $id,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::ParticipantsManage);
        $edition = $this->resolveEdition($request, $editionContext);
        abort_if($edition === null, 422, 'Konteks edisi aktif tidak ditemukan.');
        $version = $request->validate(['version' => ['required', 'integer', 'min:1']])['version'];
        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($actor, $edition, $id, $version): void {
            $participant = $this->lockedParticipant($id, $edition);
            $this->assertVersion($participant, (int) $version);
            $entries = ParticipantStageEntry::query()->where('participant_id', $participant->id)->get();
            $unusedApplicant = $entries->count() === 1
                && $entries->first()->decision === StageDecision::Pending
                && $entries->first()->stage_id === $participant->current_stage_id;
            $hasTitle = DB::table('participant_title_assignments')->where('participant_id', $participant->id)->exists();
            $hasSnapshot = DB::table('voting_campaign_participants')->where('participant_id', $participant->id)->exists();
            $hasTally = DB::table('vote_daily_tallies')->where('participant_id', $participant->id)->exists();
            if (! $unusedApplicant || $hasTitle || $hasSnapshot || $hasTally) {
                throw ValidationException::withMessages([
                    'participant' => 'Peserta yang sudah diproses tidak dapat dihapus. Nonaktifkan peserta atau lakukan rollback.',
                ]);
            }

            $before = $this->snapshot($participant);
            $participant->achievements()->delete();
            $participant->socialLinks()->delete();
            $participant->media()->delete();
            $participant->stageEntries()->delete();
            $participant->delete();
            $this->recordAudit($actor, 'participant.delete', $before, null, ['deleted']);
        });

        return to_route('admin.participants.index')->with('status', 'Pendaftar dihapus.');
    }

    private function formProps(
        Request $request,
        AuthorizationService $authorization,
        Edition $edition,
        ?Participant $participant,
    ): array {
        $categories = Category::query()
            ->where('edition_id', $edition->id)
            ->when($participant === null, fn ($query) => $query->where('active', true))
            ->when($participant !== null, fn ($query) => $query->where(function ($nested) use ($participant): void {
                $nested->where('active', true)->orWhereKey($participant->category_id);
            }))
            ->orderBy('display_order')
            ->orderBy('id')
            ->get();
        $stages = SelectionStage::query()
            ->where('edition_id', $edition->id)
            ->orderBy('display_order')
            ->orderBy('id')
            ->get();
        $firstStage = $stages->first();

        $selectedMediaIds = $participant === null
            ? []
            : $participant->media->pluck('media_asset_id')
                ->push($participant->qris_media_id)
                ->filter()
                ->values()
                ->all();
        $media = MediaAsset::query()
            ->where('lifecycle', 'ready')
            ->where('mime_type', 'like', 'image/%')
            ->orderByDesc('created_at')
            ->limit(100)
            ->get();
        if ($selectedMediaIds !== []) {
            $selected = MediaAsset::query()->whereIn('id', $selectedMediaIds)->get();
            $media = $selected->merge($media->whereNotIn('id', $selectedMediaIds))->values();
        }

        return [
            'user' => $this->presentUser($request),
            'edition' => [
                'id' => $edition->id,
                'year' => (int) $edition->year,
                'name' => $edition->name,
                'lifecycle' => $edition->lifecycle,
            ],
            'categories' => $categories->map(fn (Category $category): array => [
                'id' => $category->id,
                'code' => $category->code->value,
                'label' => $category->label,
                'active' => (bool) $category->active,
            ])->values()->all(),
            'stages' => $stages->map(fn (SelectionStage $stage): array => [
                'id' => $stage->id,
                'name' => $stage->name,
                'slug' => $stage->slug,
                'lifecycle' => $stage->lifecycle,
                'finalStage' => (bool) $stage->final_stage,
            ])->values()->all(),
            'firstStage' => $firstStage === null ? null : [
                'id' => $firstStage->id,
                'name' => $firstStage->name,
                'lifecycle' => $firstStage->lifecycle,
            ],
            'participant' => $participant === null ? null : $this->presentDetail($participant),
            'mediaOptions' => $media->map(fn (MediaAsset $asset): array => $this->presentAsset($asset))->values()->all(),
            'canEdit' => $this->hasPermission($request, $authorization, PermissionKey::ParticipantsManage),
            'canManageMedia' => $this->hasPermission($request, $authorization, PermissionKey::MediaManage),
        ];
    }

    private function validatedIdentity(Request $request, Edition $edition, ?string $id = null): array
    {
        $validated = $request->validate([
            'category_id' => ['required', 'uuid'],
            'number' => ['required', 'integer', 'min:1', 'max:2147483647'],
            'name' => ['required', 'string', 'min:2', 'max:255'],
            'slug' => ['nullable', 'string', 'max:255', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/'],
            'bio' => ['nullable', 'string', 'max:10000'],
            'display_order' => ['nullable', 'integer', 'min:0', 'max:2147483647'],
            'active' => ['nullable', 'boolean'],
            'version' => $id === null ? ['nullable', 'integer', 'min:1'] : ['required', 'integer', 'min:1'],
            'reason' => ['nullable', 'string', 'max:2000'],
        ]);

        $name = trim($validated['name']);
        $slug = Str::slug(trim((string) ($validated['slug'] ?? '')) ?: $name);
        if ($slug === '') {
            throw ValidationException::withMessages(['slug' => 'Slug peserta tidak boleh kosong.']);
        }

        return [
            'category_id' => $validated['category_id'],
            'number' => (int) $validated['number'],
            'name' => $name,
            'slug' => $slug,
            'bio' => filled($validated['bio'] ?? null) ? trim($validated['bio']) : null,
            'display_order' => (int) ($validated['display_order'] ?? $validated['number']),
            'active' => array_key_exists('active', $validated) ? $validated['active'] : null,
            'version' => $validated['version'] ?? null,
            'reason' => $validated['reason'] ?? null,
        ];
    }

    private function assertIdentityAvailable(
        Edition $edition,
        Category $category,
        int $number,
        string $slug,
        ?string $ignoreId = null,
    ): void {
        $query = Participant::query()->where('edition_id', $edition->id);
        if ($ignoreId !== null) {
            $query->where('id', '!=', $ignoreId);
        }
        if ((clone $query)->where('slug', $slug)->exists()) {
            throw ValidationException::withMessages(['slug' => 'Slug peserta sudah digunakan pada edisi ini.']);
        }
        if (Participant::query()
            ->where('edition_id', $edition->id)
            ->where('category_id', $category->id)
            ->where('number', $number)
            ->when($ignoreId !== null, fn ($builder) => $builder->where('id', '!=', $ignoreId))
            ->exists()) {
            throw ValidationException::withMessages(['number' => 'Nomor peserta sudah digunakan pada kategori ini.']);
        }
    }

    private function findParticipant(string $id, Edition $edition): Participant
    {
        return Participant::query()
            ->where('edition_id', $edition->id)
            ->whereKey($id)
            ->with(['category', 'currentStage', 'achievements', 'socialLinks', 'media.mediaAsset', 'qrisMedia', 'titles'])
            ->firstOrFail();
    }

    private function lockedParticipant(string $id, Edition $edition): Participant
    {
        return Participant::query()
            ->where('edition_id', $edition->id)
            ->whereKey($id)
            ->lockForUpdate()
            ->firstOrFail();
    }

    private function assertVersion(Participant $participant, int $version): void
    {
        if ((int) $participant->version !== $version) {
            throw ValidationException::withMessages([
                'version' => 'Versi data peserta telah berubah. Silakan muat ulang halaman.',
            ]);
        }
    }

    private function readyImage(string $id): ?MediaAsset
    {
        return MediaAsset::query()
            ->whereKey($id)
            ->where('lifecycle', 'ready')
            ->where('mime_type', 'like', 'image/%')
            ->first();
    }

    private function isHttpUrl(string $value): bool
    {
        $scheme = strtolower((string) parse_url($value, PHP_URL_SCHEME));

        return in_array($scheme, ['http', 'https'], true) && filter_var($value, FILTER_VALIDATE_URL) !== false;
    }

    private function snapshot(Participant $participant): array
    {
        return [
            'id' => $participant->id,
            'edition_id' => $participant->edition_id,
            'category_id' => $participant->category_id,
            'stage' => $participant->stage,
            'current_stage_id' => $participant->current_stage_id,
            'selection_status' => $participant->selection_status,
            'number' => (int) $participant->number,
            'name' => $participant->name,
            'slug' => $participant->slug,
            'bio' => $participant->bio,
            'payment_url' => $participant->payment_url,
            'qris_media_id' => $participant->qris_media_id,
            'display_order' => (int) $participant->display_order,
            'active' => (bool) $participant->active,
            'version' => (int) $participant->version,
        ];
    }

    private function presentListItem(Participant $participant): array
    {
        $portrait = $participant->media->first(function (ParticipantMedia $item): bool {
            return $item->active && $item->role === ParticipantMediaRole::Closeup && $item->mediaAsset !== null;
        }) ?? $participant->media->first(fn (ParticipantMedia $item): bool => $item->active && $item->mediaAsset !== null);

        return [
            'id' => $participant->id,
            'categoryId' => $participant->category_id,
            'categoryCode' => $participant->category?->code->value ?? '',
            'categoryLabel' => $participant->category?->label ?? '',
            'number' => (int) $participant->number,
            'name' => $participant->name,
            'currentStageId' => $participant->current_stage_id,
            'currentStageName' => $participant->currentStage?->name,
            'selectionStatus' => $participant->selection_status,
            'portraitUrl' => $portrait?->mediaAsset?->url,
            'portraitAlt' => $portrait?->mediaAsset?->alt,
            'qrisMediaId' => $participant->qris_media_id,
            'active' => (bool) $participant->active,
            'version' => (int) $participant->version,
            'achievementsCount' => (int) $participant->achievements_count,
            'socialLinksCount' => (int) $participant->social_links_count,
            'mediaCount' => (int) $participant->media_count,
            'titleCount' => (int) $participant->titles_count,
            'hasCloseup' => $participant->media->contains(fn (ParticipantMedia $item): bool => $item->role === ParticipantMediaRole::Closeup),
        ];
    }

    private function presentDetail(Participant $participant): array
    {
        return [
            'id' => $participant->id,
            'editionId' => $participant->edition_id,
            'categoryId' => $participant->category_id,
            'categoryCode' => $participant->category?->code->value ?? '',
            'categoryLabel' => $participant->category?->label ?? '',
            'number' => (int) $participant->number,
            'name' => $participant->name,
            'slug' => $participant->slug,
            'currentStageId' => $participant->current_stage_id,
            'currentStageName' => $participant->currentStage?->name,
            'selectionStatus' => $participant->selection_status,
            'bio' => $participant->bio,
            'paymentUrl' => $participant->payment_url,
            'qrisMediaId' => $participant->qris_media_id,
            'qrisAsset' => $participant->qrisMedia === null ? null : $this->presentAsset($participant->qrisMedia),
            'displayOrder' => (int) $participant->display_order,
            'active' => (bool) $participant->active,
            'version' => (int) $participant->version,
            'achievements' => $participant->achievements->map(fn (ParticipantAchievement $item): array => [
                'id' => $item->id,
                'text' => $item->text,
                'displayOrder' => (int) $item->display_order,
            ])->values()->all(),
            'socialLinks' => $participant->socialLinks->map(fn (ParticipantSocialLink $item): array => [
                'id' => $item->id,
                'platform' => $item->platform->value,
                'label' => $item->label,
                'url' => $item->url,
                'displayOrder' => (int) $item->display_order,
            ])->values()->all(),
            'media' => $participant->media->map(fn (ParticipantMedia $item): array => [
                'id' => $item->id,
                'role' => $item->role->value,
                'mediaId' => $item->media_asset_id,
                'caption' => $item->caption,
                'displayOrder' => (int) $item->display_order,
                'active' => (bool) $item->active,
                'asset' => $item->mediaAsset === null ? null : $this->presentAsset($item->mediaAsset),
            ])->values()->all(),
            'titles' => $participant->titles
                ->filter(fn ($title): bool => $title->edition_id === $participant->edition_id)
                ->map(fn ($title): array => [
                    'id' => $title->id,
                    'name' => $title->name,
                ])->values()->all(),
        ];
    }

    private function presentAsset(MediaAsset $asset): array
    {
        return [
            'id' => $asset->id,
            'url' => $asset->url,
            'filename' => $asset->filename,
            'mimeType' => $asset->mime_type,
            'bytes' => (int) $asset->bytes,
            'alt' => $asset->alt,
            'decorative' => (bool) $asset->decorative,
            'lifecycle' => $asset->lifecycle,
        ];
    }

    private function recordAudit(
        User $actor,
        string $action,
        ?array $before,
        ?Participant $participant,
        array $changedFields,
        ?string $reason = null,
        ?array $auditBefore = null,
        ?array $auditAfter = null,
    ): void {
        AuditLog::create([
            'actor_user_id' => $actor->id,
            'actor_label' => $actor->email,
            'action' => $action,
            'resource_type' => 'participant',
            'resource_id' => $participant?->id ?? ($before['id'] ?? null),
            'resource_label' => $participant?->name ?? ($before['name'] ?? 'Peserta'),
            'before_json' => $auditBefore ?? $before,
            'after_json' => $auditAfter ?? ($participant === null ? null : $this->snapshot($participant)),
            'changed_fields_json' => $changedFields,
            'source' => 'laravel-admin-participants',
            'reason' => $reason,
            'created_at' => now(),
        ]);
    }

    private function resolveEdition(Request $request, ActiveEditionContext $editionContext): ?Edition
    {
        $resolved = $editionContext->resolve($request->cookie(ActiveEditionContext::COOKIE_NAME));

        return $resolved === null ? null : Edition::query()->find($resolved['id']);
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

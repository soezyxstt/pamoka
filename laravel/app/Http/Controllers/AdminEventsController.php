<?php

namespace App\Http\Controllers;

use App\Enums\PermissionKey;
use App\Models\AuditLog;
use App\Models\Edition;
use App\Models\Event;
use App\Models\Gallery;
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

class AdminEventsController extends Controller
{
    public function index(
        Request $request,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): Response {
        $this->ensurePermission($request, $authorization, PermissionKey::ContentView);
        $edition = $this->resolveEdition($request, $editionContext);
        $events = $edition === null
            ? []
            : Event::query()
                ->with('heroMedia')
                ->where('edition_id', $edition->id)
                ->orderBy('display_order')
                ->orderBy('created_at')
                ->get()
                ->map(fn (Event $event): array => $this->presentEvent($event))
                ->values()
                ->all();

        return Inertia::render('Admin/Events/Index', [
            'user' => $this->presentUser($request),
            'editionName' => $edition?->name ?? 'Edisi aktif',
            'events' => $events,
            'canEdit' => $this->hasPermission($request, $authorization, PermissionKey::EventsManage),
        ]);
    }

    public function create(
        Request $request,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): Response {
        $this->ensurePermission($request, $authorization, PermissionKey::EventsManage);
        $edition = $this->resolveEdition($request, $editionContext);
        abort_if($edition === null, 404);

        return Inertia::render('Admin/Events/Form', $this->formProps($request, $authorization, $edition, null));
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
        $event = $this->findEvent($id, $edition);

        return Inertia::render('Admin/Events/Form', $this->formProps($request, $authorization, $edition, $event));
    }

    public function store(
        Request $request,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::EventsManage);
        $edition = $this->resolveEdition($request, $editionContext);
        abort_if($edition === null, 422, 'Konteks edisi aktif tidak ditemukan.');
        $payload = $this->validatedPayload($request, $edition);
        /** @var User $actor */
        $actor = $request->user();

        $event = DB::transaction(function () use ($actor, $edition, $payload): Event {
            $event = Event::create([
                'edition_id' => $edition->id,
                'slug' => $payload['slug'],
                'label' => $payload['label'],
                'description' => $payload['description'],
                'hero_media_id' => $payload['hero_media_id'],
                'display_order' => $payload['display_order'],
                'active' => true,
                'version' => 1,
            ]);
            $this->recordAudit($actor, 'event.create', null, $event, [
                'edition_id',
                'slug',
                'label',
                'description',
                'hero_media_id',
                'display_order',
                'active',
                'version',
            ]);

            return $event;
        });

        return to_route('admin.events.edit', ['id' => $event->id])->with('status', 'Acara disimpan.');
    }

    public function update(
        Request $request,
        string $id,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::EventsManage);
        $edition = $this->resolveEdition($request, $editionContext);
        abort_if($edition === null, 422, 'Konteks edisi aktif tidak ditemukan.');
        $payload = $this->validatedPayload($request, $edition, $id);
        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($actor, $edition, $id, $payload): void {
            $event = $this->lockedEvent($id, $edition);
            $this->assertVersion($event, (int) $payload['version']);
            $before = $this->snapshot($event);
            $event->forceFill([
                'slug' => $payload['slug'],
                'label' => $payload['label'],
                'description' => $payload['description'],
                'hero_media_id' => $payload['hero_media_id'],
                'display_order' => $payload['display_order'],
                'active' => $payload['active'] === null ? (bool) $event->active : (bool) $payload['active'],
                'version' => (int) $event->version + 1,
            ])->save();
            $this->recordAudit($actor, 'event.update', $before, $event, [
                'slug',
                'label',
                'description',
                'hero_media_id',
                'display_order',
                'active',
                'version',
            ]);
        });

        return to_route('admin.events.edit', ['id' => $id])->with('status', 'Perubahan acara disimpan.');
    }

    public function destroy(
        Request $request,
        string $id,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::EventsManage);
        $edition = $this->resolveEdition($request, $editionContext);
        abort_if($edition === null, 422, 'Konteks edisi aktif tidak ditemukan.');
        $version = $request->validate(['version' => ['required', 'integer', 'min:1']])['version'];
        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($actor, $edition, $id, $version): void {
            $event = $this->lockedEvent($id, $edition);
            $this->assertVersion($event, (int) $version);
            if (Gallery::query()->where('edition_id', $edition->id)->where('owner_type', 'event')->where('owner_id', $event->id)->exists()) {
                throw ValidationException::withMessages([
                    'event' => 'Acara yang memiliki album galeri tidak dapat dihapus.',
                ]);
            }
            $before = $this->snapshot($event);
            $event->delete();
            $this->recordAudit($actor, 'event.delete', $before, null, ['deleted']);
        });

        return to_route('admin.events.index')->with('status', 'Acara dihapus.');
    }

    public function reorder(
        Request $request,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::EventsManage);
        $edition = $this->resolveEdition($request, $editionContext);
        abort_if($edition === null, 422, 'Konteks edisi aktif tidak ditemukan.');
        $validated = $request->validate([
            'items' => ['required', 'array'],
            'items.*.id' => ['required', 'uuid'],
            'items.*.version' => ['required', 'integer', 'min:1'],
        ]);
        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($actor, $edition, $validated): void {
            $events = Event::query()->where('edition_id', $edition->id)->orderBy('display_order')->orderBy('id')->lockForUpdate()->get();
            $items = collect($validated['items']);
            $ids = $items->pluck('id')->all();
            if (count($ids) !== $events->count() || count(array_unique($ids)) !== count($ids) || $events->pluck('id')->diff($ids)->isNotEmpty()) {
                throw ValidationException::withMessages(['items' => 'Daftar acara telah berubah. Muat ulang halaman.']);
            }
            foreach ($items as $index => $item) {
                /** @var Event $event */
                $event = $events->firstWhere('id', $item['id']);
                $this->assertVersion($event, (int) $item['version']);
                $event->forceFill([
                    'display_order' => $index + 1,
                    'version' => (int) $event->version + 1,
                ])->save();
            }
            AuditLog::create([
                'actor_user_id' => $actor->id,
                'actor_label' => $actor->email,
                'action' => 'event.reorder',
                'resource_type' => 'event',
                'resource_id' => $edition->id,
                'resource_label' => 'Urutan acara',
                'before_json' => ['order' => $events->pluck('id')->all()],
                'after_json' => ['order' => $ids],
                'changed_fields_json' => ['display_order', 'version'],
                'source' => 'laravel-admin-events',
                'created_at' => now(),
            ]);
        });

        return to_route('admin.events.index')->with('status', 'Urutan acara diperbarui.');
    }

    private function formProps(
        Request $request,
        AuthorizationService $authorization,
        Edition $edition,
        ?Event $event,
    ): array {
        $media = MediaAsset::query()
            ->where('lifecycle', 'ready')
            ->where('mime_type', 'like', 'image/%')
            ->orderByDesc('created_at')
            ->limit(100)
            ->get();
        if ($event?->hero_media_id !== null && ! $media->contains('id', $event->hero_media_id)) {
            $selected = MediaAsset::query()->find($event->hero_media_id);
            if ($selected !== null) {
                $media->prepend($selected);
            }
        }

        return [
            'user' => $this->presentUser($request),
            'editionName' => $edition->name,
            'event' => $event === null ? null : $this->presentEvent($event),
            'heroMediaOptions' => $media->map(fn (MediaAsset $asset): array => [
                'id' => $asset->id,
                'url' => $asset->url,
                'filename' => $asset->filename,
                'alt' => $asset->alt,
            ])->values()->all(),
            'canEdit' => $this->hasPermission($request, $authorization, PermissionKey::EventsManage),
        ];
    }

    private function validatedPayload(Request $request, Edition $edition, ?string $id = null): array
    {
        $slugRule = Rule::unique('events', 'slug')->where(fn ($query) => $query->where('edition_id', $edition->id));
        if ($id !== null) {
            $slugRule = $slugRule->ignore($id);
        }
        $validated = $request->validate([
            'label' => ['required', 'string', 'min:2', 'max:255'],
            'slug' => ['required', 'string', 'max:255', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $slugRule],
            'description' => ['nullable', 'string', 'max:10000'],
            'hero_media_id' => ['nullable', 'uuid'],
            'display_order' => ['required', 'integer', 'min:0', 'max:2147483647'],
            'active' => ['nullable', 'boolean'],
            'version' => $id === null ? ['nullable', 'integer', 'min:1'] : ['required', 'integer', 'min:1'],
        ]);
        $heroId = $validated['hero_media_id'] ?? null;
        if ($heroId !== null && $this->readyImage((string) $heroId) === null) {
            throw ValidationException::withMessages(['hero_media_id' => 'Foto hero harus berupa gambar siap pakai.']);
        }

        return [
            'label' => trim($validated['label']),
            'slug' => strtolower(trim($validated['slug'])),
            'description' => filled($validated['description'] ?? null) ? trim($validated['description']) : null,
            'hero_media_id' => $heroId,
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

    private function findEvent(string $id, Edition $edition): Event
    {
        return Event::query()->with('heroMedia')->where('edition_id', $edition->id)->whereKey($id)->firstOrFail();
    }

    private function lockedEvent(string $id, Edition $edition): Event
    {
        return Event::query()->where('edition_id', $edition->id)->whereKey($id)->lockForUpdate()->firstOrFail();
    }

    private function readyImage(string $id): ?MediaAsset
    {
        return MediaAsset::query()->whereKey($id)->where('lifecycle', 'ready')->where('mime_type', 'like', 'image/%')->first();
    }

    private function assertVersion(Event $event, int $version): void
    {
        if ((int) $event->version !== $version) {
            throw ValidationException::withMessages(['version' => 'Versi acara telah berubah. Muat ulang halaman.']);
        }
    }

    private function snapshot(Event $event): array
    {
        return [
            'id' => $event->id,
            'edition_id' => $event->edition_id,
            'slug' => $event->slug,
            'label' => $event->label,
            'description' => $event->description,
            'hero_media_id' => $event->hero_media_id,
            'display_order' => (int) $event->display_order,
            'active' => (bool) $event->active,
            'version' => (int) $event->version,
        ];
    }

    private function presentEvent(Event $event): array
    {
        return [
            'id' => $event->id,
            'editionId' => $event->edition_id,
            'slug' => $event->slug,
            'label' => $event->label,
            'description' => $event->description,
            'heroMediaId' => $event->hero_media_id,
            'displayOrder' => (int) $event->display_order,
            'active' => (bool) $event->active,
            'version' => (int) $event->version,
            'createdAt' => $event->created_at?->toIso8601String(),
            'hero' => $event->heroMedia === null ? null : [
                'id' => $event->heroMedia->id,
                'url' => $event->heroMedia->url,
                'filename' => $event->heroMedia->filename,
                'alt' => $event->heroMedia->alt,
            ],
        ];
    }

    private function recordAudit(
        User $actor,
        string $action,
        ?array $before,
        ?Event $event,
        array $changedFields,
    ): void {
        AuditLog::create([
            'actor_user_id' => $actor->id,
            'actor_label' => $actor->email,
            'action' => $action,
            'resource_type' => 'event',
            'resource_id' => $event?->id ?? ($before['id'] ?? null),
            'resource_label' => $event?->label ?? ($before['label'] ?? 'Acara'),
            'before_json' => $before,
            'after_json' => $event === null ? null : $this->snapshot($event),
            'changed_fields_json' => $changedFields,
            'source' => 'laravel-admin-events',
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

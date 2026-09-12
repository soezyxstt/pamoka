<?php

namespace App\Http\Controllers;

use App\Enums\PermissionKey;
use App\Models\AuditLog;
use App\Models\ContentDraft;
use App\Models\ContentRevision;
use App\Models\Edition;
use App\Models\MediaAsset;
use App\Models\NewsArticle;
use App\Models\User;
use App\Services\ActiveEditionContext;
use App\Services\AuthorizationService;
use App\Services\TipTapDocumentSanitizer;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use InvalidArgumentException;

class AdminNewsController extends Controller
{
    public function __construct(private readonly TipTapDocumentSanitizer $tiptap) {}

    public function index(
        Request $request,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): Response {
        $this->ensurePermission($request, $authorization, PermissionKey::ContentView);
        $edition = $this->resolveEdition($request, $editionContext);

        $articles = $edition === null
            ? []
            : NewsArticle::query()
                ->with('coverMedia')
                ->where('edition_id', $edition->id)
                ->orderByDesc('created_at')
                ->get()
                ->map(fn (NewsArticle $article): array => $this->presentListItem($article))
                ->values()
                ->all();

        return Inertia::render('Admin/News/Index', [
            'user' => $this->presentUser($request),
            'editionName' => $edition?->name ?? 'Edisi aktif',
            'articles' => $articles,
            'canEdit' => $this->hasPermission($request, $authorization, PermissionKey::NewsManage),
            'canPublish' => $this->hasPermission($request, $authorization, PermissionKey::ContentPublish),
        ]);
    }

    public function create(
        Request $request,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): Response|RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::NewsManage);
        $edition = $this->resolveEdition($request, $editionContext);

        if ($edition === null) {
            return to_route('admin.news.index')->with('status', 'Buat edisi terlebih dahulu sebelum menulis berita.');
        }

        return Inertia::render('Admin/News/Form', $this->formProps(
            $request,
            $authorization,
            $edition,
            null,
            [],
        ));
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

        $article = $this->findArticle($id, $edition);
        $revisions = ContentRevision::query()
            ->with('author')
            ->where('resource_type', 'newsArticle')
            ->where('resource_id', $article->id)
            ->orderByDesc('version')
            ->get()
            ->map(fn (ContentRevision $revision): array => [
                'id' => $revision->id,
                'version' => (int) $revision->version,
                'reason' => $revision->reason,
                'createdAt' => $revision->created_at?->toIso8601String(),
                'author' => $revision->author === null ? null : [
                    'name' => $revision->author->name,
                    'email' => $revision->author->email,
                ],
            ])
            ->values()
            ->all();

        return Inertia::render('Admin/News/Form', $this->formProps(
            $request,
            $authorization,
            $edition,
            $article,
            $revisions,
        ));
    }

    public function store(
        Request $request,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::NewsManage);
        $edition = $this->resolveEdition($request, $editionContext);
        abort_if($edition === null, 422, 'Konteks edisi aktif tidak ditemukan.');

        $payload = $this->validatedPayload($request);
        /** @var User $actor */
        $actor = $request->user();

        $article = DB::transaction(function () use ($edition, $actor, $payload): NewsArticle {
            $article = NewsArticle::create([
                'edition_id' => $edition->id,
                ...$this->articleAttributes($payload),
                'status' => 'draft',
                'version' => 1,
            ]);
            $this->upsertDraft($article, $actor);
            $this->recordRevision($article, $actor, 'Dibuat pertama kali');
            $this->recordAudit($actor, 'news.create', null, $article, ['edition_id', 'title', 'slug', 'status', 'version']);

            return $article;
        });

        return to_route('admin.news.edit', ['id' => $article->id])
            ->with('status', 'Draft berita disimpan.');
    }

    public function update(
        Request $request,
        string $id,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::NewsManage);
        $edition = $this->resolveEdition($request, $editionContext);
        abort_if($edition === null, 422, 'Konteks edisi aktif tidak ditemukan.');
        $payload = $this->validatedPayload($request, $id);
        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($edition, $actor, $id, $payload): void {
            $article = $this->lockedArticle($id, $edition);
            $this->assertVersion($article, (int) $payload['version']);
            $before = $this->snapshot($article);
            $article->fill($this->articleAttributes($payload));
            $article->version = (int) $article->version + 1;
            $article->save();
            $this->upsertDraft($article, $actor);
            $this->recordRevision($article, $actor, 'Simpan draft');
            $this->recordAudit($actor, 'news.update', $before, $article, [
                'title',
                'slug',
                'excerpt',
                'body',
                'body_json',
                'kind',
                'source_url',
                'cover_media_id',
                'version',
            ]);
        });

        return to_route('admin.news.edit', ['id' => $id])
            ->with('status', 'Perubahan draft berita disimpan.');
    }

    public function publish(
        Request $request,
        string $id,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::ContentPublish);
        $edition = $this->resolveEdition($request, $editionContext);
        abort_if($edition === null, 422, 'Konteks edisi aktif tidak ditemukan.');
        $version = $request->validate(['version' => ['required', 'integer', 'min:1']])['version'];
        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($edition, $actor, $id, $version): void {
            $article = $this->lockedArticle($id, $edition);
            $this->assertVersion($article, (int) $version);

            $normalizedBody = $this->normalizeStoredBody($article->body_json);
            if ($normalizedBody !== null) {
                $article->body_json = $this->materializeBodyDocument($normalizedBody);
            } elseif ($article->body_json === null && filled($article->body)) {
                $article->body_json = $this->plainTextDocument($article->body);
            }

            $this->assertPublishable($article);
            $before = $this->snapshot($article);
            $article->forceFill([
                'status' => 'published',
                'published_at' => $article->published_at ?? now(),
                'version' => (int) $article->version + 1,
            ])->save();
            $this->recordRevision($article, $actor, 'Terbitkan artikel');
            $this->recordAudit($actor, 'news.publish', $before, $article, ['status', 'published_at', 'body_json', 'version']);
        });

        return to_route('admin.news.edit', ['id' => $id])
            ->with('status', 'Berita diterbitkan.');
    }

    public function unpublish(
        Request $request,
        string $id,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): RedirectResponse {
        return $this->changeStatus(
            $request,
            $id,
            $authorization,
            $editionContext,
            PermissionKey::ContentPublish,
            'draft',
            'news.unpublish',
            'Tarik publikasi ke draft',
            'Berita ditarik kembali ke draft.',
        );
    }

    public function archive(
        Request $request,
        string $id,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): RedirectResponse {
        return $this->changeStatus(
            $request,
            $id,
            $authorization,
            $editionContext,
            PermissionKey::NewsManage,
            'archived',
            'news.archive',
            'Arsipkan artikel',
            'Berita diarsipkan.',
        );
    }

    public function destroy(
        Request $request,
        string $id,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, PermissionKey::NewsManage);
        $edition = $this->resolveEdition($request, $editionContext);
        abort_if($edition === null, 422, 'Konteks edisi aktif tidak ditemukan.');
        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($edition, $actor, $id): void {
            $article = $this->lockedArticle($id, $edition);
            $before = $this->snapshot($article);
            ContentDraft::query()
                ->where('resource_type', 'newsArticle')
                ->where('resource_id', $article->id)
                ->delete();
            ContentRevision::query()
                ->where('resource_type', 'newsArticle')
                ->where('resource_id', $article->id)
                ->delete();
            $article->delete();
            $this->recordAudit($actor, 'news.delete', $before, null, ['id']);
        });

        return to_route('admin.news.index')->with('status', 'Berita dihapus.');
    }

    /**
     * @param  list<array<string, mixed>>  $revisions
     * @return array<string, mixed>
     */
    private function formProps(
        Request $request,
        AuthorizationService $authorization,
        Edition $edition,
        ?NewsArticle $article,
        array $revisions,
    ): array {
        $media = MediaAsset::query()
            ->where('lifecycle', 'ready')
            ->where('mime_type', 'like', 'image/%')
            ->orderByDesc('created_at')
            ->limit(100)
            ->get();

        if ($article?->cover_media_id !== null && ! $media->contains('id', $article->cover_media_id)) {
            $selectedMedia = MediaAsset::query()->find($article->cover_media_id);
            if ($selectedMedia !== null) {
                $media->prepend($selectedMedia);
            }
        }

        $mediaOptions = $media
            ->map(fn (MediaAsset $asset): array => [
                'id' => $asset->id,
                'url' => $asset->url,
                'filename' => $asset->filename,
                'alt' => $asset->alt,
                'lifecycle' => $asset->lifecycle,
            ])
            ->values()
            ->all();

        return [
            'user' => $this->presentUser($request),
            'editionName' => $edition->name,
            'canEdit' => $this->hasPermission($request, $authorization, PermissionKey::NewsManage),
            'canPublish' => $this->hasPermission($request, $authorization, PermissionKey::ContentPublish),
            'article' => $article === null ? null : [
                'id' => $article->id,
                'title' => $article->title,
                'slug' => $article->slug,
                'excerpt' => $article->excerpt,
                'body' => $this->bodyForForm($article),
                'bodyJson' => $article->body_json ?? $this->plainTextDocument($article->body),
                'kind' => $article->kind,
                'sourceUrl' => $article->source_url,
                'coverMediaId' => $article->cover_media_id,
                'status' => $article->status,
                'version' => (int) $article->version,
                'publishedAt' => $article->published_at?->toIso8601String(),
            ],
            'revisions' => $revisions,
            'coverMediaOptions' => $mediaOptions,
            'bodyMediaOptions' => $mediaOptions,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function validatedPayload(Request $request, ?string $articleId = null): array
    {
        $slug = trim((string) $request->input('slug', ''));
        if ($slug === '') {
            $slug = Str::slug((string) $request->input('title', ''));
        }
        $request->merge(['slug' => $slug]);

        $slugRule = Rule::unique('news_articles', 'slug');
        if ($articleId !== null) {
            $slugRule = $slugRule->ignore($articleId);
        }

        $validated = $request->validate([
            'title' => ['required', 'string', 'min:3', 'max:255'],
            'slug' => ['required', 'string', 'max:255', 'regex:/^[a-z0-9-]+$/', $slugRule],
            'excerpt' => ['nullable', 'string', 'max:5000'],
            'body' => ['nullable', 'string', 'max:100000'],
            'body_json' => ['nullable', 'string', 'max:1000000'],
            'kind' => ['required', Rule::in(['internal', 'file', 'external'])],
            'source_url' => ['nullable', 'string', 'max:2000'],
            'cover_media_id' => ['nullable', 'uuid'],
            'version' => $articleId === null ? ['nullable', 'integer', 'min:1'] : ['required', 'integer', 'min:1'],
        ]);

        foreach (['title', 'slug', 'excerpt', 'body', 'body_json', 'source_url'] as $field) {
            if (array_key_exists($field, $validated) && is_string($validated[$field])) {
                $validated[$field] = trim($validated[$field]);
            }
        }

        if (($validated['excerpt'] ?? '') === '') {
            $validated['excerpt'] = null;
        }
        if (($validated['body'] ?? '') === '') {
            $validated['body'] = null;
        }
        if (($validated['body_json'] ?? '') === '') {
            $validated['body_json'] = null;
        }
        if (($validated['source_url'] ?? '') === '') {
            $validated['source_url'] = null;
        }

        if ($validated['body_json'] !== null) {
            try {
                $validated['body_json'] = $this->tiptap->normalize($validated['body_json']);
            } catch (InvalidArgumentException $exception) {
                throw ValidationException::withMessages(['body_json' => $exception->getMessage()]);
            }
        }

        $sourceUrl = $validated['source_url'] ?? null;
        if ($sourceUrl !== null && ! str_starts_with($sourceUrl, '/') && ! preg_match('/^https:\/\//i', $sourceUrl)) {
            throw ValidationException::withMessages([
                'source_url' => 'Sumber berita harus berupa URL https atau jalur internal.',
            ]);
        }

        if (($validated['cover_media_id'] ?? null) !== null && $this->readyImage((string) $validated['cover_media_id']) === null) {
            throw ValidationException::withMessages([
                'cover_media_id' => 'Sampul harus berupa aset gambar yang berstatus siap.',
            ]);
        }

        return $validated;
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function articleAttributes(array $payload): array
    {
        $normalizedBody = $payload['body_json'] ?? null;
        $bodyDocument = is_array($normalizedBody)
            ? $this->materializeBodyDocument($normalizedBody)
            : (($payload['body'] ?? null) === null ? null : $this->plainTextDocument((string) $payload['body']));

        return [
            'title' => $payload['title'],
            'slug' => $payload['slug'],
            'excerpt' => $payload['excerpt'] ?? null,
            'body' => $payload['body'] ?? null,
            'body_json' => $bodyDocument,
            'kind' => $payload['kind'],
            'source_url' => $payload['source_url'] ?? null,
            'cover_media_id' => $payload['cover_media_id'] ?? null,
        ];
    }

    private function changeStatus(
        Request $request,
        string $id,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
        PermissionKey $permission,
        string $status,
        string $action,
        string $reason,
        string $message,
    ): RedirectResponse {
        $this->ensurePermission($request, $authorization, $permission);
        $edition = $this->resolveEdition($request, $editionContext);
        abort_if($edition === null, 422, 'Konteks edisi aktif tidak ditemukan.');
        $version = $request->validate(['version' => ['required', 'integer', 'min:1']])['version'];
        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($edition, $actor, $id, $version, $status, $action, $reason): void {
            $article = $this->lockedArticle($id, $edition);
            $this->assertVersion($article, (int) $version);
            $before = $this->snapshot($article);
            $article->forceFill([
                'status' => $status,
                'version' => (int) $article->version + 1,
            ])->save();
            $this->recordRevision($article, $actor, $reason);
            $this->recordAudit($actor, $action, $before, $article, ['status', 'version']);
        });

        return to_route('admin.news.edit', ['id' => $id])->with('status', $message);
    }

    private function assertPublishable(NewsArticle $article): void
    {
        if (mb_strlen(trim($article->title)) < 3) {
            throw ValidationException::withMessages(['title' => 'Judul artikel minimal 3 karakter untuk diterbitkan.']);
        }
        if (! preg_match('/^[a-z0-9-]+$/', $article->slug)) {
            throw ValidationException::withMessages(['slug' => 'Slug artikel tidak valid.']);
        }
        if ($article->excerpt === null || mb_strlen(trim($article->excerpt)) < 10) {
            throw ValidationException::withMessages(['excerpt' => 'Ringkasan artikel minimal 10 karakter untuk diterbitkan.']);
        }
        if ($article->cover_media_id === null || $this->readyImage($article->cover_media_id) === null) {
            throw ValidationException::withMessages(['cover_media_id' => 'Sampul berita wajib berupa aset gambar yang siap.']);
        }
        if (! $this->hasBodyContent($article)) {
            throw ValidationException::withMessages(['body' => 'Isi artikel berita tidak boleh kosong.']);
        }
    }

    private function hasBodyContent(NewsArticle $article): bool
    {
        if (filled($article->body)) {
            return true;
        }

        return $this->documentHasText($article->body_json);
    }

    private function documentHasText(mixed $document): bool
    {
        if (! is_array($document)) {
            return false;
        }
        if (($document['type'] ?? null) === 'text') {
            return filled($document['text'] ?? null);
        }
        if (($document['type'] ?? null) === 'image') {
            return true;
        }

        foreach ($document['content'] ?? [] as $child) {
            if ($this->documentHasText($child)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @return array{type: string, content: list<array<string, mixed>>}|null
     */
    private function plainTextDocument(?string $body): ?array
    {
        if ($body === null || trim($body) === '') {
            return null;
        }

        $paragraphs = preg_split('/\R{2,}/', trim($body)) ?: [];

        return [
            'type' => 'doc',
            'content' => array_map(
                static fn (string $paragraph): array => [
                    'type' => 'paragraph',
                    'content' => [['type' => 'text', 'text' => $paragraph]],
                ],
                $paragraphs,
            ),
        ];
    }

    private function resolveEdition(Request $request, ActiveEditionContext $editionContext): ?Edition
    {
        $resolved = $editionContext->resolve($request->cookie(ActiveEditionContext::COOKIE_NAME));

        return $resolved === null ? null : Edition::query()->find($resolved['id']);
    }

    private function findArticle(string $id, Edition $edition): NewsArticle
    {
        return NewsArticle::query()
            ->with('coverMedia')
            ->where('edition_id', $edition->id)
            ->whereKey($id)
            ->firstOrFail();
    }

    private function lockedArticle(string $id, Edition $edition): NewsArticle
    {
        return NewsArticle::query()
            ->where('edition_id', $edition->id)
            ->whereKey($id)
            ->lockForUpdate()
            ->firstOrFail();
    }

    private function assertVersion(NewsArticle $article, int $version): void
    {
        if ((int) $article->version !== $version) {
            throw ValidationException::withMessages([
                'version' => 'Versi data berita telah berubah. Silakan muat ulang halaman sebelum menyimpan.',
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

    /**
     * @param  array{document: array<string, mixed>, imageMediaIds: list<string>}  $normalized
     * @return array<string, mixed>
     */
    private function materializeBodyDocument(array $normalized): array
    {
        $mediaIds = $normalized['imageMediaIds'];
        $assets = count($mediaIds) === 0
            ? collect()
            : MediaAsset::query()->whereIn('id', $mediaIds)->get()->keyBy('id');

        foreach ($mediaIds as $mediaId) {
            $asset = $assets->get($mediaId);
            if ($asset === null || $asset->lifecycle !== 'ready' || ! str_starts_with($asset->mime_type, 'image/')) {
                throw ValidationException::withMessages([
                    'body_json' => 'Gambar isi berita harus berupa aset gambar yang valid dan berstatus siap.',
                ]);
            }
        }

        return $this->tiptap->replaceImageSources(
            $normalized['document'],
            $assets->mapWithKeys(fn (MediaAsset $asset): array => [$asset->id => $asset->url])->all(),
        );
    }

    /**
     * @return array{document: array<string, mixed>, imageMediaIds: list<string>}|null
     */
    private function normalizeStoredBody(mixed $body): ?array
    {
        if ($body === null) {
            return null;
        }

        try {
            return $this->tiptap->normalize($body);
        } catch (InvalidArgumentException $exception) {
            throw ValidationException::withMessages(['body_json' => $exception->getMessage()]);
        }
    }

    private function upsertDraft(NewsArticle $article, User $actor): void
    {
        ContentDraft::query()->updateOrCreate(
            [
                'resource_type' => 'newsArticle',
                'resource_id' => $article->id,
            ],
            [
                'base_version' => $article->version,
                'snapshot_json' => $this->snapshot($article),
                'author_user_id' => $actor->id,
            ],
        );
    }

    private function recordRevision(NewsArticle $article, User $actor, string $reason): void
    {
        ContentRevision::create([
            'resource_type' => 'newsArticle',
            'resource_id' => $article->id,
            'version' => $article->version,
            'snapshot_json' => $this->snapshot($article),
            'author_user_id' => $actor->id,
            'reason' => $reason,
            'created_at' => now(),
        ]);
    }

    /**
     * @param  array<string, mixed>|null  $before
     * @param  list<string>  $changedFields
     */
    private function recordAudit(
        User $actor,
        string $action,
        ?array $before,
        ?NewsArticle $article,
        array $changedFields,
    ): void {
        AuditLog::create([
            'actor_user_id' => $actor->id,
            'actor_label' => $actor->email,
            'action' => $action,
            'resource_type' => 'newsArticle',
            'resource_id' => $article?->id ?? ($before['id'] ?? null),
            'resource_label' => $article?->title ?? ($before['title'] ?? 'Berita'),
            'before_json' => $before,
            'after_json' => $article === null ? null : $this->snapshot($article),
            'changed_fields_json' => $changedFields,
            'source' => 'laravel-admin-news',
            'created_at' => now(),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function snapshot(NewsArticle $article): array
    {
        return [
            'id' => $article->id,
            'edition_id' => $article->edition_id,
            'title' => $article->title,
            'slug' => $article->slug,
            'excerpt' => $article->excerpt,
            'body' => $article->body,
            'body_json' => $article->body_json,
            'kind' => $article->kind,
            'source_url' => $article->source_url,
            'cover_media_id' => $article->cover_media_id,
            'published_at' => $article->published_at?->toIso8601String(),
            'status' => $article->status,
            'version' => (int) $article->version,
        ];
    }

    /**
     * @return array{id: string, name: string, email: string}
     */
    private function presentUser(Request $request): array
    {
        /** @var User $user */
        $user = $request->user();

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function presentListItem(NewsArticle $article): array
    {
        return [
            'id' => $article->id,
            'title' => $article->title,
            'slug' => $article->slug,
            'excerpt' => $article->excerpt,
            'status' => $article->status,
            'version' => (int) $article->version,
            'publishedAt' => $article->published_at?->toIso8601String(),
            'createdAt' => $article->created_at?->toIso8601String(),
            'coverUrl' => $article->coverMedia?->url,
            'coverAlt' => $article->coverMedia?->alt,
        ];
    }

    private function bodyForForm(NewsArticle $article): ?string
    {
        if (filled($article->body)) {
            return $article->body;
        }

        $text = [];
        $walk = function (mixed $node) use (&$walk, &$text): void {
            if (! is_array($node)) {
                return;
            }
            if (($node['type'] ?? null) === 'text') {
                $text[] = (string) ($node['text'] ?? '');

                return;
            }
            foreach ($node['content'] ?? [] as $child) {
                $walk($child);
            }
            if (in_array($node['type'] ?? null, ['paragraph', 'heading', 'blockquote'], true)) {
                $text[] = "\n\n";
            }
        };
        $walk($article->body_json);

        $value = trim(implode('', $text));

        return $value === '' ? null : $value;
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

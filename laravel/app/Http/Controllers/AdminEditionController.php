<?php

namespace App\Http\Controllers;

use App\Enums\CategoryCode;
use App\Enums\PermissionKey;
use App\Models\AuditLog;
use App\Models\Category;
use App\Models\Edition;
use App\Models\User;
use App\Services\AuthorizationService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class AdminEditionController extends Controller
{
    public function index(Request $request, AuthorizationService $authorization): Response
    {
        $this->ensurePermission($request, $authorization, PermissionKey::ContentView);

        $editions = Edition::query()
            ->with('categories')
            ->orderByDesc('year')
            ->orderBy('id')
            ->get();

        return Inertia::render('Admin/Content/Editions/Index', [
            'user' => $this->presentUser($request),
            'editions' => $editions->map(fn (Edition $edition): array => $this->presentEdition($edition))->values()->all(),
            'canCreateEdition' => $this->hasPermission($request, $authorization, PermissionKey::SettingsManage),
            'canCreateCategory' => $this->hasPermission($request, $authorization, PermissionKey::ParticipantsManage),
            'canActivate' => $this->hasPermission($request, $authorization, PermissionKey::SettingsManage),
        ]);
    }

    public function store(Request $request, AuthorizationService $authorization): RedirectResponse
    {
        $this->ensurePermission($request, $authorization, PermissionKey::SettingsManage);
        $validated = $request->validate([
            'year' => ['required', 'integer', 'min:2020', 'max:2100', Rule::unique('editions', 'year')],
            'name' => ['required', 'string', 'min:2', 'max:255'],
        ]);
        $name = trim($validated['name']);
        if ($name === '') {
            throw ValidationException::withMessages(['name' => 'Nama edisi wajib diisi.']);
        }
        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($actor, $validated, $name): void {
            $year = (int) $validated['year'];
            $edition = Edition::create([
                'id' => (string) Str::uuid(),
                'year' => $year,
                'slug' => (string) $year,
                'name' => $name,
                'timezone' => 'Asia/Jakarta',
                'lifecycle' => 'draft',
                'starts_at' => null,
                'ends_at' => null,
                'organization_period_id' => null,
                'slogan' => null,
                'version' => 1,
            ]);
            $this->recordAudit(
                $actor,
                'edition.create',
                'edition',
                $edition->id,
                $edition->name,
                null,
                $this->editionSnapshot($edition),
                ['year', 'slug', 'name', 'lifecycle'],
            );
        });

        return to_route('admin.editions.index')->with('status', 'Draft edisi dibuat.');
    }

    public function storeCategory(Request $request, AuthorizationService $authorization): RedirectResponse
    {
        $this->ensurePermission($request, $authorization, PermissionKey::ParticipantsManage);
        $request->merge([
            'code' => strtoupper(trim((string) $request->input('code', ''))),
            'slug' => strtolower(trim((string) $request->input('slug', ''))),
            'label' => trim((string) $request->input('label', '')),
        ]);
        $codes = array_map(static fn (CategoryCode $code): string => $code->value, CategoryCode::cases());
        $validated = $request->validate([
            'edition_id' => ['required', 'uuid', 'exists:editions,id'],
            'code' => ['required', 'string', 'size:2', Rule::in($codes), Rule::unique('categories', 'code')->where(fn ($query) => $query->where('edition_id', $request->input('edition_id')))],
            'slug' => ['required', 'string', 'max:120', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/', Rule::unique('categories', 'slug')->where(fn ($query) => $query->where('edition_id', $request->input('edition_id')))],
            'label' => ['required', 'string', 'min:2', 'max:160'],
        ]);
        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($actor, $validated): void {
            $category = Category::create([
                'id' => (string) Str::uuid(),
                'edition_id' => $validated['edition_id'],
                'code' => $validated['code'],
                'slug' => $validated['slug'],
                'label' => $validated['label'],
                'display_order' => Category::query()->where('edition_id', $validated['edition_id'])->count(),
                'active' => true,
            ]);
            $this->recordAudit(
                $actor,
                'category.create',
                'category',
                $category->id,
                $category->label,
                null,
                $this->categorySnapshot($category),
                ['edition_id', 'code', 'slug', 'label', 'display_order', 'active'],
            );
        });

        return to_route('admin.editions.index')->with('status', 'Kategori ditambahkan.');
    }

    public function activate(Request $request, string $id, AuthorizationService $authorization): RedirectResponse
    {
        $this->ensurePermission($request, $authorization, PermissionKey::SettingsManage);
        $validated = $request->validate([
            'reason' => ['required', 'string', 'min:8', 'max:1000'],
        ]);
        /** @var User $actor */
        $actor = $request->user();

        DB::transaction(function () use ($actor, $id, $validated): void {
            $edition = Edition::query()->whereKey($id)->lockForUpdate()->firstOrFail();
            if (! Category::query()->where('edition_id', $edition->id)->exists()) {
                throw ValidationException::withMessages(['reason' => 'Edisi harus memiliki setidaknya satu kategori.']);
            }
            $before = $this->editionSnapshot($edition);
            Edition::query()
                ->where('lifecycle', 'active')
                ->where('id', '<>', $edition->id)
                ->update(['lifecycle' => 'archived', 'updated_at' => now()]);
            $edition->forceFill([
                'lifecycle' => 'active',
                'version' => (int) $edition->version + 1,
            ])->save();
            $this->recordAudit(
                $actor,
                'edition.activate',
                'edition',
                $edition->id,
                $edition->name,
                $before,
                $this->editionSnapshot($edition),
                ['lifecycle', 'version'],
                trim($validated['reason']),
            );
        });

        return to_route('admin.editions.index')->with('status', 'Edisi diaktifkan.');
    }

    private function presentEdition(Edition $edition): array
    {
        return [
            'id' => (string) $edition->id,
            'year' => (int) $edition->year,
            'slug' => $edition->slug,
            'name' => $edition->name,
            'timezone' => $edition->timezone,
            'lifecycle' => $edition->lifecycle,
            'version' => (int) $edition->version,
            'categories' => $edition->categories
                ->sortBy(['display_order', 'id'])
                ->map(fn (Category $category): array => [
                    'id' => (string) $category->id,
                    'code' => $category->code->value,
                    'slug' => $category->slug,
                    'label' => $category->label,
                    'displayOrder' => (int) $category->display_order,
                    'active' => (bool) $category->active,
                ])
                ->values()
                ->all(),
        ];
    }

    private function editionSnapshot(Edition $edition): array
    {
        return [
            'id' => $edition->id,
            'year' => (int) $edition->year,
            'slug' => $edition->slug,
            'name' => $edition->name,
            'lifecycle' => $edition->lifecycle,
            'version' => (int) $edition->version,
        ];
    }

    private function categorySnapshot(Category $category): array
    {
        return [
            'id' => $category->id,
            'edition_id' => $category->edition_id,
            'code' => $category->code->value,
            'slug' => $category->slug,
            'label' => $category->label,
            'display_order' => (int) $category->display_order,
            'active' => (bool) $category->active,
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
        ?string $reason = null,
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
            'source' => 'laravel-admin-editions',
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
        /** @var User|null $user */
        $user = $request->user();
        abort_unless($user !== null && $authorization->has($user, $permission->value), 403);
    }

    private function hasPermission(Request $request, AuthorizationService $authorization, PermissionKey $permission): bool
    {
        /** @var User|null $user */
        $user = $request->user();

        return $user !== null && $authorization->has($user, $permission->value);
    }
}

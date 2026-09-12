<?php

namespace App\Http\Controllers;

use App\Enums\PermissionKey;
use App\Models\AuditLog;
use App\Models\User;
use App\Services\AuthorizationService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AdminAuditController extends Controller
{
    public function __invoke(Request $request, AuthorizationService $authorization): Response
    {
        $this->ensurePermission($request, $authorization, PermissionKey::AuditView);

        return Inertia::render('Admin/Audit', [
            'user' => $this->presentUser($request),
            'logs' => AuditLog::query()
                ->orderByDesc('created_at')
                ->orderByDesc('id')
                ->limit(100)
                ->get()
                ->map(fn (AuditLog $log): array => [
                    'id' => (string) $log->id,
                    'createdAt' => $log->created_at?->toIso8601String(),
                    'actorLabel' => $log->actor_label,
                    'action' => $log->action,
                    'resourceType' => $log->resource_type,
                    'resourceId' => $log->resource_id,
                    'resourceLabel' => $log->resource_label,
                    'source' => $log->source,
                    'reason' => $log->reason,
                    'before' => $log->before_json,
                    'after' => $log->after_json,
                ])
                ->values()
                ->all(),
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
}

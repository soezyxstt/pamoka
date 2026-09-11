<?php

namespace App\Http\Controllers;

use App\Enums\AccessRequestStatus;
use App\Enums\AdminProfileStatus;
use App\Enums\PermissionKey;
use App\Models\AccessRequest;
use App\Models\AuditLog;
use App\Models\Role;
use App\Services\AuthorizationService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class AdminUsersController extends Controller
{
    public function index(Request $request, AuthorizationService $authorization): Response
    {
        $this->ensureAccess($request, $authorization);

        return Inertia::render('Admin/Users', [
            'openRequests' => AccessRequest::query()
                ->with('user')
                ->where('status', AccessRequestStatus::Open)
                ->latest()
                ->get()
                ->map(fn (AccessRequest $accessRequest): array => [
                    'id' => $accessRequest->id,
                    'reason' => $accessRequest->reason,
                    'areas' => $accessRequest->requested_areas_json,
                    'createdAt' => $accessRequest->created_at?->toIso8601String(),
                    'user' => [
                        'name' => $accessRequest->user->name,
                        'email' => $accessRequest->user->email,
                    ],
                ])
                ->values()
                ->all(),
            'assignableRoles' => Role::query()
                ->where('slug', '!=', 'super_admin')
                ->orderBy('label')
                ->get(['slug', 'label'])
                ->all(),
        ]);
    }

    public function approve(
        Request $request,
        AccessRequest $accessRequest,
        AuthorizationService $authorization,
    ): RedirectResponse {
        $this->ensureAccess($request, $authorization);
        $validated = $request->validate([
            'role' => ['required', 'string', Rule::exists('roles', 'slug')->whereNot('slug', 'super_admin')],
            'note' => ['nullable', 'string', 'max:500'],
        ]);

        DB::transaction(function () use ($request, $accessRequest, $validated): void {
            $lockedRequest = AccessRequest::query()->lockForUpdate()->find($accessRequest->id);
            if ($lockedRequest === null || $lockedRequest->status !== AccessRequestStatus::Open) {
                throw ValidationException::withMessages([
                    'role' => 'Permintaan akses sudah tidak terbuka.',
                ]);
            }

            $role = Role::query()->where('slug', $validated['role'])->firstOrFail();
            $target = $lockedRequest->user()->lockForUpdate()->firstOrFail();
            $profile = $target->adminProfile;
            if ($profile?->status !== AdminProfileStatus::Pending) {
                throw ValidationException::withMessages([
                    'role' => 'Akun ini tidak lagi berstatus menunggu.',
                ]);
            }

            $timestamp = now();
            $target->roles()->syncWithoutDetaching([
                $role->id => [
                    'granted_by_user_id' => $request->user()->id,
                    'granted_at' => $timestamp,
                ],
            ]);
            $profile->forceFill([
                'status' => AdminProfileStatus::Active,
                'status_reason' => filled($validated['note'] ?? null) ? trim($validated['note']) : null,
            ])->save();
            $lockedRequest->forceFill([
                'status' => AccessRequestStatus::Approved,
                'reviewed_by_user_id' => $request->user()->id,
                'review_note' => filled($validated['note'] ?? null) ? trim($validated['note']) : null,
                'reviewed_at' => $timestamp,
            ])->save();

            AuditLog::create([
                'actor_user_id' => $request->user()->id,
                'actor_label' => $request->user()->email,
                'action' => 'access.request.approve',
                'resource_type' => 'accessRequest',
                'resource_id' => $lockedRequest->id,
                'resource_label' => $target->email,
                'before_json' => [
                    'status' => AccessRequestStatus::Open->value,
                    'profile_status' => AdminProfileStatus::Pending->value,
                ],
                'after_json' => [
                    'status' => AccessRequestStatus::Approved->value,
                    'profile_status' => AdminProfileStatus::Active->value,
                    'role' => $role->slug,
                ],
                'changed_fields_json' => ['status', 'profile_status', 'role'],
                'source' => 'admin-users',
                'reason' => filled($validated['note'] ?? null) ? trim($validated['note']) : null,
                'created_at' => $timestamp,
            ]);
        });

        return to_route('admin.users')->with('status', 'Akses pengguna disetujui.');
    }

    private function ensureAccess(Request $request, AuthorizationService $authorization): void
    {
        abort_unless(
            $authorization->has($request->user(), PermissionKey::AccessApprove->value)
                && $authorization->has($request->user(), PermissionKey::AccessManage->value),
            403,
        );
    }
}

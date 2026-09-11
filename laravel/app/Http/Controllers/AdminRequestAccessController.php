<?php

namespace App\Http\Controllers;

use App\Enums\AccessRequestStatus;
use App\Enums\AdminProfileStatus;
use App\Models\AccessRequest;
use App\Models\AuditLog;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class AdminRequestAccessController extends Controller
{
    public function __invoke(Request $request): Response
    {
        return Inertia::render('Admin/RequestAccess', [
            'user' => [
                'name' => $request->user()->name,
                'email' => $request->user()->email,
            ],
            'status' => $request->user()->adminProfile?->status->value,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'min:10', 'max:500'],
            'areas' => ['nullable', 'array', 'max:12'],
            'areas.*' => ['string', Rule::in(['content', 'voting', 'users'])],
        ]);
        $user = $request->user();
        $profile = $user->adminProfile;
        if ($profile?->status !== AdminProfileStatus::Pending) {
            abort(403, 'Akun ini tidak dapat meminta akses pada status saat ini.');
        }

        $hasOpenRequest = AccessRequest::query()
            ->where('user_id', $user->id)
            ->where('status', AccessRequestStatus::Open)
            ->exists();
        if ($hasOpenRequest) {
            throw ValidationException::withMessages([
                'reason' => 'Masih ada permintaan akses yang sedang ditinjau.',
            ]);
        }

        DB::transaction(function () use ($validated, $user, $profile): void {
            $timestamp = now();
            $accessRequest = new AccessRequest([
                'user_id' => $user->id,
                'status' => AccessRequestStatus::Open,
                'reason' => trim($validated['reason']),
                'requested_areas_json' => array_values($validated['areas'] ?? []),
            ]);
            $accessRequest->created_at = $timestamp;
            $accessRequest->updated_at = $timestamp;
            $accessRequest->save();

            $profile->forceFill(['requested_at' => $timestamp])->save();

            AuditLog::create([
                'actor_user_id' => $user->id,
                'actor_label' => $user->email,
                'action' => 'access.request.create',
                'resource_type' => 'accessRequest',
                'resource_id' => $accessRequest->id,
                'resource_label' => $user->email,
                'after_json' => [
                    'status' => AccessRequestStatus::Open->value,
                    'requested_areas' => array_values($validated['areas'] ?? []),
                ],
                'changed_fields_json' => ['reason', 'requested_areas', 'status'],
                'source' => 'admin-request-access',
                'reason' => trim($validated['reason']),
                'created_at' => $timestamp,
            ]);
        });

        return to_route('admin.request-access')->with('status', 'Permintaan akses sudah dikirim.');
    }
}

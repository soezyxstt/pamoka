<?php

namespace App\Http\Middleware;

use App\Enums\AdminProfileStatus;
use App\Services\AuthorizationService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureAdminAccess
{
    public function __construct(private readonly AuthorizationService $authorization) {}

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if ($user === null) {
            return redirect()->route('admin.login');
        }

        if ($user->adminProfile?->status !== AdminProfileStatus::Active) {
            return redirect()->route('admin.request-access');
        }

        abort_unless($this->authorization->has($user, 'admin.view'), 403);

        return $next($request);
    }
}

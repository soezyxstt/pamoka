<?php

namespace App\Http\Controllers;

use App\Services\ActiveEditionContext;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class AdminEditionContextController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'edition_id' => ['required', 'uuid', 'exists:editions,id'],
        ]);

        return to_route('admin.dashboard')
            ->withCookie(cookie(ActiveEditionContext::COOKIE_NAME, $validated['edition_id'], 60 * 24 * 365));
    }
}

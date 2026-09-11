<?php

namespace App\Http\Middleware;

use App\Services\ActiveEditionContext;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $shared = [
            ...parent::share($request),
        ];

        if ($request->user() !== null && ($request->is('admin') || $request->is('admin/*'))) {
            $editionContext = app(ActiveEditionContext::class);
            $shared['admin'] = [
                'activeEdition' => $editionContext->resolve($request->cookie(ActiveEditionContext::COOKIE_NAME)),
                'editions' => $editionContext->all(),
            ];
        }

        return $shared;
    }
}

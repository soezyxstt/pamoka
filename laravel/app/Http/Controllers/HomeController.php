<?php

namespace App\Http\Controllers;

use Inertia\Inertia;
use Inertia\Response;

class HomeController extends Controller
{
    public function __invoke(): Response
    {
        return Inertia::render('Home', [
            'migrationStage' => 'Fondasi',
            'legacyApp' => 'Next.js',
            'targetApp' => 'Laravel + Inertia React',
        ]);
    }
}

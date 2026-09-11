<?php

namespace App\Http\Controllers;

use App\Services\PublicCoreContent;
use Inertia\Inertia;
use Inertia\Response;

class HomeController extends Controller
{
    public function __invoke(PublicCoreContent $content): Response
    {
        return Inertia::render('Home', $content->home());
    }
}

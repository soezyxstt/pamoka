<?php

namespace App\Http\Controllers;

use App\Services\PublicCoreContent;
use App\Services\PublicNewsCatalog;
use Inertia\Inertia;
use Inertia\Response;

class HomeController extends Controller
{
    public function __invoke(PublicCoreContent $content, PublicNewsCatalog $news): Response
    {
        return Inertia::render('Home', $content->home($news->featured()));
    }
}

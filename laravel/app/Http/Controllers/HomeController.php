<?php

namespace App\Http\Controllers;

use App\Services\PublicCoreContent;
use App\Services\PublicEditionCatalog;
use App\Services\PublicNewsCatalog;
use App\Services\PublicSiteAssetCatalog;
use Inertia\Inertia;
use Inertia\Response;

class HomeController extends Controller
{
    public function __invoke(
        PublicCoreContent $content,
        PublicEditionCatalog $edition,
        PublicNewsCatalog $news,
        PublicSiteAssetCatalog $siteAssets,
    ): Response {
        return Inertia::render('Home', $content->home(
            $news->featured(),
            $siteAssets->forActiveEdition(),
            $edition->home(),
        ));
    }
}

<?php

namespace App\Http\Controllers;

use Inertia\Inertia;
use Inertia\Response;

class PublicPageController extends Controller
{
    public function about(): Response
    {
        return $this->renderPlaceholder('about', 'Tentang PAMOKA Garut');
    }

    public function event(string $event): Response
    {
        return $this->renderPlaceholder('events.show', 'Rangkaian kegiatan', ['event' => $event]);
    }

    public function finalists(string $category): Response
    {
        return $this->renderPlaceholder('finalists.index', 'Profil finalis', ['category' => $category]);
    }

    public function finalist(string $category, string $name): Response
    {
        return $this->renderPlaceholder('finalists.show', 'Profil finalis', [
            'category' => $category,
            'name' => $name,
        ]);
    }

    public function semifinalists(string $category): Response
    {
        return $this->renderPlaceholder('semifinalists.index', 'Profil semifinalis', ['category' => $category]);
    }

    public function semifinalist(string $category, string $name): Response
    {
        return $this->renderPlaceholder('semifinalists.show', 'Profil semifinalis', [
            'category' => $category,
            'name' => $name,
        ]);
    }

    public function voting(string $category): Response
    {
        return $this->renderPlaceholder('voting.index', 'Voting', ['category' => $category]);
    }

    public function votingCandidate(string $category, string $name): Response
    {
        return $this->renderPlaceholder('voting.show', 'Voting', [
            'category' => $category,
            'name' => $name,
        ]);
    }

    public function votingResults(string $category): Response
    {
        return $this->renderPlaceholder('voting.results', 'Hasil voting', ['category' => $category]);
    }

    /**
     * @param  array<string, string>  $parameters
     */
    private function renderPlaceholder(string $pageKey, string $pageTitle, array $parameters = []): Response
    {
        return Inertia::render('Public/Placeholder', [
            'pageKey' => $pageKey,
            'pageTitle' => $pageTitle,
            'routePath' => request()->getPathInfo(),
            'parameters' => $parameters,
        ]);
    }
}

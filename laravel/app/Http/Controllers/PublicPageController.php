<?php

namespace App\Http\Controllers;

use App\Services\PublicCoreContent;
use App\Services\PublicParticipantCatalog;
use Inertia\Inertia;
use Inertia\Response;

class PublicPageController extends Controller
{
    public function about(PublicCoreContent $content): Response
    {
        return Inertia::render('Public/About', $content->about());
    }

    public function event(string $event): Response
    {
        return $this->renderPlaceholder('events.show', 'Rangkaian kegiatan', ['event' => $event]);
    }

    public function finalists(string $category, PublicParticipantCatalog $catalog): Response
    {
        return $this->renderParticipantIndex($catalog, $category, PublicParticipantCatalog::FINAL_STAGE, 'finalists');
    }

    public function finalist(string $category, string $name, PublicParticipantCatalog $catalog): Response
    {
        return $this->renderParticipantDetail($catalog, $category, $name, PublicParticipantCatalog::FINAL_STAGE, 'finalists');
    }

    public function semifinalists(string $category, PublicParticipantCatalog $catalog): Response
    {
        return $this->renderParticipantIndex($catalog, $category, PublicParticipantCatalog::SEMIFINAL_STAGE, 'semifinalists');
    }

    public function semifinalist(string $category, string $name, PublicParticipantCatalog $catalog): Response
    {
        return $this->renderParticipantDetail($catalog, $category, $name, PublicParticipantCatalog::SEMIFINAL_STAGE, 'semifinalists');
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

    private function renderParticipantIndex(
        PublicParticipantCatalog $catalog,
        string $categorySlug,
        string $stageKey,
        string $mode,
    ): Response {
        $data = $catalog->listing($categorySlug, $stageKey);

        abort_if($data === null, 404, 'Kategori tidak ditemukan.');

        $stageLabel = $data['stage']['label'];
        $categoryLabel = $data['category']['label'];
        $year = $data['edition']['year'] ?? null;
        $yearSuffix = $year === null ? '' : ' '.$year;
        $pageTitle = "Profil {$stageLabel} {$categoryLabel}{$yearSuffix}";

        return Inertia::render('Public/Participants/Index', $data + [
            'mode' => $mode,
            'pageTitle' => $pageTitle,
            'meta' => [
                'title' => "{$pageTitle} | MOKA Garut",
                'description' => "Profil {$stageLabel} Pasanggiri Mojang Jajaka Kabupaten Garut{$yearSuffix} pada kategori {$categoryLabel}.",
            ],
            'profileBasePath' => route("public.{$mode}.index", ['category' => $categorySlug], false),
            'emptyState' => "Belum ada data {$stageLabel} yang dipublikasikan untuk edisi ini.",
        ]);
    }

    private function renderParticipantDetail(
        PublicParticipantCatalog $catalog,
        string $categorySlug,
        string $participantSlug,
        string $stageKey,
        string $mode,
    ): Response {
        $data = $catalog->detail($categorySlug, $stageKey, $participantSlug);

        abort_if($data === null, 404, 'Peserta tidak ditemukan.');

        $stageLabel = $data['stage']['label'];
        $categoryLabel = $data['category']['label'];
        $year = $data['edition']['year'] ?? null;
        $yearSuffix = $year === null ? '' : ' '.$year;
        $pageTitle = "Profil {$data['participant']['name']} {$categoryLabel}{$yearSuffix}";

        return Inertia::render('Public/Participants/Show', $data + [
            'mode' => $mode,
            'pageTitle' => $pageTitle,
            'meta' => [
                'title' => "{$pageTitle} | MOKA Garut",
                'description' => "Profil {$stageLabel} {$data['participant']['name']} pada kategori {$categoryLabel}{$yearSuffix}.",
            ],
            'profileIndexPath' => route("public.{$mode}.index", ['category' => $categorySlug], false),
        ]);
    }
}

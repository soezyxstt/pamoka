<?php

namespace App\Http\Controllers;

use App\Enums\PermissionKey;
use App\Models\User;
use App\Services\ActiveEditionContext;
use App\Services\AuthorizationService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AdminContentController extends Controller
{
    public function index(
        Request $request,
        AuthorizationService $authorization,
        ActiveEditionContext $editionContext,
    ): Response {
        $this->ensurePermission($request, $authorization, PermissionKey::ContentView);
        $edition = $editionContext->resolve($request->cookie(ActiveEditionContext::COOKIE_NAME));

        return Inertia::render('Admin/Content/Index', [
            'user' => $this->presentUser($request),
            'edition' => $edition,
            'modules' => [
                ['slug' => 'editions', 'label' => 'Kelola edisi', 'description' => 'Periode, kategori, dan status edisi.', 'href' => '/admin/content/editions', 'available' => true],
                ['slug' => 'edition-settings', 'label' => 'Identitas edisi', 'description' => 'Logo, slogan, dan program unggulan.', 'href' => '/admin/content/edition-settings', 'available' => true],
                ['slug' => 'site-assets', 'label' => 'Aset situs', 'description' => 'Gambar untuk bagian situs yang tetap.', 'href' => '/admin/content/site-assets', 'available' => true],
                ['slug' => 'news', 'label' => 'Berita', 'description' => 'Artikel, pratinjau, dan publikasi.', 'href' => '/admin/content/news', 'available' => true],
                ['slug' => 'sponsors', 'label' => 'Sponsor', 'description' => 'Partner dan tingkat sponsor.', 'href' => '/admin/content/sponsors', 'available' => true],
                ['slug' => 'participants', 'label' => 'Mojang Jajaka', 'description' => 'Pendaftar, seleksi, profil, dan gelar.', 'href' => '/admin/content/participants', 'available' => true],
                ['slug' => 'events', 'label' => 'Acara', 'description' => 'Agenda kegiatan dan tautan album.', 'href' => '/admin/content/events', 'available' => true],
                ['slug' => 'galleries', 'label' => 'Galeri', 'description' => 'Album foto dan video kegiatan.', 'href' => '/admin/content/galleries', 'available' => true],
                ['slug' => 'committee', 'label' => 'Panitia', 'description' => 'Struktur panitia edisi aktif.', 'href' => '/admin/content/committee', 'available' => true],
            ],
        ]);
    }

    private function presentUser(Request $request): array
    {
        /** @var User $user */
        $user = $request->user();

        return ['id' => $user->id, 'name' => $user->name, 'email' => $user->email];
    }

    private function ensurePermission(Request $request, AuthorizationService $authorization, PermissionKey $permission): void
    {
        /** @var User|null $user */
        $user = $request->user();
        abort_unless($user !== null && $authorization->has($user, $permission->value), 403);
    }
}

<?php

namespace Tests\Feature;

use App\Models\Participant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PublicRouteParityTest extends TestCase
{
    use RefreshDatabase;

    public function test_every_rehearsed_public_route_family_returns_its_inertia_page(): void
    {
        $this->artisan('moka:rehearse-2025', ['--apply' => true])
            ->assertSuccessful();

        $routes = [
            [route('home'), 'Home'],
            [route('public.about'), 'Public/About'],
            [route('public.news.show', ['slug' => 'press-release-semifinalis']), 'Public/News/Show'],
            [route('public.news.show', ['slug' => 'pasanggiri-mojang-jajaka-garut-2025']), 'Public/News/Show'],
            [route('public.news.show', ['slug' => 'mojang-jajaka-garut-promosi-budaya']), 'Public/News/Show'],
            [route('legacy.contact'), 'Public/Legacy/Contact'],
            [route('legacy.pasanggiri'), 'Public/Legacy/Pasanggiri'],
            [route('legacy.voting.show', ['name' => 'nama-lama']), 'Public/Legacy/Voting'],
        ];

        foreach (['audisi', 'semifinal', 'karantina', 'unjuk-kabisa', 'gala-dinner', 'grand-final'] as $event) {
            $routes[] = [route('public.events.show', ['event' => $event]), 'Public/Events/Show'];
        }

        foreach (['mojang-rumaja', 'jajaka-rumaja', 'mojang-dewasa', 'jajaka-dewasa'] as $category) {
            $finalist = Participant::query()
                ->where('stage', 'final')
                ->whereHas('category', fn ($query) => $query->where('slug', $category))
                ->orderBy('display_order')
                ->firstOrFail();
            $semifinalist = Participant::query()
                ->where('stage', 'semifinal')
                ->whereHas('category', fn ($query) => $query->where('slug', $category))
                ->orderBy('display_order')
                ->firstOrFail();

            $routes[] = [route('public.finalists.index', ['category' => $category]), 'Public/Participants/Index'];
            $routes[] = [route('public.finalists.show', ['category' => $category, 'name' => $finalist->slug]), 'Public/Participants/Show'];
            $routes[] = [route('public.semifinalists.index', ['category' => $category]), 'Public/Participants/Index'];
            $routes[] = [route('public.semifinalists.show', ['category' => $category, 'name' => $semifinalist->slug]), 'Public/Participants/Show'];
            $routes[] = [route('public.voting.index', ['category' => $category]), 'Public/Voting/Index'];
            $routes[] = [route('public.voting.show', ['category' => $category, 'name' => $finalist->slug]), 'Public/Voting/Show'];
            $routes[] = [route('public.voting.results', ['category' => $category]), 'Public/Voting/Results'];
        }

        foreach ($routes as [$url, $component]) {
            $this->get($url)
                ->assertOk()
                ->assertInertia(fn ($page) => $page->component($component));
        }
    }
}

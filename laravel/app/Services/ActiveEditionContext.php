<?php

namespace App\Services;

use App\Models\Edition;

final class ActiveEditionContext
{
    public const COOKIE_NAME = 'pamoka_admin_edition_id';

    /**
     * @return array{id: string, year: int, slug: string, name: string, lifecycle: string}|null
     */
    public function resolve(?string $cookieEditionId = null): ?array
    {
        $selected = $cookieEditionId === null
            ? null
            : Edition::query()->whereKey($cookieEditionId)->first();

        if ($selected !== null) {
            return $this->present($selected);
        }

        $active = Edition::query()
            ->where('lifecycle', 'active')
            ->orderByDesc('year')
            ->first();

        $latest = $active ?? Edition::query()->orderByDesc('year')->first();

        return $latest === null ? null : $this->present($latest);
    }

    /**
     * @return list<array{id: string, year: int, slug: string, name: string, lifecycle: string}>
     */
    public function all(): array
    {
        return Edition::query()
            ->orderByDesc('year')
            ->get()
            ->map(fn (Edition $edition): array => $this->present($edition))
            ->values()
            ->all();
    }

    /**
     * @return array{id: string, year: int, slug: string, name: string, lifecycle: string}
     */
    private function present(Edition $edition): array
    {
        return [
            'id' => (string) $edition->id,
            'year' => (int) $edition->year,
            'slug' => $edition->slug,
            'name' => $edition->name,
            'lifecycle' => $edition->lifecycle,
        ];
    }
}

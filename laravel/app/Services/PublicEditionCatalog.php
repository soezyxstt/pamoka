<?php

namespace App\Services;

use App\Models\Edition;
use App\Models\EditionProgram;
use Illuminate\Support\Facades\Schema;

final class PublicEditionCatalog
{
    /**
     * @return array{slogan: string|null, programs: list<string>}
     */
    public function home(): array
    {
        if (! Schema::hasTable('editions') || ! Schema::hasTable('edition_programs')) {
            return ['slogan' => null, 'programs' => []];
        }

        $edition = Edition::query()
            ->where('lifecycle', 'active')
            ->orderByDesc('year')
            ->orderByDesc('id')
            ->first();

        if ($edition === null) {
            return ['slogan' => null, 'programs' => []];
        }

        return [
            'slogan' => is_string($edition->slogan) && trim($edition->slogan) !== '' ? trim($edition->slogan) : null,
            'programs' => EditionProgram::query()
                ->where('edition_id', $edition->id)
                ->where('active', true)
                ->orderBy('display_order')
                ->orderBy('id')
                ->pluck('title')
                ->map(static fn (mixed $title): string => trim((string) $title))
                ->filter(static fn (string $title): bool => $title !== '')
                ->values()
                ->all(),
        ];
    }
}

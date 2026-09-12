<?php

namespace App\Models;

use Database\Factories\OrganizationPeriodFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['label', 'start_year', 'end_year', 'vision', 'mission_json', 'lifecycle', 'version'])]
class OrganizationPeriod extends Model
{
    /** @use HasFactory<OrganizationPeriodFactory> */
    use HasFactory, HasUuids;

    public function editions(): HasMany
    {
        return $this->hasMany(Edition::class);
    }

    public function units(): HasMany
    {
        return $this->hasMany(OrganizationUnit::class);
    }

    public function memberships(): HasMany
    {
        return $this->hasMany(OrganizationMembership::class);
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'mission_json' => 'array',
            'version' => 'integer',
        ];
    }
}

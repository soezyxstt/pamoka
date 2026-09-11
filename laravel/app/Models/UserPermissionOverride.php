<?php

namespace App\Models;

use App\Enums\PermissionEffect;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['user_id', 'permission_key', 'effect', 'reason', 'granted_by_user_id'])]
class UserPermissionOverride extends Model
{
    use HasUuids;

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function grantedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'granted_by_user_id');
    }

    protected function casts(): array
    {
        return [
            'effect' => PermissionEffect::class,
        ];
    }
}

<?php

namespace App\Models;

use App\Enums\AccessRequestStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['user_id', 'status', 'reason', 'requested_areas_json', 'reviewed_by_user_id', 'review_note', 'reviewed_at'])]
class AccessRequest extends Model
{
    use HasUuids;

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function reviewedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by_user_id');
    }

    protected function casts(): array
    {
        return [
            'status' => AccessRequestStatus::class,
            'requested_areas_json' => 'array',
            'reviewed_at' => 'datetime',
        ];
    }
}

<?php

namespace App\Models;

use App\Enums\AdminProfileStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['user_id', 'status', 'status_reason', 'requested_at', 'last_signed_in_at'])]
class AdminProfile extends Model
{
    protected $primaryKey = 'user_id';

    public $incrementing = false;

    protected $keyType = 'int';

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    protected function casts(): array
    {
        return [
            'status' => AdminProfileStatus::class,
            'requested_at' => 'datetime',
            'last_signed_in_at' => 'datetime',
        ];
    }
}

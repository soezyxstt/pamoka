<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

#[Fillable(['actor_user_id', 'actor_label', 'action', 'resource_type', 'resource_id', 'resource_label', 'before_json', 'after_json', 'changed_fields_json', 'source', 'reason', 'created_at'])]
class AuditLog extends Model
{
    use HasUuids;

    public $timestamps = false;

    protected static function booted(): void
    {
        static::updating(static function (): void {
            throw new LogicException('Audit logs are immutable.');
        });
        static::deleting(static function (): void {
            throw new LogicException('Audit logs are immutable.');
        });
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }

    protected function casts(): array
    {
        return [
            'before_json' => 'array',
            'after_json' => 'array',
            'changed_fields_json' => 'array',
            'created_at' => 'datetime',
        ];
    }
}

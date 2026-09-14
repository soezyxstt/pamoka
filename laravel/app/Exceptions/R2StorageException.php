<?php

namespace App\Exceptions;

use RuntimeException;

final class R2StorageException extends RuntimeException
{
    public function __construct(string $message, public readonly int $status = 503, ?\Throwable $previous = null)
    {
        parent::__construct($message, $status, $previous);
    }
}

<?php

namespace App\Exceptions;

use RuntimeException;

final class UploadThingException extends RuntimeException
{
    public function __construct(string $message, public readonly int $status = 502)
    {
        parent::__construct($message, $status);
    }
}

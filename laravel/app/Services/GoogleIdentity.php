<?php

namespace App\Services;

final readonly class GoogleIdentity
{
    public function __construct(
        public string $providerAccountId,
        public string $name,
        public string $email,
        public bool $emailVerified,
        public ?string $avatarUrl,
        public ?string $accessToken,
        public ?string $refreshToken,
        public ?int $accessTokenExpiresIn,
    ) {}
}

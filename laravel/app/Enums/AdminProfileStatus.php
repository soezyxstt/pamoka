<?php

namespace App\Enums;

enum AdminProfileStatus: string
{
    case Pending = 'pending';
    case Active = 'active';
    case Rejected = 'rejected';
    case Suspended = 'suspended';
}

<?php

namespace App\Enums;

enum AccessRequestStatus: string
{
    case Open = 'open';
    case Approved = 'approved';
    case Rejected = 'rejected';
    case Cancelled = 'cancelled';
}

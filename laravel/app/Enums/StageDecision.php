<?php

namespace App\Enums;

enum StageDecision: string
{
    case Pending = 'pending';
    case Advanced = 'advanced';
    case Eliminated = 'eliminated';
}

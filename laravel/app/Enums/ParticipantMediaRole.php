<?php

namespace App\Enums;

enum ParticipantMediaRole: string
{
    case Closeup = 'closeup';
    case FullBody = 'full_body';
    case Detail = 'detail';
    case Karantina = 'karantina';
    case Other = 'other';
}

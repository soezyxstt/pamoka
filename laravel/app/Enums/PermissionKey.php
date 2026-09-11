<?php

namespace App\Enums;

enum PermissionKey: string
{
    case AdminView = 'admin.view';
    case ContentView = 'content.view';
    case ContentEdit = 'content.edit';
    case ContentPublish = 'content.publish';
    case MediaView = 'media.view';
    case MediaManage = 'media.manage';
    case NewsManage = 'news.manage';
    case SponsorsManage = 'sponsors.manage';
    case PeopleManage = 'people.manage';
    case ParticipantsManage = 'participants.manage';
    case EventsManage = 'events.manage';
    case GalleryManage = 'gallery.manage';
    case VotingView = 'voting.view';
    case VotingManage = 'voting.manage';
    case VotingTally = 'voting.tally';
    case VotingResultsPublish = 'voting.results.publish';
    case UsersView = 'users.view';
    case AccessApprove = 'access.approve';
    case AccessManage = 'access.manage';
    case AuditView = 'audit.view';
    case AuditExport = 'audit.export';
    case SettingsManage = 'settings.manage';
    case SystemSuperadmin = 'system.superadmin';
}

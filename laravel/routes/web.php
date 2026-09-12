<?php

use App\Http\Controllers\AdminDashboardController;
use App\Http\Controllers\AdminEditionContextController;
use App\Http\Controllers\AdminRequestAccessController;
use App\Http\Controllers\AdminUsersController;
use App\Http\Controllers\Auth\GoogleAuthenticationController;
use App\Http\Controllers\HomeController;
use App\Http\Controllers\PublicPageController;
use App\Http\Middleware\EnsureAdminAccess;
use Illuminate\Support\Facades\Route;

Route::get('/', HomeController::class)->name('home');

Route::get('/admin/login', [GoogleAuthenticationController::class, 'showLogin'])->name('admin.login');
Route::get('/auth/google/redirect', [GoogleAuthenticationController::class, 'redirectToGoogle'])->name('auth.google.redirect');
Route::get('/auth/google/callback', [GoogleAuthenticationController::class, 'handleGoogleCallback'])->name('auth.google.callback');
Route::post('/logout', [GoogleAuthenticationController::class, 'logout'])->middleware('auth')->name('logout');
Route::get('/admin/request-access', AdminRequestAccessController::class)->middleware('auth')->name('admin.request-access');
Route::post('/admin/request-access', [AdminRequestAccessController::class, 'store'])->middleware('auth')->name('admin.request-access.store');
Route::post('/admin/context/edition', [AdminEditionContextController::class, 'store'])->middleware(EnsureAdminAccess::class)->name('admin.edition-context.store');
Route::get('/admin/users', [AdminUsersController::class, 'index'])->middleware(EnsureAdminAccess::class)->name('admin.users');
Route::post('/admin/users/access-requests/{accessRequest}/approve', [AdminUsersController::class, 'approve'])->middleware(EnsureAdminAccess::class)->name('admin.access-requests.approve');
Route::get('/admin', AdminDashboardController::class)->middleware(EnsureAdminAccess::class)->name('admin.dashboard');
Route::get('/monitor', [PublicPageController::class, 'monitor'])->middleware(EnsureAdminAccess::class)->name('admin.monitor');

Route::get('/tentang', [PublicPageController::class, 'about'])->name('public.about');
Route::get('/berita/{slug}', [PublicPageController::class, 'news'])
    ->where('slug', '[a-z0-9]+(?:-[a-z0-9]+)*')
    ->name('public.news.show');
Route::get('/rangkaian-kegiatan/{event}', [PublicPageController::class, 'event'])->name('public.events.show');
Route::get('/profil-finalis/{category}/{name}', [PublicPageController::class, 'finalist'])->name('public.finalists.show');
Route::get('/profil-finalis/{category}', [PublicPageController::class, 'finalists'])->name('public.finalists.index');
Route::get('/profil-semifinalis/{category}/{name}', [PublicPageController::class, 'semifinalist'])->name('public.semifinalists.show');
Route::get('/profil-semifinalis/{category}', [PublicPageController::class, 'semifinalists'])->name('public.semifinalists.index');
Route::get('/voting/hasil/{category}', [PublicPageController::class, 'votingResults'])->name('public.voting.results');
Route::get('/voting/{category}/{name}', [PublicPageController::class, 'votingCandidate'])->name('public.voting.show');
Route::get('/voting/{category}', [PublicPageController::class, 'voting'])->name('public.voting.index');

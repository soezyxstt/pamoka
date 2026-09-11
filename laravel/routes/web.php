<?php

use App\Http\Controllers\HomeController;
use App\Http\Controllers\PublicPageController;
use Illuminate\Support\Facades\Route;

Route::get('/', HomeController::class)->name('home');

Route::get('/tentang', [PublicPageController::class, 'about'])->name('public.about');
Route::get('/rangkaian-kegiatan/{event}', [PublicPageController::class, 'event'])->name('public.events.show');
Route::get('/profil-finalis/{category}/{name}', [PublicPageController::class, 'finalist'])->name('public.finalists.show');
Route::get('/profil-finalis/{category}', [PublicPageController::class, 'finalists'])->name('public.finalists.index');
Route::get('/profil-semifinalis/{category}/{name}', [PublicPageController::class, 'semifinalist'])->name('public.semifinalists.show');
Route::get('/profil-semifinalis/{category}', [PublicPageController::class, 'semifinalists'])->name('public.semifinalists.index');
Route::get('/voting/hasil/{category}', [PublicPageController::class, 'votingResults'])->name('public.voting.results');
Route::get('/voting/{category}/{name}', [PublicPageController::class, 'votingCandidate'])->name('public.voting.show');
Route::get('/voting/{category}', [PublicPageController::class, 'voting'])->name('public.voting.index');

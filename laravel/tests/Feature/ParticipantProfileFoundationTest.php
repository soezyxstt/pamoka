<?php

namespace Tests\Feature;

use App\Enums\ParticipantMediaRole;
use App\Enums\SocialPlatform;
use App\Models\Category;
use App\Models\Edition;
use App\Models\EditionTitle;
use App\Models\MediaAsset;
use App\Models\Participant;
use App\Models\ParticipantAchievement;
use App\Models\ParticipantMedia;
use App\Models\ParticipantSocialLink;
use App\Models\SelectionStage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ParticipantProfileFoundationTest extends TestCase
{
    use RefreshDatabase;

    public function test_participant_profile_relations_are_scoped_and_ordered(): void
    {
        $edition = Edition::factory()->create();
        $category = Category::factory()->for($edition)->create();
        $stage = SelectionStage::factory()->for($edition)->create();
        $participant = Participant::factory()
            ->for($edition)
            ->for($category)
            ->for($stage, 'currentStage')
            ->create();
        $firstTitle = EditionTitle::factory()->for($edition)->create([
            'name' => 'Mojang Pinilih',
            'display_order' => 1,
        ]);
        $secondTitle = EditionTitle::factory()->for($edition)->create([
            'name' => 'Mojang Intelegensia',
            'display_order' => 2,
        ]);
        $closeup = MediaAsset::factory()->create([
            'url' => '/participants/contoh-closeup.webp',
            'lifecycle' => 'ready',
        ]);

        ParticipantAchievement::factory()->for($participant)->create([
            'text' => 'Juara dua pidato tingkat kabupaten.',
            'display_order' => 2,
        ]);
        ParticipantAchievement::factory()->for($participant)->create([
            'text' => 'Duta budaya sekolah.',
            'display_order' => 1,
        ]);
        ParticipantSocialLink::factory()->for($participant)->create([
            'platform' => SocialPlatform::Instagram,
        ]);
        ParticipantMedia::factory()->for($participant)->for($closeup, 'mediaAsset')->create([
            'role' => ParticipantMediaRole::Closeup,
        ]);
        $participant->titles()->attach($secondTitle, ['assigned_at' => now()]);
        $participant->titles()->attach($firstTitle, ['assigned_at' => now()]);

        $participant->load(['achievements', 'socialLinks', 'media.mediaAsset', 'titles']);

        $this->assertSame(['Duta budaya sekolah.', 'Juara dua pidato tingkat kabupaten.'], $participant->achievements->pluck('text')->all());
        $this->assertSame(SocialPlatform::Instagram, $participant->socialLinks->first()->platform);
        $this->assertSame('/participants/contoh-closeup.webp', $participant->media->first()->mediaAsset->url);
        $this->assertSame(['Mojang Pinilih', 'Mojang Intelegensia'], $participant->titles->pluck('name')->values()->all());
        $this->assertTrue($participant->category->is($category));
        $this->assertTrue($participant->edition->is($edition));
    }
}

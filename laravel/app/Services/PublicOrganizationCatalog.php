<?php

namespace App\Services;

use App\Models\OrganizationAssignment;
use Illuminate\Support\Facades\Schema;

final class PublicOrganizationCatalog
{
    /**
     * @return array{leadership: list<array{name: string, position: string, image: string, gender: string}>, pastLeaders: list<array{name: string, position: string, image: string, gender: string}>}
     */
    public static function snapshot(): array
    {
        return [
            'leadership' => [
                ['name' => 'Cecep Safaatul Barkah', 'position' => 'Ketua Dewan Pengawas', 'image' => '/pengurus/Cecep Safaatul Barkah.png', 'gender' => 'L'],
                ['name' => 'Kiki Syarief', 'position' => 'Dewan Pengawas I', 'image' => '/pengurus/Kiki Syarief.png', 'gender' => 'L'],
                ['name' => 'Muhammad Khaerul', 'position' => 'Dewan Pengawas II', 'image' => '/pengurus/Muhammad Khaerul.png', 'gender' => 'L'],
                ['name' => 'Nurman Purnama Gumilar', 'position' => 'Ketua Umum', 'image' => '/pengurus/Nurman Purnama Gumilar.png', 'gender' => 'L'],
                ['name' => 'Salawat Fatih Ibrahim', 'position' => 'Wakil Ketua I', 'image' => '/pengurus/Salawat Fatih Ibrahim.png', 'gender' => 'L'],
                ['name' => 'Yudhan Triyana', 'position' => 'Wakil Ketua II', 'image' => '/pengurus/Yudhan Triyana.png', 'gender' => 'L'],
                ['name' => 'Syahril', 'position' => 'Sekretaris Umum', 'image' => '/pengurus/Syahril.png', 'gender' => 'L'],
                ['name' => 'C Allifiana Fadhilah Jasmine', 'position' => 'Wakil Sekretaris', 'image' => '/pengurus/C Allifiana Fadhilah Jasmine.png', 'gender' => 'P'],
                ['name' => 'Rian Nurdiansyah', 'position' => 'Bendahara Umum', 'image' => '/pengurus/Rian Nurdiansyah.png', 'gender' => 'L'],
                ['name' => 'Zalfa Fadhilah', 'position' => 'Wakil Bendahara', 'image' => '/pengurus/Zalfa Fadhilah.png', 'gender' => 'P'],
                ['name' => 'Moch Adval Ginalingga Darmawan', 'position' => 'Kepala Bidang Penelitian dan Pengembangan', 'image' => '/pengurus/Moch Adval Ginalingga Darmawan.png', 'gender' => 'L'],
                ['name' => 'Gina Listya Nuraini', 'position' => 'Kepala Bidang Pengadaan Sumber Daya Organisasi', 'image' => '/pengurus/Gina Listya Nuraini.png', 'gender' => 'P'],
                ['name' => 'Roby Akhmad Akbari Santoso', 'position' => 'Kepala Bidang Hubungan Masyarakat', 'image' => '/pengurus/Roby Akhmad Akbari Santoso.png', 'gender' => 'L'],
                ['name' => 'Gumilang M Khotib', 'position' => 'Bidang Kreatif & Media Sosial', 'image' => '/pengurus/Gumilang M Khotib.png', 'gender' => 'L'],
                ['name' => 'Riana Ahsan', 'position' => 'Bidang Kreatif & Media Sosial', 'image' => '/pengurus/Riana Ahsan.png', 'gender' => 'L'],
                ['name' => 'Mochamad Haiqal Aditia Pratama', 'position' => 'Kepala Bidang Ekonomi Kreatif', 'image' => '/pengurus/Mochamad Haiqal Aditia Pratama.png', 'gender' => 'L'],
            ],
            'pastLeaders' => [
                ['name' => 'Cecep Safaatul Barkah', 'position' => '2008-2013', 'image' => '/ketua/Cecep Safaatul Barkah.png', 'gender' => 'L'],
                ['name' => 'Teguh Ramadhan', 'position' => '2013-2016', 'image' => '/ketua/Teguh Ramadhan.png', 'gender' => 'L'],
                ['name' => 'Yesi Haerunisa', 'position' => '2016-2019', 'image' => '/ketua/Yesi Haerunisa.png', 'gender' => 'P'],
                ['name' => 'Isnat Ahmad Zulfaqor', 'position' => '2019-2021', 'image' => '/ketua/Isnat Ahmad Zulfaqor.png', 'gender' => 'L'],
                ['name' => 'Nurman Purnama Gumilar', 'position' => '2021-Sekarang', 'image' => '/ketua/Nurman Purnama Gumilar.png', 'gender' => 'L'],
            ],
        ];
    }

    /**
     * @return array{leadership: list<array{name: string, position: string, image: string, gender: string}>, pastLeaders: list<array{name: string, position: string, image: string, gender: string}>}
     */
    public function about(): array
    {
        if (! $this->tablesExist()) {
            return self::snapshot();
        }

        $assignments = OrganizationAssignment::query()
            ->with('person.portraitMedia')
            ->whereNull('edition_id')
            ->where('active', true)
            ->whereIn('group', ['leadership', 'past_leaders'])
            ->orderBy('display_order')
            ->orderBy('id')
            ->get();

        $leadership = $assignments
            ->where('group', 'leadership')
            ->map(fn (OrganizationAssignment $assignment): ?array => $this->present($assignment))
            ->filter()
            ->values()
            ->all();
        $pastLeaders = $assignments
            ->where('group', 'past_leaders')
            ->map(fn (OrganizationAssignment $assignment): ?array => $this->present($assignment))
            ->filter()
            ->values()
            ->all();

        if (count($leadership) !== 16 || count($pastLeaders) !== 5) {
            return self::snapshot();
        }

        return [
            'leadership' => $leadership,
            'pastLeaders' => $pastLeaders,
        ];
    }

    private function tablesExist(): bool
    {
        return Schema::hasTable('people')
            && Schema::hasTable('organization_assignments')
            && Schema::hasTable('media_assets');
    }

    /**
     * @return array{name: string, position: string, image: string, gender: string}|null
     */
    private function present(OrganizationAssignment $assignment): ?array
    {
        $person = $assignment->person;
        $portrait = $person?->portraitMedia;

        if ($person === null || $portrait === null || $portrait->lifecycle !== 'ready') {
            return null;
        }

        if (! in_array($person->gender, ['L', 'P'], true)) {
            return null;
        }

        return [
            'name' => $person->name,
            'position' => $assignment->title,
            'image' => $portrait->url,
            'gender' => $person->gender,
        ];
    }
}

<?php

namespace App\Services;

final class PublicEventCatalog
{
    /**
     * @var array<string, array{label: string, description: string}>
     */
    private const EVENTS = [
        'audisi' => [
            'label' => 'Audisi',
            'description' => 'Proses seleksi awal yang meliputi 3 tahapan seleksi. Tahapan pertama, peserta melakukan tes tulis sebanyak 100 soal kemudian peserta disaring menjadi 64 besar.',
        ],
        'semifinal' => [
            'label' => 'Semifinal',
            'description' => 'Pembekalan materi umum kepada peserta dari pemateri pilihan. Berdasarkan nilai keaktifan beserta hasil interview peserta akan kembali diseleksi untuk kemudian diambil 44 calon Mojang dan Jajaka tercocok.',
        ],
        'karantina' => [
            'label' => 'Karantina',
            'description' => 'Proses pembinaan karakter agar dapat menanamkan nilai-nilai Ki Sunda, serta memberikan materi berkenaan dengan pariwisata, kebudayaan, ekonomi kreatif, public speaking, dan personal branding.',
        ],
        'unjuk-kabisa' => [
            'label' => 'Unjuk Kabisa',
            'description' => 'Proses penilaian kemahiran atau bakat para finalis dalam bentuk kesenian yang berkarakter Sunda. Unjuk kabisa disaksikan oleh masyarakat umum dan dinilai langsung oleh dewan juri yang berkompeten dengan format penilaian tertulis.',
        ],
        'gala-dinner' => [
            'label' => 'Gala Dinner',
            'description' => 'Peserta akan mengikuti acara makan malam dalam suasana elegan dan eksklusif sebagai bentuk penerapan pribadi yang beretika, menaati norma, dan aturan tidak tertulis yang berlaku.',
        ],
        'grand-final' => [
            'label' => 'Grand Final',
            'description' => 'Puncak dari rangkaian Pasanggiri Mojang Jajaka Kabupaten Garut Tahun 2025. Finalis dengan nilai dan penampilan terbaik akan dipilih dan dinobatkan sebagai Mojang dan Jajaka Pinilih Kabupaten Garut tahun 2025 serta gelar kategori lainnya.',
        ],
    ];

    /**
     * @var list<string>
     */
    private const SPONSORS = [
        'Abie Kebaya.png',
        'ADAWY.png',
        'Adho Wedding.png',
        'ARFAZ.png',
        'art by kiki syarief.png',
        'ASKARA WEDDING.png',
        'ASTIGA.png',
        'BALDY.png',
        'BANK BJB.png',
        'BASO ACI ACAY.png',
        'BNI.png',
        'CASANDRA.png',
        'CHOCODOT.png',
        'COKUSI.png',
        'COLLEGA.png',
        'CORELLIA.png',
        'DANNY DECOR.png',
        'DARMAYANTI.png',
        'DODOL PICNIC.png',
        'ELLEANORS.png',
        'ETERNALS.png',
        'EZHAR.png',
        'FASHIONAJA.png',
        'FITRI SIFO.png',
        'GOAH GUMELAR.png',
        'GRAHA WEDDING.png',
        'GRISELLA MAKE UP.png',
        'GULA PADI.png',
        'happybooth.id.png',
        'HARMONI.png',
        'HENDY SAMUDRO.png',
        'Historia.png',
        'Imamsyah Wedding.png',
        'IPANG MAKE UP.png',
        'JANDIKA WEDDING.png',
        'JM GROUP.png',
        'judit.png',
        'KHOLIK MAHENDRA.png',
        'KINAYUNG FLORIST.png',
        'LARIN.png',
        'LAVIOSA.png',
        'LED BANDUNG.png',
        'MAHESWARY MANAGEMENT.png',
        'MAHOGANY.png',
        'MASAGI OUTBOUND.png',
        'MAXIMUSA.png',
        'MINI COFFEE.png',
        'MONNIQUIN.png',
        'Nissin.png',
        'nyentrik CLear.png',
        'ONIE RONNIE.png',
        'PDAM.png',
        'PRIMARY ENGLISH.png',
        'RATTU WEDDING.png',
        'RESTORASA.png',
        'REVIE.png',
        'RHEKZA.png',
        'SALMA NONON.png',
        'SAWARGI PHOTOBOOTH.png',
        'SHYMPHONY.png',
        'SOPIK PERMANA.png',
        'SYAR_I BEAUTY CARE .png',
        'TOKO MAS SINAR MT.png',
        'UDENDI.png',
        'UDIL KUDIL.png',
        'Uniga.png',
        'VIRERA ALAM SUTRA.png',
        'Visual Space.png',
    ];

    /**
     * @return array<string, mixed>|null
     */
    public function detail(string $slug): ?array
    {
        $event = self::EVENTS[$slug] ?? null;

        if ($event === null) {
            return null;
        }

        $images = array_map(
            static fn (int $number): string => "/rangkaian-kegiatan/{$slug}/{$number}.webp",
            range(1, 10),
        );

        $sponsors = array_map(
            static fn (string $filename): array => [
                'name' => pathinfo($filename, PATHINFO_FILENAME),
                'image' => "/sponsors/{$filename}",
            ],
            self::SPONSORS,
        );

        return [
            'meta' => [
                'title' => "{$event['label']} | Rangkaian Kegiatan | MOKA Garut",
                'description' => "Dokumentasi {$event['label']} pada rangkaian Pasanggiri Mojang Jajaka Kabupaten Garut 2025.",
            ],
            'pageTitle' => $event['label'],
            'event' => [
                'slug' => $slug,
                'label' => $event['label'],
                'description' => $event['description'],
                'images' => $images,
            ],
            'sponsors' => $sponsors,
            'emptyState' => 'Dokumentasi kegiatan sedang disiapkan.',
        ];
    }
}

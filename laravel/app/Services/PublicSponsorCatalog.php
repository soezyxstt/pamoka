<?php

namespace App\Services;

use App\Models\Edition;
use App\Models\Sponsor;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Schema;

final class PublicSponsorCatalog
{
    /**
     * @var list<array{name: string, image: string}>
     */
    private const SNAPSHOT = [
        ['name' => 'Abie Kebaya', 'image' => '/sponsors/Abie Kebaya.png'],
        ['name' => 'ADAWY', 'image' => '/sponsors/ADAWY.png'],
        ['name' => 'Adho Wedding', 'image' => '/sponsors/Adho Wedding.png'],
        ['name' => 'ARFAZ', 'image' => '/sponsors/ARFAZ.png'],
        ['name' => 'art by kiki syarief', 'image' => '/sponsors/art by kiki syarief.png'],
        ['name' => 'ASKARA WEDDING', 'image' => '/sponsors/ASKARA WEDDING.png'],
        ['name' => 'ASTIGA', 'image' => '/sponsors/ASTIGA.png'],
        ['name' => 'BALDY', 'image' => '/sponsors/BALDY.png'],
        ['name' => 'BANK BJB', 'image' => '/sponsors/BANK BJB.png'],
        ['name' => 'BASO ACI ACAY', 'image' => '/sponsors/BASO ACI ACAY.png'],
        ['name' => 'BNI', 'image' => '/sponsors/BNI.png'],
        ['name' => 'CASANDRA', 'image' => '/sponsors/CASANDRA.png'],
        ['name' => 'CHOCODOT', 'image' => '/sponsors/CHOCODOT.png'],
        ['name' => 'COKUSI', 'image' => '/sponsors/COKUSI.png'],
        ['name' => 'COLLEGA', 'image' => '/sponsors/COLLEGA.png'],
        ['name' => 'CORELLIA', 'image' => '/sponsors/CORELLIA.png'],
        ['name' => 'DANNY DECOR', 'image' => '/sponsors/DANNY DECOR.png'],
        ['name' => 'DARMAYANTI', 'image' => '/sponsors/DARMAYANTI.png'],
        ['name' => 'DODOL PICNIC', 'image' => '/sponsors/DODOL PICNIC.png'],
        ['name' => 'ELLEANORS', 'image' => '/sponsors/ELLEANORS.png'],
        ['name' => 'ETERNALS', 'image' => '/sponsors/ETERNALS.png'],
        ['name' => 'EZHAR', 'image' => '/sponsors/EZHAR.png'],
        ['name' => 'FASHIONAJA', 'image' => '/sponsors/FASHIONAJA.png'],
        ['name' => 'FITRI SIFO', 'image' => '/sponsors/FITRI SIFO.png'],
        ['name' => 'GOAH GUMELAR', 'image' => '/sponsors/GOAH GUMELAR.png'],
        ['name' => 'GRAHA WEDDING', 'image' => '/sponsors/GRAHA WEDDING.png'],
        ['name' => 'GRISELLA MAKE UP', 'image' => '/sponsors/GRISELLA MAKE UP.png'],
        ['name' => 'GULA PADI', 'image' => '/sponsors/GULA PADI.png'],
        ['name' => 'happybooth.id', 'image' => '/sponsors/happybooth.id.png'],
        ['name' => 'HARMONI', 'image' => '/sponsors/HARMONI.png'],
        ['name' => 'HENDY SAMUDRO', 'image' => '/sponsors/HENDY SAMUDRO.png'],
        ['name' => 'Historia', 'image' => '/sponsors/Historia.png'],
        ['name' => 'Imamsyah Wedding', 'image' => '/sponsors/Imamsyah Wedding.png'],
        ['name' => 'IPANG MAKE UP', 'image' => '/sponsors/IPANG MAKE UP.png'],
        ['name' => 'JANDIKA WEDDING', 'image' => '/sponsors/JANDIKA WEDDING.png'],
        ['name' => 'JM GROUP', 'image' => '/sponsors/JM GROUP.png'],
        ['name' => 'judit', 'image' => '/sponsors/judit.png'],
        ['name' => 'KHOLIK MAHENDRA', 'image' => '/sponsors/KHOLIK MAHENDRA.png'],
        ['name' => 'KINAYUNG FLORIST', 'image' => '/sponsors/KINAYUNG FLORIST.png'],
        ['name' => 'LARIN', 'image' => '/sponsors/LARIN.png'],
        ['name' => 'LAVIOSA', 'image' => '/sponsors/LAVIOSA.png'],
        ['name' => 'LED BANDUNG', 'image' => '/sponsors/LED BANDUNG.png'],
        ['name' => 'MAHESWARY MANAGEMENT', 'image' => '/sponsors/MAHESWARY MANAGEMENT.png'],
        ['name' => 'MAHOGANY', 'image' => '/sponsors/MAHOGANY.png'],
        ['name' => 'MASAGI OUTBOUND', 'image' => '/sponsors/MASAGI OUTBOUND.png'],
        ['name' => 'MAXIMUSA', 'image' => '/sponsors/MAXIMUSA.png'],
        ['name' => 'MINI COFFEE', 'image' => '/sponsors/MINI COFFEE.png'],
        ['name' => 'MONNIQUIN', 'image' => '/sponsors/MONNIQUIN.png'],
        ['name' => 'Nissin', 'image' => '/sponsors/Nissin.png'],
        ['name' => 'nyentrik CLear', 'image' => '/sponsors/nyentrik CLear.png'],
        ['name' => 'ONIE RONNIE', 'image' => '/sponsors/ONIE RONNIE.png'],
        ['name' => 'PDAM', 'image' => '/sponsors/PDAM.png'],
        ['name' => 'PRIMARY ENGLISH', 'image' => '/sponsors/PRIMARY ENGLISH.png'],
        ['name' => 'RATTU WEDDING', 'image' => '/sponsors/RATTU WEDDING.png'],
        ['name' => 'RESTORASA', 'image' => '/sponsors/RESTORASA.png'],
        ['name' => 'REVIE', 'image' => '/sponsors/REVIE.png'],
        ['name' => 'RHEKZA', 'image' => '/sponsors/RHEKZA.png'],
        ['name' => 'SALMA NONON', 'image' => '/sponsors/SALMA NONON.png'],
        ['name' => 'SAWARGI PHOTOBOOTH', 'image' => '/sponsors/SAWARGI PHOTOBOOTH.png'],
        ['name' => 'SHYMPHONY', 'image' => '/sponsors/SHYMPHONY.png'],
        ['name' => 'SOPIK PERMANA', 'image' => '/sponsors/SOPIK PERMANA.png'],
        ['name' => 'SYAR_I BEAUTY CARE', 'image' => '/sponsors/SYAR_I BEAUTY CARE .png'],
        ['name' => 'TOKO MAS SINAR MT', 'image' => '/sponsors/TOKO MAS SINAR MT.png'],
        ['name' => 'UDENDI', 'image' => '/sponsors/UDENDI.png'],
        ['name' => 'UDIL KUDIL', 'image' => '/sponsors/UDIL KUDIL.png'],
        ['name' => 'Uniga', 'image' => '/sponsors/Uniga.png'],
        ['name' => 'VIRERA ALAM SUTRA', 'image' => '/sponsors/VIRERA ALAM SUTRA.png'],
        ['name' => 'Visual Space', 'image' => '/sponsors/Visual Space.png'],
    ];

    /**
     * @return list<array{name: string, image: string}>
     */
    public function featured(): array
    {
        $edition = Edition::query()
            ->where('lifecycle', 'active')
            ->orderByDesc('year')
            ->first();

        if ($edition !== null && Schema::hasTable('sponsors')) {
            $sponsors = Sponsor::query()
                ->with('logoMedia')
                ->where('edition_id', $edition->id)
                ->where('active', true)
                ->whereHas('logoMedia', fn (Builder $query): Builder => $query->where('lifecycle', 'ready'))
                ->orderBy('display_order')
                ->orderBy('id')
                ->get();

            if ($sponsors->isNotEmpty()) {
                return $sponsors
                    ->map(fn (Sponsor $sponsor): array => [
                        'name' => $sponsor->name,
                        'image' => $sponsor->logoMedia?->url ?? '/finalis/hero.webp',
                    ])
                    ->values()
                    ->all();
            }
        }

        return self::SNAPSHOT;
    }

    /**
     * @return list<array{name: string, image: string}>
     */
    public static function snapshot(): array
    {
        return self::SNAPSHOT;
    }
}

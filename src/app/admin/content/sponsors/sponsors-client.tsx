"use client";

import {
  Building2,
  CheckCircle2,
  Edit2,
  ExternalLink,
  Filter,
  Globe,
  Handshake,
  Loader2,
  Plus,
  Power,
  PowerOff,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";
import Image from "next/image";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  AdminButton,
  AdminCard,
  AdminEmptyState,
  AdminField,
  AdminInput,
  AdminSelect,
} from "@/components/admin/primitives";
import { AdminMediaField, type MediaAssetSummary } from "@/components/admin/media-picker";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  createSponsorAction,
  deleteSponsorAction,
  SPONSOR_TIERS,
  type SponsorTier,
  toggleSponsorActiveAction,
  updateSponsorAction,
} from "./actions";

export type SponsorWithAsset = {
  id: string;
  editionId: string;
  name: string;
  tier: SponsorTier;
  website: string | null;
  logoMediaId: string | null;
  displayOrder: number;
  active: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date | null;
  logoAsset: MediaAssetSummary | null;
};

export type SponsorsClientProps = {
  edition: {
    id: string;
    year: number;
    name: string;
    lifecycle: string;
  };
  initialSponsors: SponsorWithAsset[];
  canEdit?: boolean;
  canPublish?: boolean;
  canManageMedia?: boolean;
};

export function getTierBadgeStyle(tier: SponsorTier) {
  switch (tier) {
    case "utama":
      return "border-amber-300 bg-amber-50 text-amber-900 font-semibold";
    case "pendukung":
      return "border-emerald-300 bg-emerald-50 text-emerald-900 font-medium";
    case "pendamping":
      return "border-sky-300 bg-sky-50 text-sky-900 font-medium";
    case "pelengkap":
      return "border-stone-300 bg-stone-100 text-stone-800 font-medium";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

export function SponsorsClient({
  edition,
  initialSponsors,
  canEdit = true,
  canPublish = true,
  canManageMedia = true,
}: SponsorsClientProps) {
  const [sponsors, setSponsors] = useState<SponsorWithAsset[]>(initialSponsors);
  const [isPending, startTransition] = useTransition();

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("semua");
  const [statusFilter, setStatusFilter] = useState<string>("semua");

  // Sheet Modal state
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingSponsor, setEditingSponsor] = useState<SponsorWithAsset | null>(null);

  // Form input state
  const [formName, setFormName] = useState("");
  const [formTier, setFormTier] = useState<SponsorTier>("utama");
  const [formWebsite, setFormWebsite] = useState("");
  const [formDisplayOrder, setFormDisplayOrder] = useState<number>(0);
  const [formActive, setFormActive] = useState<boolean>(true);
  const [formLogoAsset, setFormLogoAsset] = useState<MediaAssetSummary | null>(null);

  // Delete dialog state
  const [deletingSponsor, setDeletingSponsor] = useState<SponsorWithAsset | null>(null);

  // Sync initial props
  const [prevInitial, setPrevInitial] = useState(initialSponsors);
  if (initialSponsors !== prevInitial) {
    setPrevInitial(initialSponsors);
    setSponsors(initialSponsors);
  }

  // Filtered sponsors
  const filteredSponsors = useMemo(() => {
    return sponsors.filter((s) => {
      const matchSearch =
        searchQuery.trim() === "" ||
        s.name.toLowerCase().includes(searchQuery.toLowerCase().trim());
      const matchTier = tierFilter === "semua" || s.tier === tierFilter;
      const matchStatus =
        statusFilter === "semua" ||
        (statusFilter === "aktif" && s.active) ||
        (statusFilter === "nonaktif" && !s.active);

      return matchSearch && matchTier && matchStatus;
    });
  }, [sponsors, searchQuery, tierFilter, statusFilter]);

  const openCreateSheet = () => {
    setEditingSponsor(null);
    setFormName("");
    setFormTier("utama");
    setFormWebsite("");
    // Default display order to next sequence
    const nextOrder = sponsors.length > 0 ? Math.max(...sponsors.map((s) => s.displayOrder)) + 1 : 0;
    setFormDisplayOrder(nextOrder);
    setFormActive(canPublish);
    setFormLogoAsset(null);
    setIsSheetOpen(true);
  };

  const openEditSheet = (sponsor: SponsorWithAsset) => {
    setEditingSponsor(sponsor);
    setFormName(sponsor.name);
    setFormTier(sponsor.tier);
    setFormWebsite(sponsor.website ?? "");
    setFormDisplayOrder(sponsor.displayOrder);
    setFormActive(sponsor.active);
    setFormLogoAsset(sponsor.logoAsset);
    setIsSheetOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error("Nama sponsor wajib diisi");
      return;
    }

    const formData = new FormData();
    formData.set("name", formName.trim());
    formData.set("tier", formTier);
    if (formWebsite.trim()) {
      formData.set("website", formWebsite.trim());
    }
    if (formLogoAsset?.id) {
      formData.set("logoMediaId", formLogoAsset.id);
    }
    formData.set("displayOrder", String(formDisplayOrder));
    formData.set("active", formActive ? "true" : "false");

    if (editingSponsor) {
      formData.set("id", editingSponsor.id);
      formData.set("version", String(editingSponsor.version));
      startTransition(async () => {
        try {
          await updateSponsorAction(formData);
          toast.success(`Sponsor "${formName}" berhasil diperbarui`);
          setIsSheetOpen(false);
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Gagal memperbarui sponsor");
        }
      });
    } else {
      startTransition(async () => {
        try {
          await createSponsorAction(formData);
          toast.success(`Sponsor "${formName}" berhasil ditambahkan`);
          setIsSheetOpen(false);
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Gagal menambahkan sponsor");
        }
      });
    }
  };

  const handleToggleActive = (sponsor: SponsorWithAsset) => {
    if (!canPublish && !sponsor.active) {
      toast.error("Izin penayangan konten (content.publish) diperlukan untuk mengaktifkan sponsor");
      return;
    }

    const formData = new FormData();
    formData.set("id", sponsor.id);

    startTransition(async () => {
      try {
        await toggleSponsorActiveAction(formData);
        toast.success(
          `Sponsor "${sponsor.name}" ${sponsor.active ? "dinonaktifkan" : "diaktifkan"}`
        );
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Gagal mengubah status sponsor");
      }
    });
  };

  const handleDelete = () => {
    if (!deletingSponsor) return;
    const sponsorToDelete = deletingSponsor;

    const formData = new FormData();
    formData.set("id", sponsorToDelete.id);

    startTransition(async () => {
      try {
        await deleteSponsorAction(formData);
        toast.success(`Sponsor "${sponsorToDelete.name}" berhasil dihapus`);
        setDeletingSponsor(null);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Gagal menghapus sponsor");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Filter and Actions Bar */}
      <AdminCard>
        <div className="p-4 sm:p-6 space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-montserrat text-lg font-semibold text-foreground">
                Daftar Sponsor ({filteredSponsors.length}{" "}
                {filteredSponsors.length !== sponsors.length ? `dari ${sponsors.length}` : ""})
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Kelola mitra pendukung dan tingkat sponsorship untuk {edition.name} ({edition.year}).
              </p>
            </div>
            {canEdit ? (
              <AdminButton
                type="button"
                onClick={openCreateSheet}
                className="w-full sm:w-auto"
              >
                <Plus size={16} /> Tambah sponsor
              </AdminButton>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <AdminInput
                type="text"
                placeholder="Cari nama sponsor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Tier Filter */}
            <div className="flex items-center gap-2">
              <Filter className="size-4 text-muted-foreground shrink-0" />
              <AdminSelect
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value)}
              >
                <option value="semua">Semua tier</option>
                {SPONSOR_TIERS.map((tier) => (
                  <option key={tier} value={tier}>
                    Tier {tier}
                  </option>
                ))}
              </AdminSelect>
            </div>

            {/* Status Filter */}
            <div>
              <AdminSelect
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="semua">Semua status</option>
                <option value="aktif">Hanya aktif</option>
                <option value="nonaktif">Hanya nonaktif</option>
              </AdminSelect>
            </div>
          </div>
        </div>
      </AdminCard>

      {/* Sponsors List / Table */}
      {filteredSponsors.length === 0 ? (
        <AdminCard>
          <div className="p-8 space-y-4">
            <AdminEmptyState
              icon="sparkles"
              title={
                sponsors.length === 0
                  ? "Belum ada sponsor terdaftar"
                  : "Tidak ada sponsor yang sesuai"
              }
              description={
                sponsors.length === 0
                  ? "Tambahkan sponsor pertama untuk edisi ini dengan menekan tombol Tambah sponsor di atas."
                  : "Coba sesuaikan kata kunci pencarian atau filter tier dan status."
              }
            />
            {sponsors.length === 0 && canEdit ? (
              <div className="flex justify-center">
                <AdminButton type="button" onClick={openCreateSheet}>
                  <Plus size={16} /> Tambah sponsor
                </AdminButton>
              </div>
            ) : null}
          </div>
        </AdminCard>
      ) : (
        <AdminCard>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/40 font-montserrat text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-3.5 pl-4 pr-3 sm:pl-6">Logo</th>
                  <th className="px-3 py-3.5">Nama sponsor</th>
                  <th className="px-3 py-3.5">Tier</th>
                  <th className="px-3 py-3.5">Website</th>
                  <th className="px-3 py-3.5 text-center">Urutan</th>
                  <th className="px-3 py-3.5 text-center">Status</th>
                  <th className="py-3.5 pl-3 pr-4 text-right sm:pr-6">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredSponsors.map((sponsor) => (
                  <tr
                    key={sponsor.id}
                    className="transition-colors hover:bg-muted/30"
                  >
                    {/* Thumbnail Logo */}
                    <td className="py-4 pl-4 pr-3 sm:pl-6">
                      <div className="relative flex size-14 items-center justify-center rounded-lg border border-border bg-white p-1.5 shadow-2xs">
                        {sponsor.logoAsset?.url ? (
                          <Image
                            src={sponsor.logoAsset.url}
                            alt={sponsor.logoAsset.alt || sponsor.name}
                            width={56}
                            height={56}
                            className="size-full object-contain"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-muted-foreground">
                            <Building2 className="size-5 text-muted-foreground/60" />
                            <span className="text-[9px] font-semibold text-muted-foreground/80 mt-0.5">
                              No logo
                            </span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Name */}
                    <td className="px-3 py-4">
                      <div className="font-montserrat font-semibold text-foreground text-sm">
                        {sponsor.name}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Versi {sponsor.version}
                      </div>
                    </td>

                    {/* Tier */}
                    <td className="px-3 py-4">
                      <span
                        className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs capitalize ${getTierBadgeStyle(
                          sponsor.tier
                        )}`}
                      >
                        {sponsor.tier}
                      </span>
                    </td>

                    {/* Website */}
                    <td className="px-3 py-4">
                      {sponsor.website ? (
                        <a
                          href={sponsor.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-dgb hover:underline max-w-[180px] truncate"
                          title={sponsor.website}
                        >
                          <Globe className="size-3.5 shrink-0" />
                          <span className="truncate">
                            {sponsor.website.replace(/^https?:\/\//, "")}
                          </span>
                          <ExternalLink className="size-3 shrink-0 opacity-70" />
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>

                    {/* Display Order */}
                    <td className="px-3 py-4 text-center">
                      <span className="inline-flex size-6 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
                        {sponsor.displayOrder}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-3 py-4 text-center">
                      {sponsor.active ? (
                        <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
                          <CheckCircle2 className="size-3 text-emerald-600" />
                          Aktif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md border border-stone-200 bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">
                          <XCircle className="size-3 text-stone-500" />
                          Nonaktif
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-4 pl-3 pr-4 text-right sm:pr-6">
                      <div className="flex items-center justify-end gap-1.5">
                        {canEdit ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openEditSheet(sponsor)}
                            disabled={isPending}
                            className="h-8 px-2 text-xs border-border hover:bg-muted"
                            title="Edit sponsor"
                          >
                            <Edit2 className="size-3.5 mr-1" />
                            Edit
                          </Button>
                        ) : null}

                        {canPublish || canEdit ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleActive(sponsor)}
                            disabled={isPending}
                            className={`h-8 px-2 text-xs ${
                              sponsor.active
                                ? "text-amber-700 hover:bg-amber-50 hover:text-amber-800 border-amber-200"
                                : "text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 border-emerald-200"
                            }`}
                            title={
                              sponsor.active ? "Nonaktifkan sponsor" : "Aktifkan sponsor"
                            }
                          >
                            {sponsor.active ? (
                              <>
                                <PowerOff className="size-3.5 mr-1" />
                                Nonaktifkan
                              </>
                            ) : (
                              <>
                                <Power className="size-3.5 mr-1" />
                                Aktifkan
                              </>
                            )}
                          </Button>
                        ) : null}

                        {canEdit ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setDeletingSponsor(sponsor)}
                            disabled={isPending}
                            className="h-8 px-2 text-xs text-destructive hover:bg-rose-50 hover:text-destructive border-rose-200"
                            title="Hapus sponsor"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminCard>
      )}

      {/* Sheet Form: Tambah / Edit Sponsor */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="sm:max-w-xl md:max-w-2xl w-full flex flex-col p-0 overflow-hidden">
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border bg-muted/20">
            <SheetTitle className="font-montserrat text-lg font-bold text-foreground">
              {editingSponsor ? "Edit Sponsor" : "Tambah Sponsor Baru"}
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground">
              {editingSponsor
                ? `Perbarui data partner untuk edisi ${edition.name} (${edition.year}).`
                : `Partner baru akan otomatis terhubung ke edisi ${edition.name} (${edition.year}).`}
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleFormSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
              {/* Active Edition Notice */}
              <div className="rounded-lg border-l-3 border-dgb bg-dgb-50/60 p-3 text-xs">
                <p className="text-muted-foreground">Konteks edisi aktif</p>
                <p className="font-montserrat font-semibold text-dgb-900 mt-0.5">
                  {edition.name} ({edition.year})
                </p>
              </div>

              {/* Sponsor Name */}
              <AdminField label="Nama sponsor *">
                <AdminInput
                  name="name"
                  placeholder="Contoh: Bank BJB Cabang Garut"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                />
              </AdminField>

              {/* Tier Selection */}
              <AdminField label="Tier sponsorship *">
                <AdminSelect
                  name="tier"
                  value={formTier}
                  onChange={(e) => setFormTier(e.target.value as SponsorTier)}
                >
                  {SPONSOR_TIERS.map((tier) => (
                    <option key={tier} value={tier}>
                      {tier === "utama"
                        ? "Utama (Tier 1)"
                        : tier === "pendukung"
                        ? "Pendukung (Tier 2)"
                        : tier === "pendamping"
                        ? "Pendamping (Tier 3)"
                        : "Pelengkap (Tier 4)"}
                    </option>
                  ))}
                </AdminSelect>
              </AdminField>

              {/* Logo Media Picker */}
              <AdminField label="Logo sponsor">
                <AdminMediaField
                  name="logoMediaId"
                  hint="Unggah file logo PNG, SVG, atau WebP dengan rasio proporsional."
                  aspectRatioHint="Bebas"
                  initialAsset={formLogoAsset}
                  onChange={(asset) => setFormLogoAsset(asset)}
                  activeEditionId={edition.id}
                  canManageMedia={canManageMedia}
                />
              </AdminField>

              {/* Website URL */}
              <AdminField label="Tautan website (opsional)">
                <AdminInput
                  name="website"
                  type="url"
                  placeholder="https://contoh-sponsor.co.id"
                  value={formWebsite}
                  onChange={(e) => setFormWebsite(e.target.value)}
                />
              </AdminField>

              {/* Display Order */}
              <AdminField label="Urutan tampil">
                <AdminInput
                  name="displayOrder"
                  type="number"
                  min={0}
                  value={formDisplayOrder}
                  onChange={(e) => setFormDisplayOrder(Number(e.target.value))}
                />
              </AdminField>

              {/* Active Status */}
              <div className="rounded-lg border border-border p-3.5 bg-muted/20 space-y-2">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    name="active"
                    checked={formActive}
                    onChange={(e) => setFormActive(e.target.checked)}
                    disabled={!canPublish}
                    className="size-4 rounded border-border text-dgb focus:ring-dgb"
                  />
                  <span className="text-xs font-semibold text-foreground">
                    Tayangkan sponsor ini secara aktif
                  </span>
                </label>
                {!canPublish ? (
                  <p className="text-[11px] text-muted-foreground ml-6.5">
                    Hanya pengguna dengan izin penerbitan (content.publish) yang dapat mengaktifkan sponsor.
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground ml-6.5">
                    Sponsor aktif akan langsung dapat ditampilkan pada landing page dan rangkaian acara.
                  </p>
                )}
              </div>

              {/* Live Preview Card */}
              <div className="space-y-2 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <span className="font-montserrat text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Live Preview Kartu Sponsor
                  </span>
                  <span
                    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] capitalize ${getTierBadgeStyle(
                      formTier
                    )}`}
                  >
                    Tier {formTier}
                  </span>
                </div>

                <div className="rounded-xl border border-dgb-200/80 bg-linear-to-br from-white via-dgb-50/20 to-fb-50/20 p-4 shadow-xs">
                  <div className="flex items-center gap-4">
                    {/* Logo Preview Box */}
                    <div className="relative flex size-16 shrink-0 items-center justify-center rounded-lg border border-border bg-white p-2 shadow-2xs">
                      {formLogoAsset?.url ? (
                        <Image
                          src={formLogoAsset.url}
                          alt={formLogoAsset.alt || formName || "Logo sponsor"}
                          width={64}
                          height={64}
                          className="size-full object-contain"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-muted-foreground/60">
                          <Handshake className="size-6" />
                          <span className="text-[9px] font-semibold mt-1">Logo</span>
                        </div>
                      )}
                    </div>

                    {/* Metadata */}
                    <div className="flex-1 min-w-0">
                      <p className="font-montserrat font-bold text-sm text-foreground truncate">
                        {formName.trim() || "Nama Sponsor"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 truncate">
                        {formWebsite.trim() ? (
                          <>
                            <Globe className="size-3 shrink-0 text-dgb" />
                            <span className="text-dgb truncate">
                              {formWebsite.trim().replace(/^https?:\/\//, "")}
                            </span>
                          </>
                        ) : (
                          "Belum ada tautan website"
                        )}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground">
                          Urutan: <strong>{formDisplayOrder}</strong>
                        </span>
                        <span className="text-muted-foreground/40">•</span>
                        <span className="text-[11px]">
                          {formActive ? (
                            <span className="text-emerald-700 font-medium">● Siap tayang</span>
                          ) : (
                            <span className="text-stone-500">○ Nonaktif</span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <SheetFooter className="px-6 py-4 border-t border-border bg-muted/30 flex flex-row items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsSheetOpen(false)}
                disabled={isPending}
                className="text-xs"
              >
                Batal
              </Button>
              <AdminButton type="submit" disabled={isPending || !formName.trim()}>
                {isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin mr-1.5" />
                    Menyimpan...
                  </>
                ) : editingSponsor ? (
                  "Simpan perubahan"
                ) : (
                  "Tambah sponsor"
                )}
              </AdminButton>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog
        open={Boolean(deletingSponsor)}
        onOpenChange={(open) => !open && setDeletingSponsor(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-montserrat">
              Hapus sponsor {deletingSponsor?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini akan menghapus data sponsor dari edisi {edition.name} ({edition.year}) secara permanen. File logo tidak akan dihapus dari pustaka media.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isPending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isPending ? "Menghapus..." : "Hapus sponsor"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

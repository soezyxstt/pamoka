"use client";

import {
  Award,
  Camera,
  ChevronRight,
  Plus,
  QrCode,
  Search,
  Trash2,
  User,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AdminBadge,
  AdminCard,
  AdminCardHeader,
  AdminEmptyState,
  AdminField,
  AdminInput,
  AdminSelect,
  AdminStatCard,
  AdminTextarea,
} from "@/components/admin/primitives";
import { AdminMediaPicker, type MediaAssetSummary } from "@/components/admin/media-picker";
import {
  createParticipantAction,
  deleteParticipantAction,
  toggleParticipantActiveAction,
} from "./actions";

export type ParticipantItem = {
  id: string;
  editionId: string;
  categoryId: string;
  categoryCode: string;
  categoryLabel: string;
  number: number;
  name: string;
  slug: string;
  stage: string;
  bio: string | null;
  portraitMediaId: string | null;
  portraitUrl: string | null;
  portraitAlt: string | null;
  qrisMediaId: string | null;
  qrisUrl: string | null;
  paymentUrl: string | null;
  displayOrder: number;
  active: boolean;
  version: number;
  achievementsCount: number;
  socialLinksCount: number;
  mediaCount: number;
  hasCloseup: boolean;
};

export type CategoryOption = {
  id: string;
  code: string;
  label: string;
};

export type EditionInfo = {
  id: string;
  year: number;
  name: string;
  lifecycle: string;
};

type Props = {
  edition: EditionInfo;
  categories: CategoryOption[];
  initialParticipants: ParticipantItem[];
  canEdit: boolean;
  canManageMedia: boolean;
};


export function ParticipantsListClient({
  edition,
  categories,
  initialParticipants,
  canEdit,
  canManageMedia,
}: Props) {
  const [participants, setParticipants] = useState<ParticipantItem[]>(initialParticipants);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedStage, setSelectedStage] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<"all" | "active" | "inactive">("all");
  const [selectedPhotoFilter, setSelectedPhotoFilter] = useState<"all" | "complete" | "missing">("all");
  const [selectedQrisFilter, setSelectedQrisFilter] = useState<"all" | "ready" | "missing">("all");

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ParticipantItem | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [isPending, startTransition] = useTransition();

  // Create form state
  const [createCategoryId, setCreateCategoryId] = useState(categories[0]?.id ?? "");
  const [createName, setCreateName] = useState("");
  const [createSlug, setCreateSlug] = useState("");
  const [createNumber, setCreateNumber] = useState<number>(() => {
    const maxNum = initialParticipants.reduce((max, p) => Math.max(max, p.number), 0);
    return maxNum + 1;
  });
  const [createStage, setCreateStage] = useState("finalis");
  const [createBio, setCreateBio] = useState("");
  const [createPaymentUrl, setCreatePaymentUrl] = useState("");
  const [createPortraitAsset, setCreatePortraitAsset] = useState<MediaAssetSummary | null>(null);
  const [createQrisAsset, setCreateQrisAsset] = useState<MediaAssetSummary | null>(null);
  const [portraitPickerOpen, setPortraitPickerOpen] = useState(false);
  const [qrisPickerOpen, setQrisPickerOpen] = useState(false);

  // Auto slug generation on name change
  const handleNameChange = (val: string) => {
    setCreateName(val);
    const generated = val
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
    setCreateSlug(generated);
  };

  // Filtered participants
  const filteredParticipants = useMemo(() => {
    return participants.filter((item) => {
      // Search
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesNo = String(item.number).includes(q) || `0${item.number}`.includes(q);
        const matchesSlug = item.slug.toLowerCase().includes(q);
        if (!matchesName && !matchesNo && !matchesSlug) return false;
      }

      // Category
      if (selectedCategory !== "all") {
        if (item.categoryId !== selectedCategory && item.categoryCode !== selectedCategory) {
          return false;
        }
      }

      // Stage
      if (selectedStage !== "all") {
        const itemStage = item.stage.toLowerCase();
        if (selectedStage === "finalis" && itemStage !== "finalis" && itemStage !== "final") return false;
        if (selectedStage === "semifinalis" && itemStage !== "semifinalis" && itemStage !== "semifinal") return false;
        if (selectedStage === "audisi" && itemStage !== "audisi") return false;
      }

      // Status
      if (selectedStatus === "active" && !item.active) return false;
      if (selectedStatus === "inactive" && item.active) return false;

      // Photo
      if (selectedPhotoFilter === "complete" && !item.hasCloseup && !item.portraitUrl) return false;
      if (selectedPhotoFilter === "missing" && (item.hasCloseup || item.portraitUrl)) return false;

      // QRIS
      if (selectedQrisFilter === "ready" && !item.qrisMediaId) return false;
      if (selectedQrisFilter === "missing" && item.qrisMediaId) return false;

      return true;
    });
  }, [
    participants,
    search,
    selectedCategory,
    selectedStage,
    selectedStatus,
    selectedPhotoFilter,
    selectedQrisFilter,
  ]);

  // Summary statistics
  const stats = useMemo(() => {
    const total = participants.length;
    const activeCount = participants.filter((p) => p.active).length;
    const finalists = participants.filter((p) => ["final", "finalis"].includes(p.stage.toLowerCase())).length;
    const withPhoto = participants.filter((p) => p.hasCloseup || p.portraitUrl).length;
    const withQris = participants.filter((p) => Boolean(p.qrisMediaId)).length;
    return { total, activeCount, finalists, withPhoto, withQris };
  }, [participants]);

  const handleToggleActive = (item: ParticipantItem) => {
    if (!canEdit) {
      toast.error("Anda tidak memiliki izin untuk mengubah status peserta");
      return;
    }

    startTransition(async () => {
      try {
        const res = await toggleParticipantActiveAction({ participantId: item.id });
        setParticipants((prev) =>
          prev.map((p) => (p.id === item.id ? { ...p, active: res.active, version: res.version } : p))
        );
        toast.success(`Status peserta ${item.name} berhasil ${res.active ? "diaktifkan" : "dinonaktifkan"}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Gagal mengubah status peserta");
      }
    });
  };

  const handleDelete = () => {
    if (!deleteTarget) return;

    startTransition(async () => {
      try {
        await deleteParticipantAction({ participantId: deleteTarget.id, reason: deleteReason.trim() || undefined });
        setParticipants((prev) => prev.filter((p) => p.id !== deleteTarget.id));
        toast.success(`Peserta ${deleteTarget.name} berhasil dihapus`);
        setDeleteTarget(null);
        setDeleteReason("");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Gagal menghapus peserta");
      }
    });
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createCategoryId || !createName.trim()) {
      toast.error("Kategori dan nama peserta wajib diisi");
      return;
    }

    startTransition(async () => {
      try {
        const res = await createParticipantAction({
          categoryId: createCategoryId,
          name: createName.trim(),
          slug: createSlug.trim() || undefined,
          number: Number(createNumber),
          stage: createStage,
          bio: createBio.trim() || null,
          paymentUrl: createPaymentUrl.trim() || null,
          portraitMediaId: createPortraitAsset?.id || null,
          qrisMediaId: createQrisAsset?.id || null,
          active: true,
          displayOrder: Number(createNumber),
        });

        const selectedCat = categories.find((c) => c.id === createCategoryId);

        const newParticipant: ParticipantItem = {
          id: res.id,
          editionId: edition.id,
          categoryId: createCategoryId,
          categoryCode: selectedCat?.code ?? "",
          categoryLabel: selectedCat?.label ?? "",
          number: Number(createNumber),
          name: createName.trim(),
          slug: createSlug.trim(),
          stage: createStage,
          bio: createBio.trim() || null,
          portraitMediaId: createPortraitAsset?.id || null,
          portraitUrl: createPortraitAsset?.url || null,
          portraitAlt: createPortraitAsset?.alt || null,
          qrisMediaId: createQrisAsset?.id || null,
          qrisUrl: createQrisAsset?.url || null,
          paymentUrl: createPaymentUrl.trim() || null,
          displayOrder: Number(createNumber),
          active: true,
          version: 1,
          achievementsCount: 0,
          socialLinksCount: 0,
          mediaCount: createPortraitAsset ? 1 : 0,
          hasCloseup: Boolean(createPortraitAsset),
        };

        setParticipants((prev) => [newParticipant, ...prev]);
        toast.success(`Peserta ${createName} berhasil didaftarkan`);
        setCreateDialogOpen(false);

        // Reset create state
        setCreateName("");
        setCreateSlug("");
        setCreateNumber((prev) => prev + 1);
        setCreateBio("");
        setCreatePaymentUrl("");
        setCreatePortraitAsset(null);
        setCreateQrisAsset(null);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Gagal mendaftarkan peserta");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. Stat Cards Header */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-4">
        <AdminStatCard
          label="Total Peserta"
          value={stats.total}
          note={`${stats.activeCount} peserta aktif`}
          icon="users"
        />
        <AdminStatCard
          label="Finalis"
          value={stats.finalists}
          note={`Edisi ${edition.year}`}
          icon="sparkles"
        />
        <AdminStatCard
          label="Foto Closeup"
          value={`${stats.withPhoto}/${stats.total}`}
          note={stats.withPhoto === stats.total ? "Seluruh foto siap" : `${stats.total - stats.withPhoto} belum ada foto`}
          icon="sparkles"
        />
        <AdminStatCard
          label="QRIS Voting"
          value={`${stats.withQris}/${stats.total}`}
          note={stats.withQris === stats.total ? "Seluruh QRIS siap" : `${stats.total - stats.withQris} belum siap`}
          icon="sparkles"
        />
      </div>

      {/* 2. Filter Bar & Search */}
      <AdminCard className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <AdminInput
              placeholder="Cari nama, nomor urut, atau slug..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Category Filter */}
            <div className="w-36">
              <AdminSelect
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="text-xs h-9"
              >
                <option value="all">Semua Kategori</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label} ({c.code})
                  </option>
                ))}
              </AdminSelect>
            </div>

            {/* Stage Filter */}
            <div className="w-32">
              <AdminSelect
                value={selectedStage}
                onChange={(e) => setSelectedStage(e.target.value)}
                className="text-xs h-9"
              >
                <option value="all">Semua Tahap</option>
                <option value="finalis">Finalis</option>
                <option value="semifinalis">Semifinalis</option>
                <option value="audisi">Audisi</option>
              </AdminSelect>
            </div>

            {/* Status Filter */}
            <div className="w-30">
              <AdminSelect
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as "all" | "active" | "inactive")}
                className="text-xs h-9"
              >
                <option value="all">Semua Status</option>
                <option value="active">Aktif</option>
                <option value="inactive">Nonaktif</option>
              </AdminSelect>
            </div>

            {/* Photo Filter */}
            <div className="w-32">
              <AdminSelect
                value={selectedPhotoFilter}
                onChange={(e) => setSelectedPhotoFilter(e.target.value as "all" | "complete" | "missing")}
                className="text-xs h-9"
              >
                <option value="all">Semua Foto</option>
                <option value="complete">Foto Siap</option>
                <option value="missing">Belum Ada Foto</option>
              </AdminSelect>
            </div>

            {/* QRIS Filter */}
            <div className="w-32">
              <AdminSelect
                value={selectedQrisFilter}
                onChange={(e) => setSelectedQrisFilter(e.target.value as "all" | "ready" | "missing")}
                className="text-xs h-9"
              >
                <option value="all">Semua QRIS</option>
                <option value="ready">QRIS Siap</option>
                <option value="missing">Belum Ada QRIS</option>
              </AdminSelect>
            </div>

            {/* Add Participant Button */}
            {canEdit ? (
              <Button
                type="button"
                onClick={() => setCreateDialogOpen(true)}
                className="h-9 bg-dgb font-montserrat text-xs font-semibold text-white hover:bg-dgb/90"
              >
                <Plus size={14} className="mr-1.5" /> Tambah peserta
              </Button>
            ) : null}
          </div>
        </div>
      </AdminCard>

      {/* 3. Participant List */}
      <AdminCard>
        <AdminCardHeader
          eyebrow="Direktori Peserta"
          title={`Peserta ${edition.name} (${filteredParticipants.length})`}
          description={`Daftar peserta Pasanggiri ${edition.year}. Klik peserta untuk membuka editor identitas, prestasi, galeri foto, dan QRIS.`}
          action={
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                Menampilkan {filteredParticipants.length} dari {participants.length} peserta
              </span>
            </div>
          }
        />

        {filteredParticipants.length === 0 ? (
          <div className="p-8">
            <AdminEmptyState
              icon="users"
              title="Peserta tidak ditemukan"
              description={
                search || selectedCategory !== "all" || selectedStage !== "all"
                  ? "Coba sesuaikan filter atau kata kunci pencarian Anda."
                  : "Belum ada peserta terdaftar untuk edisi ini. Klik tombol 'Tambah peserta' untuk mendaftar."
              }
            />
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredParticipants.map((item) => {
              const photoUrl = item.portraitUrl;
              const hasPhoto = Boolean(item.hasCloseup || photoUrl);
              const hasQris = Boolean(item.qrisMediaId);
              const hasBio = Boolean(item.bio && item.bio.trim().length > 0);
              const hasAchievements = item.achievementsCount > 0;

              return (
                <div
                  key={item.id}
                  className="group flex flex-col gap-4 p-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between"
                >
                  {/* Left: Thumbnail & Info */}
                  <div className="flex items-center gap-4 min-w-0">
                    {/* Closeup Thumbnail */}
                    <div className="relative size-14 shrink-0 overflow-hidden rounded-lg border border-dgb-200/60 bg-muted shadow-xs">
                      {photoUrl ? (
                        <Image
                          src={photoUrl}
                          alt={item.portraitAlt ?? item.name}
                          fill
                          sizes="56px"
                          className="object-cover object-top"
                        />
                      ) : (
                        <div className="grid size-full place-items-center bg-dgb-50/60 text-dgb-600">
                          <User size={22} />
                        </div>
                      )}
                      <span className="absolute bottom-0 inset-x-0 bg-black/75 py-0.5 text-center font-montserrat text-[10px] font-bold text-white">
                        {String(item.number).padStart(2, "0")}
                      </span>
                    </div>

                    {/* Participant Details */}
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/admin/content/participants/${item.id}`}
                          className="font-montserrat text-sm font-bold text-dgb-900 transition-colors hover:text-fb"
                        >
                          {item.name}
                        </Link>
                        <span className="rounded-md border border-dgb-200 bg-dgb-50 px-2 py-0.5 font-montserrat text-[10px] font-semibold text-dgb-800">
                          {item.categoryLabel}
                        </span>
                        <AdminBadge value={item.stage} />
                        {!item.active ? (
                          <span className="rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-800">
                            Nonaktif
                          </span>
                        ) : null}
                      </div>

                      <p className="truncate text-xs text-muted-foreground">
                        slug: <span className="font-mono text-[11px] text-foreground">{item.slug}</span> · No. urut:{" "}
                        <span className="font-semibold text-foreground">{item.number}</span>
                      </p>

                      {/* Readiness Badges */}
                      <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                        {/* Photo badge */}
                        <span
                          className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-medium border ${
                            hasPhoto
                              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                              : "border-amber-200 bg-amber-50 text-amber-800"
                          }`}
                        >
                          <Camera size={11} />
                          {hasPhoto ? "Foto siap" : "Foto belum ada"}
                        </span>

                        {/* Bio badge */}
                        <span
                          className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-medium border ${
                            hasBio
                              ? "border-dgb-200 bg-dgb-50 text-dgb-800"
                              : "border-border bg-muted text-muted-foreground"
                          }`}
                        >
                          <User size={11} />
                          {hasBio ? "Bio terisi" : "Bio kosong"}
                        </span>

                        {/* Achievements badge */}
                        <span
                          className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-medium border ${
                            hasAchievements
                              ? "border-fb-200 bg-fb-50 text-fb-800"
                              : "border-border bg-muted text-muted-foreground"
                          }`}
                        >
                          <Award size={11} />
                          {item.achievementsCount} prestasi
                        </span>

                        {/* QRIS badge */}
                        <span
                          className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-medium border ${
                            hasQris
                              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                              : "border-rose-200 bg-rose-50 text-rose-800"
                          }`}
                        >
                          <QrCode size={11} />
                          {hasQris ? "QRIS siap" : "QRIS belum ada"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Quick Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleActive(item)}
                      disabled={!canEdit || isPending}
                      className={`h-8 text-xs ${
                        item.active
                          ? "border-border text-muted-foreground hover:bg-muted"
                          : "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                      }`}
                    >
                      {item.active ? "Nonaktifkan" : "Aktifkan"}
                    </Button>

                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="h-8 border-dgb-200 bg-white text-xs font-semibold text-dgb hover:bg-dgb-50"
                    >
                      <Link href={`/admin/content/participants/${item.id}`}>
                        Kelola profil <ChevronRight size={13} className="ml-1" />
                      </Link>
                    </Button>

                    {canEdit ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setDeleteTarget(item)}
                        disabled={isPending}
                        className="h-8 border-rose-200 text-xs text-destructive hover:bg-rose-50"
                      >
                        <Trash2 size={13} />
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </AdminCard>

      {/* 4. Dialog Pendaftaran Peserta Baru */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-montserrat text-lg font-bold text-dgb-900">
              Pendaftaran Peserta Baru
            </DialogTitle>
            <DialogDescription>
              Daftarkan peserta untuk Pasanggiri {edition.name} ({edition.year}).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit} className="space-y-4 pt-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <AdminField label="Kategori" className="sm:col-span-2">
                <AdminSelect
                  value={createCategoryId}
                  onChange={(e) => setCreateCategoryId(e.target.value)}
                  required
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label} ({cat.code})
                    </option>
                  ))}
                </AdminSelect>
              </AdminField>

              <AdminField label="Nama lengkap peserta" className="sm:col-span-2">
                <AdminInput
                  placeholder="Contoh: Mochamad Fauzan Pratama"
                  value={createName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  required
                />
              </AdminField>

              <AdminField label="Slug profil" hint="Alamat URL unik peserta">
                <AdminInput
                  placeholder="mochamad-fauzan-pratama"
                  value={createSlug}
                  onChange={(e) => setCreateSlug(e.target.value)}
                  required
                />
              </AdminField>

              <AdminField label="Nomor urut peserta">
                <AdminInput
                  type="number"
                  min="1"
                  value={createNumber}
                  onChange={(e) => setCreateNumber(Number(e.target.value))}
                  required
                />
              </AdminField>

              <AdminField label="Tahap seleksi" className="sm:col-span-2">
                <AdminSelect
                  value={createStage}
                  onChange={(e) => setCreateStage(e.target.value)}
                  required
                >
                  <option value="finalis">Finalis</option>
                  <option value="semifinalis">Semifinalis</option>
                  <option value="audisi">Audisi</option>
                </AdminSelect>
              </AdminField>

              {/* Closeup Photo Picker */}
              <div className="space-y-2 sm:col-span-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">Foto Utama (Closeup)</span>
                  <span className="text-[11px] text-muted-foreground">Rasio 3:4 atau 1:1</span>
                </div>
                {createPortraitAsset ? (
                  <div className="flex items-center gap-3 rounded-lg border border-dgb-100 bg-white p-2.5">
                    <div className="relative size-12 overflow-hidden rounded-md border border-border">
                      <Image
                        src={createPortraitAsset.url}
                        alt={createPortraitAsset.alt ?? createPortraitAsset.filename}
                        fill
                        sizes="48px"
                        className="object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-dgb-900">{createPortraitAsset.filename}</p>
                      <p className="text-[11px] text-muted-foreground">Foto closeup awal</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setCreatePortraitAsset(null)}
                      className="h-7 text-[11px] text-destructive hover:bg-rose-50"
                    >
                      Hapus
                    </Button>
                  </div>
                ) : (
                  <div
                    onClick={() => setPortraitPickerOpen(true)}
                    className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-dgb-200 bg-dgb-50/20 p-4 text-xs font-medium text-dgb hover:bg-dgb-50/40"
                  >
                    <Camera size={16} /> Pilih foto closeup dari pustaka media
                  </div>
                )}
              </div>

              {/* QRIS Media Picker */}
              <div className="space-y-2 sm:col-span-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">Aset QRIS Voting</span>
                  <span className="text-[11px] text-muted-foreground">Rasio 1:1</span>
                </div>
                {createQrisAsset ? (
                  <div className="flex items-center gap-3 rounded-lg border border-dgb-100 bg-white p-2.5">
                    <div className="relative size-12 overflow-hidden rounded-md border border-border">
                      <Image
                        src={createQrisAsset.url}
                        alt={createQrisAsset.alt ?? createQrisAsset.filename}
                        fill
                        sizes="48px"
                        className="object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-dgb-900">{createQrisAsset.filename}</p>
                      <p className="text-[11px] text-muted-foreground">Gambar QRIS</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setCreateQrisAsset(null)}
                      className="h-7 text-[11px] text-destructive hover:bg-rose-50"
                    >
                      Hapus
                    </Button>
                  </div>
                ) : (
                  <div
                    onClick={() => setQrisPickerOpen(true)}
                    className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-dgb-200 bg-dgb-50/20 p-4 text-xs font-medium text-dgb hover:bg-dgb-50/40"
                  >
                    <QrCode size={16} /> Pilih gambar QRIS dari pustaka media
                  </div>
                )}
              </div>

              <AdminField label="URL Pembayaran alternatif" hint="Opsional jika QRIS memiliki gateway url" className="sm:col-span-2">
                <AdminInput
                  type="url"
                  placeholder="https://..."
                  value={createPaymentUrl}
                  onChange={(e) => setCreatePaymentUrl(e.target.value)}
                />
              </AdminField>

              <AdminField label="Bio singkat" className="sm:col-span-2">
                <AdminTextarea
                  placeholder="Tuliskan latar belakang singkat peserta..."
                  value={createBio}
                  onChange={(e) => setCreateBio(e.target.value)}
                  rows={3}
                />
              </AdminField>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateDialogOpen(false)}
                disabled={isPending}
                className="text-xs"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="bg-dgb font-montserrat text-xs font-semibold text-white hover:bg-dgb/90"
              >
                {isPending ? "Mendaftarkan..." : "Daftarkan peserta"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Media Pickers for Create Dialog */}
      <AdminMediaPicker
        open={portraitPickerOpen}
        onOpenChange={setPortraitPickerOpen}
        onSelect={(asset) => {
          setCreatePortraitAsset(asset);
          setPortraitPickerOpen(false);
        }}
        acceptType="image"
        title="Pilih foto closeup peserta"
        canManageMedia={canManageMedia}
        activeEditionId={edition.id}
      />

      <AdminMediaPicker
        open={qrisPickerOpen}
        onOpenChange={setQrisPickerOpen}
        onSelect={(asset) => {
          setCreateQrisAsset(asset);
          setQrisPickerOpen(false);
        }}
        acceptType="image"
        title="Pilih gambar QRIS peserta"
        canManageMedia={canManageMedia}
        activeEditionId={edition.id}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-montserrat text-base font-bold text-dgb-900">
              Hapus peserta {deleteTarget?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Tindakan ini akan menghapus peserta nomor {deleteTarget?.number}, seluruh prestasi, tautan sosial media,
              dan relasi media secara permanen dari edisi {edition.year}. Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-2">
            <AdminField label="Alasan penghapusan (opsional)">
              <AdminInput
                placeholder="Misal: Mundur dari kompetisi"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                className="text-xs"
              />
            </AdminField>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isPending}
              className="bg-destructive text-white hover:bg-destructive/90 text-xs font-semibold"
            >
              {isPending ? "Menghapus..." : "Hapus peserta"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

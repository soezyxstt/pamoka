"use client";

import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Edit2,
  HelpCircle,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  AdminBadge,
  AdminButton,
  AdminCard,
  AdminCardHeader,
  AdminEmptyState,
  AdminField,
  AdminInput,
  AdminTextarea,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { EditionProgramRow } from "@/server/db/schema";
import {
  deleteEditionProgramAction,
  reorderEditionProgramsAction,
  saveEditionProgramAction,
  updateEditionSettingsAction,
} from "./actions";

export type EditionSettingsClientProps = {
  edition: {
    id: string;
    year: number;
    name: string;
    lifecycle: string;
    slogan: string | null;
    logoMediaId: string | null;
    version: number;
  };
  initialLogoAsset: MediaAssetSummary | null;
  initialPrograms: EditionProgramRow[];
  canManageContent?: boolean;
};

export function EditionSettingsClient({
  edition,
  initialLogoAsset,
  initialPrograms,
  canManageContent = true,
}: EditionSettingsClientProps) {
  const [isPending, startTransition] = useTransition();

  // Edition identity form state
  const [slogan, setSlogan] = useState(edition.slogan ?? "");
  const [logoAsset, setLogoAsset] = useState<MediaAssetSummary | null>(initialLogoAsset);

  // Programs state
  const [programs, setPrograms] = useState<EditionProgramRow[]>(initialPrograms);
  const [editingProgram, setEditingProgram] = useState<EditionProgramRow | null>(null);
  const [isProgramDialogOpen, setIsProgramDialogOpen] = useState(false);
  const [deletingProgram, setDeletingProgram] = useState<EditionProgramRow | null>(null);

  // Program form dialog inputs
  const [programTitle, setProgramTitle] = useState("");
  const [programDesc, setProgramDesc] = useState("");
  const [programActive, setProgramActive] = useState(true);

  // Sync initial props
  const [prevInitialPrograms, setPrevInitialPrograms] = useState(initialPrograms);
  if (initialPrograms !== prevInitialPrograms) {
    setPrevInitialPrograms(initialPrograms);
    setPrograms(initialPrograms);
  }

  const handleIdentitySubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canManageContent) return;

    const formData = new FormData();
    if (logoAsset?.id) {
      formData.set("logoMediaId", logoAsset.id);
    }
    formData.set("slogan", slogan.trim());
    formData.set("version", String(edition.version));

    startTransition(async () => {
      try {
        await updateEditionSettingsAction(formData);
        toast.success("Pengaturan identitas edisi berhasil disimpan");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Gagal menyimpan identitas edisi");
      }
    });
  };

  const openAddProgramDialog = () => {
    setEditingProgram(null);
    setProgramTitle("");
    setProgramDesc("");
    setProgramActive(true);
    setIsProgramDialogOpen(true);
  };

  const openEditProgramDialog = (program: EditionProgramRow) => {
    setEditingProgram(program);
    setProgramTitle(program.title);
    setProgramDesc(program.description ?? "");
    setProgramActive(program.active);
    setIsProgramDialogOpen(true);
  };

  const handleSaveProgram = (e: React.FormEvent) => {
    e.preventDefault();
    if (!programTitle.trim()) {
      toast.error("Judul program wajib diisi");
      return;
    }

    const formData = new FormData();
    if (editingProgram) {
      formData.set("id", editingProgram.id);
      formData.set("displayOrder", String(editingProgram.displayOrder));
    } else {
      formData.set("displayOrder", String(programs.length));
    }
    formData.set("title", programTitle.trim());
    formData.set("description", programDesc.trim());
    formData.set("active", programActive ? "true" : "false");

    startTransition(async () => {
      try {
        await saveEditionProgramAction(formData);
        setIsProgramDialogOpen(false);
        toast.success(editingProgram ? "Program berhasil diperbarui" : "Program baru berhasil ditambahkan");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Gagal menyimpan program");
      }
    });
  };

  const handleDeleteProgram = () => {
    if (!deletingProgram) return;

    const formData = new FormData();
    formData.set("id", deletingProgram.id);

    startTransition(async () => {
      try {
        await deleteEditionProgramAction(formData);
        setDeletingProgram(null);
        toast.success("Program berhasil dihapus");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Gagal menghapus program");
      }
    });
  };

  const handleMoveProgram = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= programs.length) return;

    const reordered = [...programs];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);
    setPrograms(reordered);

    const idList = reordered.map((p) => p.id);

    startTransition(async () => {
      try {
        await reorderEditionProgramsAction(idList);
        toast.success("Urutan program diperbarui");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Gagal memperbarui urutan");
      }
    });
  };

  const isLogoSet = Boolean(logoAsset?.id);
  const isSloganSet = Boolean(slogan.trim());
  const activeProgramsCount = programs.filter((p) => p.active).length;
  const isComplete = isLogoSet && isSloganSet && activeProgramsCount > 0;

  return (
    <div className="space-y-6">
      {/* Overview & Completeness Row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left 2 Cols: Identity Form */}
        <div className="lg:col-span-2">
          <AdminCard>
            <AdminCardHeader
              eyebrow="Identitas utama"
              title="Logo dan Slogan Edisi"
              description="Informasi visual dan tagline resmi yang mewakili edisi terpilih."
            />
            <form onSubmit={handleIdentitySubmit} className="space-y-5 p-5">
              <AdminMediaField
                name="logoMediaId"
                label="Logo resmi edisi"
                hint="Format PNG atau WebP berlatar transparan disarankan. Rasio persegi 1:1."
                aspectRatioHint="1:1"
                acceptType="image"
                initialAsset={logoAsset}
                onChange={setLogoAsset}
                canManageMedia={canManageContent}
                activeEditionId={edition.id}
              />

              <AdminField
                label="Slogan edisi"
                hint="Tagline resmi untuk edisi ini (misalnya: Nu Nyunda Tur Nyakola)."
              >
                <AdminInput
                  value={slogan}
                  onChange={(e) => setSlogan(e.target.value)}
                  placeholder="Contoh: Nu Nyunda Tur Nyakola"
                  disabled={!canManageContent || isPending}
                />
              </AdminField>

              <div className="flex items-center justify-end border-t border-border pt-4">
                <AdminButton
                  type="submit"
                  disabled={!canManageContent || isPending}
                  className="bg-dgb text-white hover:bg-dgb-600"
                >
                  {isPending ? "Menyimpan..." : "Simpan identitas edisi"}
                </AdminButton>
              </div>
            </form>
          </AdminCard>
        </div>

        {/* Right 1 Col: Completeness Card */}
        <div>
          <AdminCard className="h-full flex flex-col justify-between">
            <AdminCardHeader
              eyebrow="Status kelengkapan"
              title="Ringkasan Identitas"
              description="Indikator kesiapan identitas edisi sebelum publikasi."
              action={
                <AdminBadge
                  value={isComplete ? "ready" : "draft"}
                  className={isComplete ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-800"}
                />
              }
            />

            <div className="space-y-4 p-5 flex-1">
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between rounded-lg border border-border p-3 bg-muted/30">
                  <div className="flex items-center gap-2.5">
                    {isLogoSet ? (
                      <CheckCircle2 size={16} className="text-dgb" />
                    ) : (
                      <HelpCircle size={16} className="text-amber-500" />
                    )}
                    <span className="font-medium text-foreground">Logo edisi</span>
                  </div>
                  <span className="font-semibold text-muted-foreground">
                    {isLogoSet ? "Terpasang" : "Belum diisi"}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-border p-3 bg-muted/30">
                  <div className="flex items-center gap-2.5">
                    {isSloganSet ? (
                      <CheckCircle2 size={16} className="text-dgb" />
                    ) : (
                      <HelpCircle size={16} className="text-amber-500" />
                    )}
                    <span className="font-medium text-foreground">Slogan edisi</span>
                  </div>
                  <span className="font-semibold text-muted-foreground">
                    {isSloganSet ? "Terisi" : "Belum diisi"}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-border p-3 bg-muted/30">
                  <div className="flex items-center gap-2.5">
                    {activeProgramsCount > 0 ? (
                      <CheckCircle2 size={16} className="text-dgb" />
                    ) : (
                      <HelpCircle size={16} className="text-amber-500" />
                    )}
                    <span className="font-medium text-foreground">Program unggulan</span>
                  </div>
                  <span className="font-semibold text-muted-foreground">
                    {activeProgramsCount} aktif ({programs.length} total)
                  </span>
                </div>
              </div>

              <div className="rounded-lg border border-dgb-100 bg-dgb-50/40 p-3.5 text-xs text-dgb-900 space-y-1">
                <p className="font-semibold flex items-center gap-1.5 text-dgb">
                  <Sparkles size={14} /> Catatan Identitas
                </p>
                <p className="text-[11px] leading-relaxed text-dgb-900/80">
                  Logo dan slogan edisi akan digunakan pada banner hero, materi publikasi, serta sertifikat resmi peserta edisi ini.
                </p>
              </div>
            </div>
          </AdminCard>
        </div>
      </div>

      {/* Program Unggulan Section */}
      <AdminCard>
        <AdminCardHeader
          eyebrow="Program kerja edisi"
          title="Daftar Program Unggulan"
          description="Rangkaian program prioritas dan unggulan yang diselenggarakan pada edisi ini."
          action={
            canManageContent ? (
              <AdminButton
                type="button"
                onClick={openAddProgramDialog}
                className="bg-dgb text-white hover:bg-dgb-600 gap-1.5"
              >
                <Plus size={14} /> Tambah program
              </AdminButton>
            ) : null
          }
        />

        {programs.length === 0 ? (
          <div className="p-5">
            <AdminEmptyState
              icon="sparkles"
              title="Belum ada program unggulan"
              description="Tambahkan program unggulan pertama untuk melengkapi profil kegiatan edisi ini."
            />
          </div>
        ) : (
          <div className="divide-y divide-border">
            {programs.map((prog, idx) => (
              <div
                key={prog.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between transition-colors hover:bg-muted/20"
              >
                <div className="flex items-start gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-md bg-dgb-50 text-xs font-bold text-dgb border border-dgb-200">
                    {idx + 1}
                  </span>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-montserrat text-sm font-semibold text-dgb-900">
                        {prog.title}
                      </h4>
                      <AdminBadge
                        value={prog.active ? "active" : "draft"}
                        className={prog.active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600"}
                      />
                    </div>
                    {prog.description ? (
                      <p className="text-xs text-muted-foreground line-clamp-2 max-w-xl">
                        {prog.description}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 self-end sm:self-center">
                  {canManageContent ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={idx === 0 || isPending}
                        onClick={() => handleMoveProgram(idx, "up")}
                        aria-label="Pindahkan program ke atas"
                        className="size-8 p-0 text-muted-foreground hover:text-foreground"
                      >
                        <ArrowUp size={13} />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={idx === programs.length - 1 || isPending}
                        onClick={() => handleMoveProgram(idx, "down")}
                        aria-label="Pindahkan program ke bawah"
                        className="size-8 p-0 text-muted-foreground hover:text-foreground"
                      >
                        <ArrowDown size={13} />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isPending}
                        onClick={() => openEditProgramDialog(prog)}
                        aria-label="Edit program"
                        className="size-8 p-0 text-dgb border-dgb-200 hover:bg-dgb-50"
                      >
                        <Edit2 size={13} />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isPending}
                        onClick={() => setDeletingProgram(prog)}
                        aria-label="Hapus program"
                        className="size-8 p-0 text-destructive border-rose-200 hover:bg-rose-50"
                      >
                        <Trash2 size={13} />
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </AdminCard>

      {/* Program Add/Edit Dialog */}
      <Dialog open={isProgramDialogOpen} onOpenChange={setIsProgramDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-montserrat text-lg font-semibold text-dgb-900">
              {editingProgram ? "Edit Program Unggulan" : "Tambah Program Unggulan"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Masukkan rincian program kerja utama untuk edisi ini.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveProgram} className="space-y-4 pt-2">
            <AdminField label="Judul program">
              <AdminInput
                value={programTitle}
                onChange={(e) => setProgramTitle(e.target.value)}
                placeholder="Contoh: Pasanggiri Mojang Jajaka Garut"
                required
                autoFocus
              />
            </AdminField>

            <AdminField label="Deskripsi program" hint="Ringkasan tujuan atau agenda program kerja.">
              <AdminTextarea
                value={programDesc}
                onChange={(e) => setProgramDesc(e.target.value)}
                placeholder="Tuliskan deskripsi singkat program..."
                rows={3}
              />
            </AdminField>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="programActiveCheckbox"
                checked={programActive}
                onChange={(e) => setProgramActive(e.target.checked)}
                className="size-4 rounded border-border text-dgb focus:ring-dgb"
              />
              <label htmlFor="programActiveCheckbox" className="text-xs font-medium text-foreground cursor-pointer">
                Tampilkan sebagai program aktif
              </label>
            </div>

            <DialogFooter className="border-t border-border pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsProgramDialogOpen(false)}
                className="text-xs h-9"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={isPending || !programTitle.trim()}
                className="bg-dgb text-white text-xs h-9 hover:bg-dgb-600"
              >
                {isPending ? "Menyimpan..." : editingProgram ? "Simpan perubahan" : "Tambahkan program"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Program Confirmation Dialog */}
      <AlertDialog
        open={Boolean(deletingProgram)}
        onOpenChange={(open) => !open && setDeletingProgram(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-montserrat">
              Hapus program unggulan?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Program &quot;{deletingProgram?.title}&quot; akan dihapus secara permanen dari daftar program edisi ini.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProgram}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Hapus program
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

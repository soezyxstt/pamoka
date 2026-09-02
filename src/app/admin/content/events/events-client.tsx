"use client";

import {
  Calendar,
  ExternalLink,
  Eye,
  FileEdit,
  ImageIcon,
  Plus,
  Trash2,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import {
  AdminMediaField,
  type MediaAssetSummary,
} from "@/components/admin/media-picker";
import {
  AdminBadge,
  AdminCard,
  AdminEmptyState,
} from "@/components/admin/primitives";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import {
  createEventAction,
  deleteEventAction,
  updateEventAction,
} from "./actions";

export type EventItem = {
  id: string;
  label: string;
  slug: string;
  description: string | null;
  heroMediaId: string | null;
  heroMedia: MediaAssetSummary | null;
  displayOrder: number;
  active: boolean;
  galleryCount: number;
};

export type EventsClientProps = {
  initialEvents: EventItem[];
  editionName: string;
  editionId: string;
  canEdit: boolean;
};

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function EventsClient({
  initialEvents,
  editionName,
  editionId,
  canEdit,
}: EventsClientProps) {
  const [eventsList, setEventsList] = useState<EventItem[]>(initialEvents);
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EventItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [label, setLabel] = useState("");
  const [slug, setSlug] = useState("");
  const [isSlugCustomized, setIsSlugCustomized] = useState(false);
  const [description, setDescription] = useState("");
  const [heroMediaId, setHeroMediaId] = useState<string | null>(null);
  const [heroMedia, setHeroMedia] = useState<MediaAssetSummary | null>(null);
  const [displayOrder, setDisplayOrder] = useState(0);
  const [active, setActive] = useState(true);

  const openCreateDialog = () => {
    setLabel("");
    setSlug("");
    setIsSlugCustomized(false);
    setDescription("");
    setHeroMediaId(null);
    setHeroMedia(null);
    setDisplayOrder(eventsList.length + 1);
    setActive(true);
    setEditingEvent(null);
    setIsNewDialogOpen(true);
  };

  const openEditDialog = (ev: EventItem) => {
    setEditingEvent(ev);
    setLabel(ev.label);
    setSlug(ev.slug);
    setIsSlugCustomized(true);
    setDescription(ev.description ?? "");
    setHeroMediaId(ev.heroMediaId);
    setHeroMedia(ev.heroMedia);
    setDisplayOrder(ev.displayOrder);
    setActive(ev.active);
    setIsNewDialogOpen(true);
  };

  const handleLabelChange = (newLabel: string) => {
    setLabel(newLabel);
    if (!isSlugCustomized || slug.trim() === "") {
      setSlug(slugify(newLabel));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim() || label.trim().length < 2) {
      toast.error("Nama acara minimal 2 karakter");
      return;
    }
    const finalSlug = slug.trim() || slugify(label);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(finalSlug)) {
      toast.error("Format slug tidak valid");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingEvent) {
        await updateEventAction({
          id: editingEvent.id,
          label: label.trim(),
          slug: finalSlug,
          description: description.trim() || null,
          heroMediaId,
          displayOrder,
          active,
        });
        setEventsList((prev) =>
          prev.map((item) =>
            item.id === editingEvent.id
              ? {
                  ...item,
                  label: label.trim(),
                  slug: finalSlug,
                  description: description.trim() || null,
                  heroMediaId,
                  heroMedia,
                  displayOrder,
                  active,
                }
              : item,
          ),
        );
        toast.success("Acara berhasil diperbarui");
      } else {
        const res = await createEventAction({
          label: label.trim(),
          slug: finalSlug,
          description: description.trim() || null,
          heroMediaId,
          displayOrder,
          active,
        });
        if (res.eventId) {
          const newItem: EventItem = {
            id: res.eventId,
            label: label.trim(),
            slug: finalSlug,
            description: description.trim() || null,
            heroMediaId,
            heroMedia,
            displayOrder,
            active,
            galleryCount: 0,
          };
          setEventsList((prev) => [...prev, newItem]);
        }
        toast.success("Acara baru berhasil ditambahkan");
      }
      setIsNewDialogOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan acara";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsSubmitting(true);
    try {
      await deleteEventAction({ id: deleteTarget.id });
      setEventsList((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      toast.success(`Acara "${deleteTarget.label}" berhasil dihapus`);
      setDeleteTarget(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menghapus acara";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-xs">
        <div>
          <h2 className="font-montserrat text-base font-semibold text-foreground">
            Daftar Rangkaian Kegiatan
          </h2>
          <p className="text-xs text-muted-foreground">
            Rangkaian kegiatan Pasanggiri {editionName} yang terhubung dengan album galeri dokumentasi.
          </p>
        </div>
        {canEdit && (
          <Button onClick={openCreateDialog} className="bg-dgb hover:bg-dgb/90 text-white text-xs h-9">
            <Plus size={15} className="mr-1.5" /> Tambah Acara
          </Button>
        )}
      </div>

      {/* Grid of Events */}
      {eventsList.length === 0 ? (
        <AdminEmptyState
          icon="gallery"
          title="Belum ada acara"
          description={`Belum ada rangkaian kegiatan untuk ${editionName}. Klik tombol Tambah Acara untuk memulai.`}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {eventsList.map((ev) => (
            <AdminCard key={ev.id} className="flex flex-col justify-between overflow-hidden">
              <div>
                {/* Hero / Cover Image */}
                <div className="relative aspect-video w-full overflow-hidden bg-muted">
                  {ev.heroMedia ? (
                    <Image
                      src={ev.heroMedia.url}
                      alt={ev.heroMedia.alt || ev.label}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 400px"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <ImageIcon size={32} className="opacity-40" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2 flex gap-1.5">
                    <AdminBadge value={ev.active ? "active" : "archived"} />
                  </div>
                </div>

                {/* Event Details */}
                <div className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-muted-foreground">
                      Urutan: {ev.displayOrder}
                    </span>
                    <span className="text-xs text-fb font-mono font-medium">
                      /{ev.slug}
                    </span>
                  </div>
                  <h3 className="font-montserrat text-sm font-semibold text-foreground line-clamp-1">
                    {ev.label}
                  </h3>
                  {ev.description ? (
                    <p className="font-inter text-xs text-muted-foreground line-clamp-2">
                      {ev.description}
                    </p>
                  ) : (
                    <p className="font-inter text-xs italic text-muted-foreground/60">
                      Tidak ada deskripsi.
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons & Gallery Links */}
              <div className="border-t border-border p-4 pt-3 bg-muted/20 flex items-center justify-between gap-2">
                <Link
                  href={`/admin/content/galleries?eventId=${ev.id}`}
                  className="inline-flex items-center text-xs font-medium text-fb hover:underline"
                >
                  <Calendar size={13} className="mr-1" />
                  {ev.galleryCount} Album Galeri
                </Link>

                <div className="flex items-center gap-1.5">
                  {canEdit && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(ev)}
                      className="h-8 px-2.5 text-xs"
                    >
                      <FileEdit size={13} className="mr-1" /> Edit
                    </Button>
                  )}
                  {canEdit && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeleteTarget(ev)}
                      className="h-8 px-2 text-xs"
                    >
                      <Trash2 size={13} />
                    </Button>
                  )}
                </div>
              </div>
            </AdminCard>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={isNewDialogOpen} onOpenChange={setIsNewDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-montserrat text-lg">
              {editingEvent ? "Edit Acara" : "Tambah Acara Baru"}
            </DialogTitle>
            <DialogDescription className="font-inter text-xs">
              Isi data rangkaian acara Pasanggiri {editionName}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Nama Acara *</label>
              <Input
                value={label}
                onChange={(e) => handleLabelChange(e.target.value)}
                placeholder="Contoh: Malam Grand Final"
                className="text-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Slug URL *</label>
              <Input
                value={slug}
                onChange={(e) => {
                  setIsSlugCustomized(true);
                  setSlug(slugify(e.target.value));
                }}
                placeholder="malam-grand-final"
                className="text-xs font-mono"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Deskripsi Singkat</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Deskripsi kegiatan..."
                className="text-xs min-h-[70px]"
              />
            </div>

            <div className="space-y-1.5">
              <AdminMediaField
                name="heroMediaId"
                label="Foto Sampul / Hero Acara"
                value={heroMediaId}
                initialAsset={heroMedia}
                onChange={(asset) => {
                  setHeroMediaId(asset?.id ?? null);
                  setHeroMedia(asset);
                }}
                activeEditionId={editionId}
                canManageMedia={canEdit}
                hint="Pilih foto sampul berkualitas baik untuk header acara."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Nomor Urut</label>
                <Input
                  type="number"
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(parseInt(e.target.value, 10) || 0)}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium">Status Acara</label>
                <select
                  value={active ? "active" : "inactive"}
                  onChange={(e) => setActive(e.target.value === "active")}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus:outline-hidden focus:ring-1 focus:ring-ring"
                >
                  <option value="active">Aktif</option>
                  <option value="inactive">Nonaktif</option>
                </select>
              </div>
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsNewDialogOpen(false)}
                className="text-xs"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-dgb hover:bg-dgb/90 text-white text-xs"
              >
                {isSubmitting ? "Menyimpan..." : "Simpan Acara"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-montserrat">Hapus Acara</AlertDialogTitle>
            <AlertDialogDescription className="font-inter text-xs">
              Apakah Anda yakin ingin menghapus acara <strong>&quot;{deleteTarget?.label}&quot;</strong>? Semua data galeri yang terhubung dengan acara ini akan ikut terpengaruh.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs"
            >
              {isSubmitting ? "Menghapus..." : "Hapus Acara"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

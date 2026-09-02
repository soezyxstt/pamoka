"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Eye,
  FileEdit,
  Globe,
  ImageIcon,
  LayoutGrid,
  Plus,
  Save,
  Trash2,
  Video,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import {
  AdminMediaField,
  AdminMediaPicker,
  type MediaAssetSummary,
} from "@/components/admin/media-picker";
import {
  AdminBadge,
  AdminCard,
  AdminCardHeader,
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
  addGalleryItemsAction,
  deleteGalleryItemAction,
  reorderGalleryItemsAction,
  updateGalleryAction,
  updateGalleryItemAction,
} from "../actions";

export type GalleryItemDetail = {
  id: string;
  galleryId: string;
  mediaId: string | null;
  youtubeId: string | null;
  caption: string | null;
  displayOrder: number;
  active: boolean;
  media: MediaAssetSummary | null;
};

export type GalleryDetail = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  ownerType: "standalone" | "event";
  ownerId: string;
  displayOrder: number;
  status: string;
  active: boolean;
  version: number;
  coverMediaId: string | null;
  coverAsset: MediaAssetSummary | null;
};

export type SiblingGallery = {
  id: string;
  title: string;
  slug: string;
  displayOrder: number;
  itemCount: number;
};

export type GalleryWorkspaceProps = {
  gallery: GalleryDetail;
  initialItems: GalleryItemDetail[];
  siblingGalleries: SiblingGallery[];
  eventsList: { id: string; label: string }[];
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

export function GalleryWorkspace({
  gallery,
  initialItems,
  siblingGalleries,
  eventsList,
  editionName,
  editionId,
  canEdit,
}: GalleryWorkspaceProps) {
  // Metadata state
  const [title, setTitle] = useState(gallery.title);
  const [slug, setSlug] = useState(gallery.slug);
  const [description, setDescription] = useState(gallery.description ?? "");
  const [coverMediaId, setCoverMediaId] = useState<string | null>(gallery.coverMediaId);
  const [coverAsset, setCoverAsset] = useState<MediaAssetSummary | null>(gallery.coverAsset);
  const [ownerType, setOwnerType] = useState<"standalone" | "event">(gallery.ownerType);
  const [ownerId, setOwnerId] = useState<string>(gallery.ownerId);
  const [status, setStatus] = useState<"draft" | "published">(gallery.status as "draft" | "published");
  const [version, setVersion] = useState(gallery.version);
  const [isSavingMeta, setIsSavingMeta] = useState(false);

  // Items state
  const [items, setItems] = useState<GalleryItemDetail[]>(initialItems);
  const [batchPickerOpen, setBatchPickerOpen] = useState(false);
  const [youtubeDialogOpen, setYoutubeDialogOpen] = useState(false);
  const [youtubeInput, setYoutubeInput] = useState("");
  const [youtubeCaption, setYoutubeCaption] = useState("");
  const [deleteItemTarget, setDeleteItemTarget] = useState<GalleryItemDetail | null>(null);

  // View state
  const [viewMode, setViewMode] = useState<"split" | "editor" | "preview">("split");

  const handleSaveMeta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || title.trim().length < 2) {
      toast.error("Judul album minimal 2 karakter");
      return;
    }
    const finalSlug = slug.trim() || slugify(title);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(finalSlug)) {
      toast.error("Format slug tidak valid");
      return;
    }

    setIsSavingMeta(true);
    try {
      await updateGalleryAction({
        id: gallery.id,
        title: title.trim(),
        slug: finalSlug,
        description: description.trim() || null,
        coverMediaId,
        ownerType,
        ownerId: ownerType === "event" ? ownerId : editionId,
        status,
        version,
      });
      setVersion((v) => v + 1);
      toast.success("Metadata album berhasil diperbarui");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan metadata";
      toast.error(msg);
    } finally {
      setIsSavingMeta(false);
    }
  };

  const handleBatchSelectMedia = async (selectedAssets: MediaAssetSummary[]) => {
    if (!selectedAssets || selectedAssets.length === 0) return;
    const mediaIds = selectedAssets.map((a) => a.id);
    try {
      await addGalleryItemsAction({
        galleryId: gallery.id,
        mediaIds,
      });

      // Optimistic update
      const now = new Date().toISOString();
      const newItems: GalleryItemDetail[] = selectedAssets.map((asset, idx) => ({
        id: crypto.randomUUID(),
        galleryId: gallery.id,
        mediaId: asset.id,
        youtubeId: null,
        caption: null,
        displayOrder: items.length + idx + 1,
        active: true,
        media: asset,
      }));
      setItems((prev) => [...prev, ...newItems]);
      toast.success(`${selectedAssets.length} foto berhasil ditambahkan ke album`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menambahkan foto";
      toast.error(msg);
    }
  };

  const handleAddYoutube = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!youtubeInput.trim()) {
      toast.error("Masukkan YouTube Video ID atau URL");
      return;
    }

    let ytId = youtubeInput.trim();
    // Parse YouTube URL if full URL is given
    const urlMatch = ytId.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    if (urlMatch && urlMatch[1]) {
      ytId = urlMatch[1];
    }

    if (!/^[\w-]{6,20}$/.test(ytId)) {
      toast.error("Format ID YouTube tidak valid");
      return;
    }

    try {
      await addGalleryItemsAction({
        galleryId: gallery.id,
        youtubeId: ytId,
        caption: youtubeCaption.trim() || null,
      });

      const newItem: GalleryItemDetail = {
        id: crypto.randomUUID(),
        galleryId: gallery.id,
        mediaId: null,
        youtubeId: ytId,
        caption: youtubeCaption.trim() || null,
        displayOrder: items.length + 1,
        active: true,
        media: null,
      };
      setItems((prev) => [...prev, newItem]);
      toast.success("Video YouTube berhasil ditambahkan");
      setYoutubeDialogOpen(false);
      setYoutubeInput("");
      setYoutubeCaption("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menambahkan video YouTube";
      toast.error(msg);
    }
  };

  const handleMoveItem = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    const newItems = [...items];
    const [moved] = newItems.splice(index, 1);
    newItems.splice(targetIndex, 0, moved);

    // Reassign order
    const updated = newItems.map((item, idx) => ({ ...item, displayOrder: idx + 1 }));
    setItems(updated);

    try {
      await reorderGalleryItemsAction({
        galleryId: gallery.id,
        itemIds: updated.map((i) => i.id),
      });
    } catch {
      toast.error("Gagal menyimpan urutan item");
    }
  };

  const handleDeleteItem = async () => {
    if (!deleteItemTarget) return;
    try {
      await deleteGalleryItemAction({ itemId: deleteItemTarget.id });
      setItems((prev) => prev.filter((i) => i.id !== deleteItemTarget.id));
      toast.success("Item berhasil dihapus dari album");
      setDeleteItemTarget(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menghapus item";
      toast.error(msg);
    }
  };

  const handleUpdateItemCaption = async (item: GalleryItemDetail, newCaption: string) => {
    try {
      await updateGalleryItemAction({
        itemId: item.id,
        caption: newCaption,
      });
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, caption: newCaption } : i)),
      );
      toast.success("Keterangan item disimpan");
    } catch {
      toast.error("Gagal menyimpan keterangan");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & View Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <Link href="/admin/content/galleries">
            <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs">
              <ArrowLeft size={14} className="mr-1" /> Daftar Album
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-montserrat text-sm font-semibold text-foreground">
                {title || "Album Galeri"}
              </h2>
              <AdminBadge value={status} />
            </div>
            <p className="text-xs text-muted-foreground">
              {editionName} &bull; /{slug} &bull; {items.length} item tersimpan
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 p-1">
          <Button
            size="sm"
            variant={viewMode === "editor" ? "default" : "ghost"}
            onClick={() => setViewMode("editor")}
            className="h-7 text-xs px-2.5"
          >
            <FileEdit size={13} className="mr-1" /> Editor
          </Button>
          <Button
            size="sm"
            variant={viewMode === "split" ? "default" : "ghost"}
            onClick={() => setViewMode("split")}
            className="h-7 text-xs px-2.5 hidden lg:inline-flex"
          >
            <LayoutGrid size={13} className="mr-1" /> Split
          </Button>
          <Button
            size="sm"
            variant={viewMode === "preview" ? "default" : "ghost"}
            onClick={() => setViewMode("preview")}
            className="h-7 text-xs px-2.5"
          >
            <Eye size={13} className="mr-1" /> Preview
          </Button>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className={`grid gap-6 ${viewMode === "split" ? "lg:grid-cols-12" : "grid-cols-1"}`}>
        {/* Editor Column */}
        {(viewMode === "editor" || viewMode === "split") && (
          <div className={`${viewMode === "split" ? "lg:col-span-7" : "max-w-4xl mx-auto w-full"} space-y-6`}>
            {/* Metadata Card */}
            <AdminCard className="p-5 space-y-4">
              <AdminCardHeader
                eyebrow="Metadata Album"
                title="Pengaturan Album Galeri"
                description="Ubah judul, slug, cover, dan pengelompokan album."
              />

              <form onSubmit={handleSaveMeta} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Judul Album *</label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="text-xs"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Slug URL *</label>
                  <Input
                    value={slug}
                    onChange={(e) => setSlug(slugify(e.target.value))}
                    className="text-xs font-mono"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Deskripsi Album</label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="text-xs min-h-[60px]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Tipe Album</label>
                    <select
                      value={ownerType}
                      onChange={(e) => setOwnerType(e.target.value as "standalone" | "event")}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus:outline-hidden"
                    >
                      <option value="standalone">Standalone (Umum)</option>
                      <option value="event">Terkait Rangkaian Acara</option>
                    </select>
                  </div>

                  {ownerType === "event" ? (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium">Pilih Acara *</label>
                      <select
                        value={ownerId}
                        onChange={(e) => setOwnerId(e.target.value)}
                        className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus:outline-hidden"
                        required
                      >
                        {eventsList.map((ev) => (
                          <option key={ev.id} value={ev.id}>
                            {ev.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium">Status Publikasi</label>
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value as "published" | "draft")}
                        className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus:outline-hidden"
                      >
                        <option value="published">Published</option>
                        <option value="draft">Draft</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5 pt-2">
                  <AdminMediaField
                    name="coverMediaId"
                    label="Foto Sampul / Cover Album"
                    value={coverMediaId}
                    initialAsset={coverAsset}
                    onChange={(asset) => {
                      setCoverMediaId(asset?.id ?? null);
                      setCoverAsset(asset);
                    }}
                    activeEditionId={editionId}
                    canManageMedia={canEdit}
                    hint="Foto sampul utama yang mewakili keseluruhan album ini."
                  />
                </div>

                <div className="flex justify-end pt-3 border-t border-border">
                  <Button
                    type="submit"
                    disabled={isSavingMeta}
                    className="bg-dgb hover:bg-dgb/90 text-white text-xs h-8"
                  >
                    <Save size={13} className="mr-1.5" />
                    {isSavingMeta ? "Menyimpan..." : "Simpan Metadata"}
                  </Button>
                </div>
              </form>
            </AdminCard>

            {/* Items Management Card */}
            <AdminCard className="p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
                <div>
                  <h3 className="font-montserrat text-sm font-semibold text-foreground">
                    Daftar Foto & Video ({items.length})
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Pilih beberapa foto sekaligus atau tambahkan video YouTube.
                  </p>
                </div>

                {canEdit && (
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => setBatchPickerOpen(true)}
                      className="bg-dgb hover:bg-dgb/90 text-white text-xs h-8"
                    >
                      <ImageIcon size={13} className="mr-1.5" /> Pilih Banyak Foto
                    </Button>
                    <Button
                      onClick={() => setYoutubeDialogOpen(true)}
                      variant="outline"
                      className="text-xs h-8"
                    >
                      <Video size={13} className="mr-1.5" /> Tambah YouTube
                    </Button>
                  </div>
                )}
              </div>

              {/* Items List */}
              {items.length === 0 ? (
                <AdminEmptyState
                  icon="gallery"
                  title="Album masih kosong"
                  description="Gunakan tombol Pilih Banyak Foto atau Tambah YouTube di atas untuk mengisi album galeri ini."
                />
              ) : (
                <div className="space-y-3">
                  {items.map((item, idx) => (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 shadow-2xs hover:border-fb/40 transition-colors"
                    >
                      {/* Left: Preview & Type */}
                      <div className="flex items-center gap-3 min-w-[200px] flex-1">
                        <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                          {item.media ? (
                            <Image
                              src={item.media.url}
                              alt={item.media.alt || `Item ${idx + 1}`}
                              fill
                              className="object-cover"
                              sizes="80px"
                            />
                          ) : item.youtubeId ? (
                            <div className="relative h-full w-full bg-black/80 flex items-center justify-center">
                              <Image
                                src={`https://img.youtube.com/vi/${item.youtubeId}/hqdefault.jpg`}
                                alt="YouTube Thumbnail"
                                fill
                                className="object-cover opacity-80"
                                sizes="80px"
                              />
                              <Video size={18} className="absolute text-white drop-shadow-md" />
                            </div>
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                              <ImageIcon size={18} />
                            </div>
                          )}
                        </div>

                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-muted-foreground">
                              #{idx + 1}
                            </span>
                            {item.youtubeId ? (
                              <span className="inline-flex items-center gap-1 rounded bg-red-600/10 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">
                                <Video size={10} /> YouTube: {item.youtubeId}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded bg-emerald-600/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600">
                                <ImageIcon size={10} /> Foto
                              </span>
                            )}
                          </div>
                          <Input
                            defaultValue={item.caption ?? ""}
                            onBlur={(e) => {
                              if (e.target.value !== (item.caption ?? "")) {
                                handleUpdateItemCaption(item, e.target.value);
                              }
                            }}
                            placeholder="Tambah caption item..."
                            className="h-7 text-xs max-w-sm"
                          />
                        </div>
                      </div>

                      {/* Right: Reorder & Delete */}
                      <div className="flex items-center gap-1">
                        {canEdit && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={idx === 0}
                              onClick={() => handleMoveItem(idx, "up")}
                              className="h-7 w-7 p-0"
                              title="Pindahkan ke atas"
                            >
                              <ArrowUp size={13} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={idx === items.length - 1}
                              onClick={() => handleMoveItem(idx, "down")}
                              className="h-7 w-7 p-0"
                              title="Pindahkan ke bawah"
                            >
                              <ArrowDown size={13} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteItemTarget(item)}
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                              title="Hapus item"
                            >
                              <Trash2 size={13} />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </AdminCard>
          </div>
        )}

        {/* Live Split Preview Column */}
        {(viewMode === "preview" || viewMode === "split") && (
          <div className={`${viewMode === "split" ? "lg:col-span-5" : "max-w-4xl mx-auto w-full"} space-y-4`}>
            <div className="rounded-xl border border-border bg-card p-4 shadow-xs sticky top-4 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <span className="font-montserrat text-xs font-bold uppercase tracking-wider text-fb">
                  Live Preview Publik
                </span>
                <span className="text-[11px] text-muted-foreground font-mono">
                  {editionName}
                </span>
              </div>

              {/* Simulated Public Layout with Album Index & Content */}
              <div className="grid grid-cols-12 gap-3 min-h-[420px] rounded-lg border border-border/60 bg-background p-3">
                {/* Left Mini Sidebar Index */}
                <div className="col-span-4 border-r border-border/60 pr-2 space-y-2">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">
                    Daftar Album
                  </p>
                  <div className="space-y-1">
                    {siblingGalleries.map((sib, sIdx) => {
                      const isCurrent = sib.id === gallery.id;
                      return (
                        <div
                          key={sib.id}
                          className={`rounded-md p-1.5 text-[11px] transition-colors ${
                            isCurrent
                              ? "bg-fb/10 font-semibold text-fb border-l-2 border-fb"
                              : "text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="line-clamp-1">{sib.title}</span>
                            <span className="text-[9px] opacity-70">
                              {isCurrent ? items.length : sib.itemCount}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right Album Gallery Grid Section */}
                <div className="col-span-8 pl-1 space-y-3 overflow-y-auto max-h-[500px]">
                  <div>
                    <h4 className="font-montserrat text-sm font-bold text-foreground">
                      {title || "Judul Album"}
                    </h4>
                    {description && (
                      <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
                        {description}
                      </p>
                    )}
                  </div>

                  {/* Grid of items */}
                  {items.length === 0 ? (
                    <div className="py-12 text-center text-xs text-muted-foreground/60 italic">
                      Album belum memiliki foto atau video.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {items.map((item, i) => (
                        <div
                          key={item.id}
                          className="group relative aspect-square overflow-hidden rounded-md border border-border/80 bg-muted"
                        >
                          {item.media ? (
                            <Image
                              src={item.media.url}
                              alt={item.caption || item.media.alt || `Item ${i + 1}`}
                              fill
                              className="object-cover group-hover:scale-105 transition-transform duration-300"
                              sizes="160px"
                            />
                          ) : item.youtubeId ? (
                            <div className="relative h-full w-full bg-black flex items-center justify-center">
                              <Image
                                src={`https://img.youtube.com/vi/${item.youtubeId}/hqdefault.jpg`}
                                alt="YouTube Thumbnail"
                                fill
                                className="object-cover opacity-80"
                                sizes="160px"
                              />
                              <Video size={20} className="absolute text-white drop-shadow-md" />
                            </div>
                          ) : null}

                          {item.caption && (
                            <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 to-transparent p-1.5 pt-4">
                              <p className="text-[10px] text-white line-clamp-1 font-inter">
                                {item.caption}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Batch Media Picker Dialog */}
      <AdminMediaPicker
        open={batchPickerOpen}
        onOpenChange={setBatchPickerOpen}
        onSelect={(asset) => void handleBatchSelectMedia([asset])}
        canManageMedia={canEdit}
        activeEditionId={editionId}
      />

      {/* Add YouTube Video Dialog */}
      <Dialog open={youtubeDialogOpen} onOpenChange={setYoutubeDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-montserrat text-base">
              Tambah Video YouTube
            </DialogTitle>
            <DialogDescription className="font-inter text-xs">
              Masukkan ID video atau URL lengkap YouTube.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddYoutube} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">URL atau ID YouTube *</label>
              <Input
                value={youtubeInput}
                onChange={(e) => setYoutubeInput(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=dQw4w9WgXcQ atau dQw4w9WgXcQ"
                className="text-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Keterangan Video (Opsional)</label>
              <Input
                value={youtubeCaption}
                onChange={(e) => setYoutubeCaption(e.target.value)}
                placeholder="Malam Penobatan Grand Final 2025"
                className="text-xs"
              />
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setYoutubeDialogOpen(false)}
                className="text-xs"
              >
                Batal
              </Button>
              <Button type="submit" className="bg-dgb hover:bg-dgb/90 text-white text-xs">
                Tambahkan ke Album
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Item Confirmation Dialog */}
      <AlertDialog open={!!deleteItemTarget} onOpenChange={(open) => !open && setDeleteItemTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-montserrat">Hapus Item Galeri</AlertDialogTitle>
            <AlertDialogDescription className="font-inter text-xs">
              Apakah Anda yakin ingin menghapus item ini dari album? Tindakan ini tidak menghapus file media asli di perpustakaan media.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteItem}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs"
            >
              Hapus Item
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

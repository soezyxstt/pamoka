"use client";

import {
  ArrowUpRight,
  Check,
  FileIcon,
  FileImage,
  FileText,
  Folder,
  FolderOpen,
  Grid2X2,
  Image as ImageIcon,
  List,
  Search,
  Trash2,
  UploadCloud,
  Video,
  X,
} from "lucide-react";
import Image from "next/image";
import { type ChangeEvent, type DragEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useUploadThing } from "@/lib/uploadthing";
import { cn } from "@/lib/utils";
import { getMediaAssetsAction } from "@/app/admin/media/actions";

export type MediaAssetSummary = {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  bytes: number;
  alt: string | null;
  decorative: boolean;
  lifecycle: string;
  folderId: string | null;
  createdAt?: string;
  updatedAt?: string | null;
};

export type MediaFolderSummary = {
  id: string;
  parentId: string | null;
  editionId: string | null;
  name: string;
  slug: string;
  createdAt?: string;
  updatedAt?: string | null;
};

export type EditionSummary = {
  id: string;
  year: number;
  name: string;
};

function formatBytes(bytes: number) {
  if (!bytes || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getMimeBadge(mimeType: string) {
  if (mimeType.startsWith("image/")) {
    const ext = mimeType.replace("image/", "").toUpperCase();
    return { label: ext, color: "border-dgb-200 bg-dgb-50 text-dgb-800" };
  }
  if (mimeType.startsWith("video/")) {
    return { label: "VIDEO", color: "border-fb-200 bg-fb-50 text-fb-800" };
  }
  if (mimeType === "application/pdf") {
    return { label: "PDF", color: "border-rose-200 bg-rose-50 text-rose-800" };
  }
  return { label: "FILE", color: "border-border bg-muted text-muted-foreground" };
}

export function AdminMediaPreview({
  asset,
  aspectRatioHint,
  className,
}: {
  asset: MediaAssetSummary;
  aspectRatioHint?: string;
  className?: string;
}) {
  const isImage = asset.mimeType.startsWith("image/");
  const isVideo = asset.mimeType.startsWith("video/");
  const badge = getMimeBadge(asset.mimeType);

  return (
    <div className={cn("relative flex items-center gap-3.5 rounded-lg border border-dgb-100 bg-white p-3 shadow-xs", className)}>
      <div className="relative size-16 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
        {isImage ? (
          <Image
            src={asset.url}
            alt={asset.alt ?? asset.filename}
            fill
            sizes="64px"
            className="object-cover"
          />
        ) : isVideo ? (
          <div className="grid size-full place-items-center bg-fb-50 text-fb-700">
            <Video size={22} />
          </div>
        ) : (
          <div className="grid size-full place-items-center bg-dgb-50 text-dgb">
            <FileText size={22} />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={cn("rounded-sm border px-1.5 py-0.2 text-[10px] font-bold uppercase", badge.color)}>
            {badge.label}
          </span>
          {asset.decorative ? (
            <span className="rounded-sm border border-amber-200 bg-amber-50 px-1.5 py-0.2 text-[10px] font-semibold text-amber-800">
              Dekoratif
            </span>
          ) : asset.alt ? (
            <span className="max-w-44 truncate rounded-sm border border-dgb-100 bg-dgb-50/50 px-1.5 py-0.2 text-[10px] font-medium text-dgb-800">
              Alt: {asset.alt}
            </span>
          ) : null}
          {aspectRatioHint ? (
            <span className="rounded-sm border border-border bg-muted px-1.5 py-0.2 text-[10px] text-muted-foreground">
              Rasio {aspectRatioHint}
            </span>
          ) : null}
        </div>
        <p className="truncate font-inter text-xs font-semibold text-dgb-900" title={asset.filename}>
          {asset.filename}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {formatBytes(asset.bytes)} · {asset.lifecycle}
        </p>
      </div>

      <a
        href={asset.url}
        target="_blank"
        rel="noreferrer"
        className="grid size-8 shrink-0 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:border-dgb-200 hover:bg-dgb-50 hover:text-dgb"
        title="Lihat file asli"
        aria-label="Lihat file asli"
      >
        <ArrowUpRight size={14} />
      </a>
    </div>
  );
}

export type AdminMediaPickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (asset: MediaAssetSummary) => void;
  selectedAssetId?: string | null;
  acceptType?: "image" | "video" | "pdf" | "all";
  title?: string;
  description?: string;
  canManageMedia?: boolean;
  initialAssets?: MediaAssetSummary[];
  initialFolders?: MediaFolderSummary[];
  activeEditionId?: string | null;
};

export function AdminMediaPicker({
  open,
  onOpenChange,
  onSelect,
  selectedAssetId,
  acceptType = "all",
  title = "Pilih media",
  description = "Pilih aset dari pustaka atau unggah file baru.",
  canManageMedia = true,
  initialAssets = [],
  initialFolders = [],
  activeEditionId = null,
}: AdminMediaPickerProps) {
  const [assets, setAssets] = useState<MediaAssetSummary[]>(initialAssets);
  const [folders, setFolders] = useState<MediaFolderSummary[]>(initialFolders);
  const [editions, setEditions] = useState<EditionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState<string | null | "all">("all");
  const [selectedFolderScope, setSelectedFolderScope] = useState<"all" | "edition" | "global">("all");
  const [typeFilter, setTypeFilter] = useState<"image" | "video" | "pdf" | "all">(acceptType);
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedId, setSelectedId] = useState<string | null>(selectedAssetId ?? null);
  const [filesToUpload, setFilesToUpload] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeUploadEndpoint = typeFilter === "video" ? "video" : typeFilter === "pdf" ? "pdf" : "image";

  const { startUpload, isUploading } = useUploadThing(activeUploadEndpoint, {
    onClientUploadComplete: (res) => {
      setFilesToUpload([]);
      toast.success("Media berhasil diunggah");
      loadData().then((fetched) => {
        if (res && res[0] && fetched) {
          const matching = fetched.find((a) => a.url === res[0]?.url || a.filename === res[0]?.name);
          if (matching) {
            setSelectedId(matching.id);
          }
        }
      });
    },
    onUploadError: (error) => {
      toast.error(error.message || "Upload media gagal");
    },
  });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getMediaAssetsAction({
        type: typeFilter,
        folderId: currentFolderId === "all" ? "all" : currentFolderId,
        search: query.trim() || undefined,
      });
      setAssets(res.assets);
      setFolders(res.folders);
      setEditions(res.editions);
      return res.assets;
    } catch {
      toast.error("Gagal memuat pustaka media");
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [typeFilter, currentFolderId, query]);

  const [prevSelectedAssetId, setPrevSelectedAssetId] = useState(selectedAssetId);
  if (selectedAssetId !== prevSelectedAssetId) {
    setPrevSelectedAssetId(selectedAssetId);
    setSelectedId(selectedAssetId ?? null);
  }

  useEffect(() => {
    if (open) {
      void loadData();
    }
  }, [open, loadData]);

  const activeEdition = useMemo(
    () => editions.find((e) => e.id === activeEditionId),
    [editions, activeEditionId]
  );

  const scopedFolders = useMemo(() => {
    if (selectedFolderScope === "edition" && activeEditionId) {
      return folders.filter((f) => f.editionId === activeEditionId);
    }
    if (selectedFolderScope === "global") {
      return folders.filter((f) => !f.editionId);
    }
    return folders;
  }, [folders, selectedFolderScope, activeEditionId]);

  const activeSelectedAsset = useMemo(
    () => assets.find((a) => a.id === selectedId) ?? null,
    [assets, selectedId]
  );

  const handleFileDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    filterAndSetFiles(files);
  };

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    filterAndSetFiles(files);
  };

  const filterAndSetFiles = (files: File[]) => {
    if (typeFilter === "image" || acceptType === "image") {
      const images = files.filter((f) => f.type.startsWith("image/"));
      if (images.length !== files.length) {
        toast.error("Hanya file gambar (JPEG, PNG, WebP, AVIF) yang diizinkan");
      }
      setFilesToUpload(images);
    } else if (typeFilter === "video" || acceptType === "video") {
      const videos = files.filter((f) => f.type.startsWith("video/"));
      if (videos.length !== files.length) {
        toast.error("Hanya file video yang diizinkan");
      }
      setFilesToUpload(videos.slice(0, 1));
    } else if (typeFilter === "pdf" || acceptType === "pdf") {
      const pdfs = files.filter((f) => f.type === "application/pdf");
      if (pdfs.length !== files.length) {
        toast.error("Hanya file PDF yang diizinkan");
      }
      setFilesToUpload(pdfs);
    } else {
      setFilesToUpload(files);
    }
  };

  const handleConfirmSelect = () => {
    if (!activeSelectedAsset) return;
    onSelect(activeSelectedAsset);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden max-h-[90vh] flex flex-col gap-0 sm:max-w-4xl">
        <DialogHeader className="border-b border-dgb-100 bg-background px-5 py-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <DialogTitle className="font-montserrat text-lg font-semibold text-dgb-900">{title}</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">{description}</DialogDescription>
            </div>
            {activeEdition ? (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-dgb-200 bg-dgb-50 px-2.5 py-1 text-xs font-semibold text-dgb">
                Edisi: {activeEdition.name} ({activeEdition.year})
              </span>
            ) : null}
          </div>
        </DialogHeader>

        <div className="grid min-h-[32rem] flex-1 overflow-hidden lg:grid-cols-[200px_minmax(0,1fr)_260px]">
          {/* Left Sidebar: Folder Browser & Scope */}
          <aside className="border-b border-border bg-dgb-50/25 p-3.5 lg:border-b-0 lg:border-r overflow-y-auto">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-dgb-800">Cakupan Folder</p>
            <div className="mt-2 space-y-1">
              <button
                type="button"
                onClick={() => {
                  setSelectedFolderScope("all");
                  setCurrentFolderId("all");
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition-colors",
                  selectedFolderScope === "all" && currentFolderId === "all"
                    ? "bg-dgb text-white"
                    : "text-dgb-900 hover:bg-dgb-50"
                )}
              >
                <FolderOpen size={14} /> Semua media
              </button>
              {activeEditionId ? (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFolderScope("edition");
                    setCurrentFolderId("all");
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition-colors",
                    selectedFolderScope === "edition" ? "bg-dgb text-white" : "text-dgb-900 hover:bg-dgb-50"
                  )}
                >
                  <Folder size={14} /> Folder edisi ini
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setSelectedFolderScope("global");
                  setCurrentFolderId("all");
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition-colors",
                  selectedFolderScope === "global" ? "bg-dgb text-white" : "text-dgb-900 hover:bg-dgb-50"
                )}
              >
                <Folder size={14} /> Folder global
              </button>
            </div>

            <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.16em] text-dgb-800">Daftar Folder</p>
            <div className="mt-2 space-y-0.5">
              <button
                type="button"
                onClick={() => setCurrentFolderId(null)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors",
                  currentFolderId === null ? "bg-white font-semibold text-dgb shadow-xs" : "text-dgb-900/80 hover:bg-white/70"
                )}
              >
                <Folder size={13} /> Root media
              </button>
              {scopedFolders.map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => setCurrentFolderId(folder.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors",
                    currentFolderId === folder.id ? "bg-white font-semibold text-dgb shadow-xs" : "text-dgb-900/80 hover:bg-white/70"
                  )}
                >
                  <Folder size={13} />
                  <span className="truncate">{folder.name}</span>
                </button>
              ))}
            </div>
          </aside>

          {/* Center: Search, Upload panel, Asset Grid */}
          <section className="flex flex-col min-w-0 p-4 overflow-y-auto">
            {/* Toolbar */}
            <div className="flex flex-col gap-3 border-b border-border pb-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Cari nama file atau teks alt..."
                  className="h-9 pl-8 text-xs rounded-md"
                />
              </div>

              <div className="flex items-center gap-2">
                {acceptType === "all" ? (
                  <div className="flex rounded-md border border-border bg-muted p-0.5">
                    <button
                      type="button"
                      onClick={() => setTypeFilter("all")}
                      className={cn("px-2 py-1 text-[11px] font-medium rounded-xs", typeFilter === "all" ? "bg-white text-dgb shadow-xs" : "text-muted-foreground")}
                    >
                      Semua
                    </button>
                    <button
                      type="button"
                      onClick={() => setTypeFilter("image")}
                      className={cn("px-2 py-1 text-[11px] font-medium rounded-xs", typeFilter === "image" ? "bg-white text-dgb shadow-xs" : "text-muted-foreground")}
                    >
                      Gambar
                    </button>
                    <button
                      type="button"
                      onClick={() => setTypeFilter("video")}
                      className={cn("px-2 py-1 text-[11px] font-medium rounded-xs", typeFilter === "video" ? "bg-white text-dgb shadow-xs" : "text-muted-foreground")}
                    >
                      Video
                    </button>
                    <button
                      type="button"
                      onClick={() => setTypeFilter("pdf")}
                      className={cn("px-2 py-1 text-[11px] font-medium rounded-xs", typeFilter === "pdf" ? "bg-white text-dgb shadow-xs" : "text-muted-foreground")}
                    >
                      PDF
                    </button>
                  </div>
                ) : null}

                <div className="flex rounded-md border border-border bg-muted p-0.5">
                  <button
                    type="button"
                    aria-label="Grid view"
                    onClick={() => setViewMode("grid")}
                    className={cn("grid size-7 place-items-center rounded-xs", viewMode === "grid" ? "bg-white text-dgb shadow-xs" : "text-muted-foreground")}
                  >
                    <Grid2X2 size={13} />
                  </button>
                  <button
                    type="button"
                    aria-label="List view"
                    onClick={() => setViewMode("list")}
                    className={cn("grid size-7 place-items-center rounded-xs", viewMode === "list" ? "bg-white text-dgb shadow-xs" : "text-muted-foreground")}
                  >
                    <List size={13} />
                  </button>
                </div>
              </div>
            </div>

            {/* Inline Uploader (Accessible for media.manage) */}
            {canManageMedia ? (
              <div
                onDragEnter={() => setIsDragging(true)}
                onDragOver={(e) => e.preventDefault()}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleFileDrop}
                className={cn(
                  "my-3 rounded-lg border border-dashed p-3 text-center transition-colors",
                  isDragging ? "border-fb-400 bg-fb-50" : "border-dgb-200 bg-dgb-50/20"
                )}
              >
                <input
                  ref={fileInputRef}
                  className="hidden"
                  type="file"
                  accept={
                    activeUploadEndpoint === "image"
                      ? "image/jpeg,image/png,image/webp,image/avif"
                      : activeUploadEndpoint === "video"
                      ? "video/mp4,video/webm"
                      : "application/pdf"
                  }
                  multiple={activeUploadEndpoint === "image"}
                  onChange={handleFileInput}
                />
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2.5 text-left">
                    <span className="grid size-8 shrink-0 place-items-center rounded-md bg-dgb text-white">
                      <UploadCloud size={15} />
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-dgb-900">Unggah file baru</p>
                      <p className="text-[11px] text-muted-foreground">
                        {filesToUpload.length ? `${filesToUpload.length} file dipilih` : "Tarik file ke sini atau pilih dari perangkat"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs border-dgb-200 text-dgb hover:bg-dgb-50"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Pilih file
                    </Button>
                    {filesToUpload.length > 0 ? (
                      <Button
                        type="button"
                        size="sm"
                        disabled={isUploading}
                        className="h-8 bg-dgb text-xs text-white hover:bg-dgb-600"
                        onClick={() =>
                          startUpload(filesToUpload, {
                            folderId: typeof currentFolderId === "string" ? currentFolderId : null,
                          })
                        }
                      >
                        {isUploading ? "Mengunggah..." : `Unggah (${filesToUpload.length})`}
                      </Button>
                    ) : null}
                  </div>
                </div>

                {filesToUpload.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {filesToUpload.map((file) => (
                      <span
                        key={`${file.name}-${file.lastModified}`}
                        className="inline-flex items-center gap-1.5 rounded-md bg-white px-2 py-1 text-[11px] font-medium text-dgb-800 border border-dgb-100"
                      >
                        <FileImage size={12} />
                        <span className="max-w-36 truncate">{file.name}</span>
                        <button
                          type="button"
                          aria-label={`Hapus ${file.name}`}
                          onClick={() => setFilesToUpload((curr) => curr.filter((f) => f !== file))}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Asset List */}
            {isLoading ? (
              <div className="flex flex-1 items-center justify-center py-12 text-xs text-muted-foreground">
                Memuat aset...
              </div>
            ) : assets.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
                <span className="grid size-10 place-items-center rounded-md bg-muted text-muted-foreground">
                  <FileIcon size={18} />
                </span>
                <p className="mt-2 font-montserrat text-sm font-semibold text-dgb-900">Tidak ada file yang sesuai</p>
                <p className="text-xs text-muted-foreground">Coba ubah filter atau unggah media baru.</p>
              </div>
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-2 gap-2.5 pt-2 sm:grid-cols-3 md:grid-cols-4">
                {assets.map((asset) => {
                  const isImg = asset.mimeType.startsWith("image/");
                  const isVid = asset.mimeType.startsWith("video/");
                  const isSelected = selectedId === asset.id;

                  return (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => setSelectedId(asset.id)}
                      className={cn(
                        "group relative flex flex-col overflow-hidden rounded-lg border text-left transition-all",
                        isSelected
                          ? "border-fb-400 bg-fb-50/30 ring-2 ring-fb-300"
                          : "border-border bg-white hover:border-dgb-200"
                      )}
                    >
                      <div className="relative aspect-square w-full bg-muted">
                        {isImg ? (
                          <Image
                            src={asset.url}
                            alt={asset.alt ?? asset.filename}
                            fill
                            sizes="(max-width: 640px) 50vw, 160px"
                            className="object-cover transition-transform duration-200 group-hover:scale-102"
                          />
                        ) : isVid ? (
                          <div className="grid size-full place-items-center bg-fb-50 text-fb-700">
                            <Video size={24} />
                          </div>
                        ) : (
                          <div className="grid size-full place-items-center bg-dgb-50 text-dgb">
                            <FileText size={24} />
                          </div>
                        )}
                        {isSelected ? (
                          <div className="absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-fb text-white shadow-xs">
                            <Check size={12} strokeWidth={3} />
                          </div>
                        ) : null}
                      </div>
                      <div className="p-2">
                        <p className="truncate text-xs font-semibold text-dgb-900" title={asset.filename}>
                          {asset.filename}
                        </p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          {formatBytes(asset.bytes)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-1.5 pt-2">
                {assets.map((asset) => {
                  const isImg = asset.mimeType.startsWith("image/");
                  const isSelected = selectedId === asset.id;

                  return (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => setSelectedId(asset.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-md border p-2 text-left transition-colors",
                        isSelected
                          ? "border-fb-400 bg-fb-50/40 ring-1 ring-fb-300"
                          : "border-border bg-white hover:border-dgb-200"
                      )}
                    >
                      <div className="relative size-10 shrink-0 overflow-hidden rounded-md bg-muted">
                        {isImg ? (
                          <Image src={asset.url} alt="" fill sizes="40px" className="object-cover" />
                        ) : (
                          <div className="grid size-full place-items-center text-muted-foreground">
                            <FileText size={16} />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-dgb-900">{asset.filename}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatBytes(asset.bytes)} · {asset.mimeType}
                        </p>
                      </div>
                      {isSelected ? <Check size={15} className="mr-1 text-fb" /> : null}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Right Sidebar: Selected Asset Inspector & Confirmation */}
          <aside className="border-t border-border bg-muted/20 p-4 lg:border-l lg:border-t-0 flex flex-col justify-between overflow-y-auto">
            {activeSelectedAsset ? (
              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-fb-700">Detail Terpilih</p>
                <div className="relative aspect-video overflow-hidden rounded-lg border border-border bg-muted">
                  {activeSelectedAsset.mimeType.startsWith("image/") ? (
                    <Image
                      src={activeSelectedAsset.url}
                      alt={activeSelectedAsset.alt ?? activeSelectedAsset.filename}
                      fill
                      sizes="240px"
                      className="object-cover"
                    />
                  ) : activeSelectedAsset.mimeType.startsWith("video/") ? (
                    <div className="grid size-full place-items-center bg-fb-50 text-fb-700">
                      <Video size={30} />
                    </div>
                  ) : (
                    <div className="grid size-full place-items-center bg-dgb-50 text-dgb">
                      <FileText size={30} />
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="break-words font-montserrat text-xs font-semibold text-dgb-900">
                    {activeSelectedAsset.filename}
                  </h4>
                  <dl className="mt-2 space-y-1 text-[11px]">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Ukuran</dt>
                      <dd className="font-medium text-foreground">{formatBytes(activeSelectedAsset.bytes)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Format</dt>
                      <dd className="max-w-28 truncate font-medium text-foreground">{activeSelectedAsset.mimeType}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Alt Text</dt>
                      <dd className="max-w-28 truncate font-medium text-foreground">
                        {activeSelectedAsset.decorative ? "(Dekoratif)" : activeSelectedAsset.alt ?? "Belum diisi"}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-muted-foreground">
                <p className="font-medium">Belum ada aset dipilih</p>
                <p className="mt-1 text-[11px]">Klik salah satu aset pada daftar untuk memilih.</p>
              </div>
            )}

            <div className="mt-4 border-t border-border pt-3 space-y-2">
              <Button
                type="button"
                disabled={!activeSelectedAsset}
                onClick={handleConfirmSelect}
                className="w-full h-9 bg-dgb text-xs font-semibold text-white hover:bg-dgb-600"
              >
                Gunakan media ini
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="w-full h-9 text-xs"
              >
                Batal
              </Button>
            </div>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export type AdminMediaFieldProps = {
  name: string;
  label?: string;
  hint?: string;
  aspectRatioHint?: string;
  value?: string | null;
  initialAsset?: MediaAssetSummary | null;
  acceptType?: "image" | "video" | "pdf" | "all";
  canManageMedia?: boolean;
  required?: boolean;
  className?: string;
  onChange?: (asset: MediaAssetSummary | null) => void;
  activeEditionId?: string | null;
};

export function AdminMediaField({
  name,
  label,
  hint,
  aspectRatioHint,
  value,
  initialAsset = null,
  acceptType = "image",
  canManageMedia = true,
  required = false,
  className,
  onChange,
  activeEditionId = null,
}: AdminMediaFieldProps) {
  const [selectedAsset, setSelectedAsset] = useState<MediaAssetSummary | null>(initialAsset);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);

  const [prevInitialAsset, setPrevInitialAsset] = useState(initialAsset);
  if (initialAsset !== prevInitialAsset) {
    setPrevInitialAsset(initialAsset);
    setSelectedAsset(initialAsset);
  }

  const handleSelect = (asset: MediaAssetSummary) => {
    setSelectedAsset(asset);
    onChange?.(asset);
  };

  const handleRemove = () => {
    setSelectedAsset(null);
    onChange?.(null);
    setConfirmRemoveOpen(false);
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label ? (
        <div className="flex items-center justify-between">
          <span className="block text-xs font-semibold text-foreground">
            {label} {required ? <span className="text-destructive">*</span> : null}
          </span>
          {aspectRatioHint ? (
            <span className="text-[11px] text-muted-foreground">Rasio {aspectRatioHint}</span>
          ) : null}
        </div>
      ) : null}

      <input type="hidden" name={name} value={selectedAsset?.id ?? value ?? ""} />

      {selectedAsset ? (
        <div className="space-y-2">
          <AdminMediaPreview asset={selectedAsset} aspectRatioHint={aspectRatioHint} />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs border-dgb-200 bg-white text-dgb hover:bg-dgb-50"
              onClick={() => setPickerOpen(true)}
            >
              Ganti media
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs border-rose-200 text-destructive hover:bg-rose-50"
              onClick={() => setConfirmRemoveOpen(true)}
            >
              <Trash2 size={13} className="mr-1" /> Lepas media
            </Button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => setPickerOpen(true)}
          className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-dgb-200 bg-dgb-50/20 px-4 py-6 text-center transition-colors hover:border-fb-300 hover:bg-fb-50/30"
        >
          <span className="grid size-10 place-items-center rounded-md bg-white border border-dgb-100 text-dgb shadow-xs">
            {acceptType === "video" ? (
              <Video size={18} />
            ) : acceptType === "pdf" ? (
              <FileText size={18} />
            ) : (
              <ImageIcon size={18} />
            )}
          </span>
          <p className="mt-2 text-xs font-semibold text-dgb-900">Pilih media</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {aspectRatioHint ? `Disarankan rasio ${aspectRatioHint}. ` : ""}
            Klik untuk membuka pustaka media.
          </p>
        </div>
      )}

      {hint ? <p className="text-[11px] leading-4 text-muted-foreground">{hint}</p> : null}

      <AdminMediaPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={handleSelect}
        selectedAssetId={selectedAsset?.id}
        acceptType={acceptType}
        canManageMedia={canManageMedia}
        activeEditionId={activeEditionId}
      />

      <AlertDialog open={confirmRemoveOpen} onOpenChange={setConfirmRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-montserrat">Lepas media terpilih?</AlertDialogTitle>
            <AlertDialogDescription>
              Aset media tidak akan terhapus dari pustaka, hanya dilepas dari input formulir ini.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove} className="bg-destructive text-white hover:bg-destructive/90">
              Lepas media
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

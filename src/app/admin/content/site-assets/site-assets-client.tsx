"use client";

import {
  Trash2,
} from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  AdminBadge,
  AdminButton,
  AdminCard,
  AdminField,
  AdminInput,
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
import { cn } from "@/lib/utils";
import {
  SITE_ASSET_GROUPS,
  type SiteAssetGroup,
  type SiteAssetSlotDefinition,
} from "@/server/cms/site-asset-manifest";
import type { SiteAssetBindingRow } from "@/server/db/schema";
import { bindSiteAssetAction, unbindSiteAssetAction } from "./actions";

export type SiteAssetSlotWithData = {
  definition: SiteAssetSlotDefinition;
  binding: SiteAssetBindingRow | null;
  mediaAsset: MediaAssetSummary | null;
};

export type SiteAssetsClientProps = {
  edition: {
    id: string;
    year: number;
    name: string;
    lifecycle: string;
  };
  slotsData: SiteAssetSlotWithData[];
  canManageContent?: boolean;
};

export function SiteAssetsClient({
  edition,
  slotsData,
  canManageContent = true,
}: SiteAssetsClientProps) {
  const [activeGroup, setActiveGroup] = useState<SiteAssetGroup>("home");

  const totalSlots = slotsData.length;
  const filledSlots = slotsData.filter((s) => Boolean(s.binding?.mediaId && s.mediaAsset)).length;
  const requiredSlots = slotsData.filter((s) => s.definition.required);
  const requiredFilled = requiredSlots.filter((s) => Boolean(s.binding?.mediaId && s.mediaAsset)).length;

  const currentGroupSlots = slotsData.filter((s) => s.definition.group === activeGroup);

  return (
    <div className="space-y-6">
      {/* Overview Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Total Slot Aset</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-montserrat text-2xl font-bold text-foreground">{totalSlots}</span>
            <span className="text-xs text-muted-foreground">Terdaftar di sistem</span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-dgb-800">Aset Terpasang</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-montserrat text-2xl font-bold text-dgb">{filledSlots}</span>
            <span className="text-xs text-muted-foreground">dari {totalSlots} slot</span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-fb-800">Slot Wajib Terisi</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-montserrat text-2xl font-bold text-fb">
              {requiredFilled}/{requiredSlots.length}
            </span>
            <AdminBadge
              value={requiredFilled === requiredSlots.length ? "ready" : "draft"}
              className={requiredFilled === requiredSlots.length ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-800"}
            />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Halaman Terkait</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-montserrat text-2xl font-bold text-foreground">3 Halaman</span>
            <span className="text-xs text-muted-foreground">Beranda, Tentang, Kategori</span>
          </div>
        </div>
      </div>

      {/* Tabs for Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        {SITE_ASSET_GROUPS.map((grp) => {
          const groupSlots = slotsData.filter((s) => s.definition.group === grp.key);
          const groupFilled = groupSlots.filter((s) => Boolean(s.binding?.mediaId && s.mediaAsset)).length;
          const isActive = activeGroup === grp.key;

          return (
            <button
              key={grp.key}
              type="button"
              onClick={() => setActiveGroup(grp.key)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold transition-all",
                isActive
                  ? "bg-dgb text-white shadow-xs"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <span>{grp.label}</span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px]",
                  isActive ? "bg-white/20 text-white" : "bg-background text-foreground border border-border"
                )}
              >
                {groupFilled}/{groupSlots.length}
              </span>
            </button>
          );
        })}
      </div>

      {/* Slots Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {currentGroupSlots.map((item) => (
          <SiteAssetSlotCard
            key={item.definition.slotKey}
            item={item}
            editionId={edition.id}
            canManageContent={canManageContent}
          />
        ))}
      </div>
    </div>
  );
}

function SiteAssetSlotCard({
  item,
  editionId,
  canManageContent,
}: {
  item: SiteAssetSlotWithData;
  editionId: string;
  canManageContent: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [selectedAsset, setSelectedAsset] = useState<MediaAssetSummary | null>(item.mediaAsset);
  const [altOverride, setAltOverride] = useState(item.binding?.altOverride ?? "");
  const [focalX, setFocalX] = useState<number>(item.binding?.focalX ?? 50);
  const [focalY, setFocalY] = useState<number>(item.binding?.focalY ?? 50);
  const [isConfirmUnbindOpen, setIsConfirmUnbindOpen] = useState(false);

  const { definition, binding } = item;
  const isBound = Boolean(binding?.mediaId && item.mediaAsset);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageContent) return;

    if (!selectedAsset?.id) {
      toast.error("Pilih media terlebih dahulu");
      return;
    }

    const formData = new FormData();
    formData.set("slotKey", definition.slotKey);
    formData.set("mediaId", selectedAsset.id);
    formData.set("altOverride", altOverride.trim());
    formData.set("focalX", String(focalX));
    formData.set("focalY", String(focalY));

    startTransition(async () => {
      try {
        await bindSiteAssetAction(formData);
        toast.success(`Slot ${definition.label} berhasil disimpan`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Gagal menyimpan aset");
      }
    });
  };

  const handleUnbind = () => {
    if (!canManageContent) return;

    const formData = new FormData();
    formData.set("slotKey", definition.slotKey);

    startTransition(async () => {
      try {
        await unbindSiteAssetAction(formData);
        setSelectedAsset(null);
        setAltOverride("");
        setIsConfirmUnbindOpen(false);
        toast.success(`Media pada slot ${definition.label} berhasil dilepas`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Gagal melepas media");
      }
    });
  };

  return (
    <AdminCard className="flex flex-col justify-between overflow-hidden">
      <div>
        {/* Header with Slot Identity */}
        <div className="border-b border-border bg-muted/20 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded-sm border border-border bg-background px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  {definition.pageLabel} ({definition.pageRoute})
                </span>
                <span className="rounded-sm border border-dgb-100 bg-dgb-50/60 px-1.5 py-0.5 text-[10px] font-bold uppercase text-dgb-800">
                  {definition.acceptType}
                </span>
                <span className="rounded-sm border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  Rasio {definition.aspectRatio}
                </span>
                {definition.required ? (
                  <span className="rounded-sm border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                    Wajib
                  </span>
                ) : null}
              </div>
              <h4 className="font-montserrat text-sm font-semibold text-dgb-900">
                {definition.label}
              </h4>
            </div>

            <AdminBadge
              value={isBound ? "active" : "draft"}
              className={isBound ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600"}
            />
          </div>

          <p className="mt-2 text-xs text-muted-foreground">{definition.description}</p>
          <p className="mt-1 text-[11px] font-mono text-muted-foreground/80">Kunci: {definition.slotKey}</p>
        </div>

        {/* Media Selector & Configuration Body */}
        <form id={`form-${definition.slotKey}`} onSubmit={handleSave} className="space-y-4 p-4">
          <AdminMediaField
            name={`media-${definition.slotKey}`}
            label="Media terpilih"
            hint={`Format ${definition.acceptType === "video" ? "video MP4/WebM" : "gambar JPEG/PNG/WebP/AVIF"}.`}
            aspectRatioHint={definition.aspectRatio}
            acceptType={definition.acceptType}
            initialAsset={selectedAsset}
            onChange={setSelectedAsset}
            canManageMedia={canManageContent}
            activeEditionId={editionId}
          />

          {selectedAsset ? (
            <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
              <AdminField
                label="Alt text khusus slot (opsional)"
                hint="Ganti deskripsi aksesibilitas khusus untuk penempatan pada slot ini."
              >
                <AdminInput
                  value={altOverride}
                  onChange={(e) => setAltOverride(e.target.value)}
                  placeholder={selectedAsset.alt ?? "Masukkan teks alternatif..."}
                  disabled={!canManageContent || isPending}
                />
              </AdminField>

              {definition.acceptType === "image" ? (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <AdminField label="Fokus X (%)" hint="Titik fokus horizontal (0 - 100).">
                    <AdminInput
                      type="number"
                      min={0}
                      max={100}
                      value={focalX}
                      onChange={(e) => setFocalX(Number(e.target.value))}
                      disabled={!canManageContent || isPending}
                    />
                  </AdminField>
                  <AdminField label="Fokus Y (%)" hint="Titik fokus vertikal (0 - 100).">
                    <AdminInput
                      type="number"
                      min={0}
                      max={100}
                      value={focalY}
                      onChange={(e) => setFocalY(Number(e.target.value))}
                      disabled={!canManageContent || isPending}
                    />
                  </AdminField>
                </div>
              ) : null}
            </div>
          ) : null}
        </form>
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-between border-t border-border bg-muted/10 p-3">
        <div>
          {isBound && canManageContent ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => setIsConfirmUnbindOpen(true)}
              className="h-8 text-xs border-rose-200 text-destructive hover:bg-rose-50"
            >
              <Trash2 size={13} className="mr-1" /> Lepas slot
            </Button>
          ) : null}
        </div>

        <AdminButton
          type="submit"
          form={`form-${definition.slotKey}`}
          disabled={!canManageContent || !selectedAsset || isPending}
          className="bg-dgb text-white text-xs h-8 hover:bg-dgb-600"
        >
          {isPending ? "Menyimpan..." : isBound ? "Perbarui slot" : "Pasang ke slot"}
        </AdminButton>
      </div>

      {/* Confirm Unbind Dialog */}
      <AlertDialog open={isConfirmUnbindOpen} onOpenChange={setIsConfirmUnbindOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-montserrat">
              Lepas media dari slot ini?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Media tidak akan terhapus dari pustaka, tetapi slot &quot;{definition.label}&quot; akan menjadi kosong pada edisi ini.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnbind}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Lepas media
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminCard>
  );
}

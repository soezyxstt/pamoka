"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Building,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Edit2,
  Eye,
  FolderTree,
  Layers,
  LayoutGrid,
  Loader2,
  Plus,
  Power,
  PowerOff,
  Search,
  Sparkles,
  Trash2,
  User,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  AdminBadge,
  AdminButton,
  AdminCard,
  AdminCardHeader,
  AdminEmptyState,
  AdminField,
  AdminInput,
  AdminSelect,
  AdminTextarea,
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  assignMemberAction,
  createUnitAction,
  deletePeriodAction,
  deleteUnitAction,
  reorderUnitsAction,
  removeMembershipAction,
  updateMembershipAction,
  updatePeriodAction,
  updateUnitAction,
} from "../../actions";
import type { PeriodLifecycle } from "@/server/db/schema";

export type DetailPeriod = {
  id: string;
  label: string;
  startYear: number;
  endYear: number;
  vision: string | null;
  missionJson: string;
  lifecycle: PeriodLifecycle;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

export type DetailUnit = {
  id: string;
  periodId: string;
  parentId: string | null;
  name: string;
  displayOrder: number;
  active: boolean;
};

export type DetailMember = {
  id: string;
  periodId: string;
  unitId: string;
  personId: string;
  title: string;
  displayOrder: number;
  active: boolean;
  version: number;
  personName: string;
  personSlug: string;
  portraitUrl: string | null;
};

export type ConnectedEdition = {
  id: string;
  year: number;
  name: string;
  slug: string;
  lifecycle: string;
};

export type PersonOption = {
  id: string;
  name: string;
  slug: string;
  portraitUrl: string | null;
};

export type PeriodDetailClientProps = {
  period: DetailPeriod;
  units: DetailUnit[];
  members: DetailMember[];
  connectedEditions: ConnectedEdition[];
  peopleOptions: PersonOption[];
  canEdit?: boolean;
  canPublish?: boolean;
};

export type TreeNode = DetailUnit & {
  depth: number;
  children: TreeNode[];
  members: DetailMember[];
};

export function PeriodDetailClient({
  period,
  units,
  members,
  connectedEditions,
  peopleOptions,
  canEdit = true,
  canPublish = true,
}: PeriodDetailClientProps) {
  const [isPending, startTransition] = useTransition();

  // Mode View: Tree List or Visual Chart
  const [activeView, setActiveView] = useState<"tree" | "visual">("tree");

  // -------------------------------------------------------------------------
  // Tree Structure Builder (Max 4 Levels)
  // -------------------------------------------------------------------------
  const { treeRoots, unitDepthMap } = useMemo(() => {
    const depthMap = new Map<string, number>();
    const unitMap = new Map<string, DetailUnit>();
    for (const u of units) unitMap.set(u.id, u);

    function getDepth(id: string): number {
      if (depthMap.has(id)) return depthMap.get(id)!;
      const u = unitMap.get(id);
      if (!u || !u.parentId) {
        depthMap.set(id, 1);
        return 1;
      }
      const parentDepth = getDepth(u.parentId);
      const d = Math.min(4, parentDepth + 1);
      depthMap.set(id, d);
      return d;
    }

    for (const u of units) {
      getDepth(u.id);
    }

    const membersByUnit = new Map<string, DetailMember[]>();
    for (const m of members) {
      const list = membersByUnit.get(m.unitId) ?? [];
      list.push(m);
      membersByUnit.set(m.unitId, list);
    }

    function buildNode(u: DetailUnit): TreeNode {
      const depth = depthMap.get(u.id) ?? 1;
      const childUnits = units
        .filter((c) => c.parentId === u.id)
        .sort((a, b) => a.displayOrder - b.displayOrder);
      const unitMembers = (membersByUnit.get(u.id) ?? []).sort(
        (a, b) => a.displayOrder - b.displayOrder
      );

      return {
        ...u,
        depth,
        children: childUnits.map(buildNode),
        members: unitMembers,
      };
    }

    const roots = units
      .filter((u) => !u.parentId)
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map(buildNode);

    return { treeRoots: roots, unitDepthMap: depthMap };
  }, [units, members]);

  // -------------------------------------------------------------------------
  // Unit Modals & State
  // -------------------------------------------------------------------------
  const [isUnitSheetOpen, setIsUnitSheetOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<DetailUnit | null>(null);
  const [unitParentId, setUnitParentId] = useState<string | null>(null);
  const [unitName, setUnitName] = useState("");
  const [unitDisplayOrder, setUnitDisplayOrder] = useState<number>(0);
  const [unitActive, setUnitActive] = useState<boolean>(true);
  const [deletingUnit, setDeletingUnit] = useState<DetailUnit | null>(null);

  const openCreateRootUnit = () => {
    setEditingUnit(null);
    setUnitParentId(null);
    setUnitName("");
    setUnitDisplayOrder(units.filter((u) => !u.parentId).length + 1);
    setUnitActive(true);
    setIsUnitSheetOpen(true);
  };

  const openCreateSubUnit = (parent: DetailUnit) => {
    const parentDepth = unitDepthMap.get(parent.id) ?? 1;
    if (parentDepth >= 4) {
      toast.error("Maksimal tingkat kedalaman (4 tingkat) telah tercapai");
      return;
    }
    setEditingUnit(null);
    setUnitParentId(parent.id);
    setUnitName("");
    setUnitDisplayOrder(units.filter((u) => u.parentId === parent.id).length + 1);
    setUnitActive(true);
    setIsUnitSheetOpen(true);
  };

  const openEditUnit = (unit: DetailUnit) => {
    setEditingUnit(unit);
    setUnitParentId(unit.parentId);
    setUnitName(unit.name);
    setUnitDisplayOrder(unit.displayOrder);
    setUnitActive(unit.active);
    setIsUnitSheetOpen(true);
  };

  const handleSaveUnit = () => {
    if (!unitName.trim()) {
      toast.error("Nama unit organisasi wajib diisi");
      return;
    }

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("periodId", period.id);
        formData.append("name", unitName.trim());
        if (unitParentId) formData.append("parentId", unitParentId);
        formData.append("displayOrder", String(unitDisplayOrder));
        formData.append("active", String(unitActive));

        if (editingUnit) {
          formData.append("id", editingUnit.id);
          await updateUnitAction(formData);
          toast.success("Unit organisasi berhasil diperbarui");
        } else {
          await createUnitAction(formData);
          toast.success("Unit organisasi berhasil ditambahkan");
        }
        setIsUnitSheetOpen(false);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Gagal menyimpan unit");
      }
    });
  };

  const handleDeleteUnit = () => {
    if (!deletingUnit) return;
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("id", deletingUnit.id);
        await deleteUnitAction(formData);
        toast.success("Unit organisasi berhasil dihapus");
        setDeletingUnit(null);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Gagal menghapus unit");
      }
    });
  };

  const handleMoveUnit = (unit: DetailUnit, direction: "up" | "down") => {
    const siblingUnits = units
      .filter((u) => u.parentId === unit.parentId)
      .sort((a, b) => a.displayOrder - b.displayOrder);
    const currentIndex = siblingUnits.findIndex((u) => u.id === unit.id);
    if (currentIndex < 0) return;

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= siblingUnits.length) return;

    const targetSibling = siblingUnits[targetIndex];
    const itemsToReorder = [
      { id: unit.id, displayOrder: targetSibling.displayOrder },
      { id: targetSibling.id, displayOrder: unit.displayOrder },
    ];

    startTransition(async () => {
      try {
        await reorderUnitsAction(itemsToReorder);
        toast.success("Urutan unit diperbarui");
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Gagal mengubah urutan unit");
      }
    });
  };

  // -------------------------------------------------------------------------
  // Membership Modals & State
  // -------------------------------------------------------------------------
  const [isMemberSheetOpen, setIsMemberSheetOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<DetailMember | null>(null);
  const [memberTargetUnitId, setMemberTargetUnitId] = useState<string>("");
  const [memberPersonId, setMemberPersonId] = useState<string>("");
  const [memberTitle, setMemberTitle] = useState<string>("");
  const [memberDisplayOrder, setMemberDisplayOrder] = useState<number>(0);
  const [memberActive, setMemberActive] = useState<boolean>(true);
  const [deletingMember, setDeletingMember] = useState<DetailMember | null>(null);
  const [personSearchQuery, setPersonSearchQuery] = useState("");

  const filteredPeopleOptions = useMemo(() => {
    const q = personSearchQuery.toLowerCase().trim();
    if (!q) return peopleOptions;
    return peopleOptions.filter((p) => p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q));
  }, [peopleOptions, personSearchQuery]);

  const openAssignMember = (unitId: string) => {
    setEditingMember(null);
    setMemberTargetUnitId(unitId);
    setMemberPersonId(peopleOptions[0]?.id ?? "");
    setMemberTitle("");
    const unitMembers = members.filter((m) => m.unitId === unitId);
    setMemberDisplayOrder(unitMembers.length + 1);
    setMemberActive(true);
    setPersonSearchQuery("");
    setIsMemberSheetOpen(true);
  };

  const openEditMember = (member: DetailMember) => {
    setEditingMember(member);
    setMemberTargetUnitId(member.unitId);
    setMemberPersonId(member.personId);
    setMemberTitle(member.title);
    setMemberDisplayOrder(member.displayOrder);
    setMemberActive(member.active);
    setPersonSearchQuery("");
    setIsMemberSheetOpen(true);
  };

  const handleSaveMember = () => {
    if (!memberTargetUnitId || !memberPersonId) {
      toast.error("Unit dan profil orang wajib dipilih");
      return;
    }
    if (!memberTitle.trim()) {
      toast.error("Nama jabatan wajib diisi");
      return;
    }

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("periodId", period.id);
        formData.append("unitId", memberTargetUnitId);
        formData.append("personId", memberPersonId);
        formData.append("title", memberTitle.trim());
        formData.append("displayOrder", String(memberDisplayOrder));
        formData.append("active", String(memberActive));

        if (editingMember) {
          formData.append("id", editingMember.id);
          formData.append("version", String(editingMember.version));
          await updateMembershipAction(formData);
          toast.success("Penugasan pengurus berhasil diperbarui");
        } else {
          await assignMemberAction(formData);
          toast.success("Pengurus baru berhasil ditugaskan");
        }
        setIsMemberSheetOpen(false);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Gagal menyimpan penugasan");
      }
    });
  };

  const handleDeleteMember = () => {
    if (!deletingMember) return;
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("id", deletingMember.id);
        await removeMembershipAction(formData);
        toast.success("Penugasan pengurus berhasil dicabut");
        setDeletingMember(null);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Gagal menghapus penugasan");
      }
    });
  };

  // -------------------------------------------------------------------------
  // Edit Period Metadata Modal
  // -------------------------------------------------------------------------
  const [isEditPeriodOpen, setIsEditPeriodOpen] = useState(false);
  const [editLabel, setEditLabel] = useState(period.label);
  const [editStartYear, setEditStartYear] = useState(period.startYear);
  const [editEndYear, setEditEndYear] = useState(period.endYear);
  const [editVision, setEditVision] = useState(period.vision ?? "");
  const [editMissions, setEditMissions] = useState<string[]>(() => {
    try {
      const parsed = JSON.parse(period.missionJson);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : [""];
    } catch {
      return [""];
    }
  });
  const [editLifecycle, setEditLifecycle] = useState<PeriodLifecycle>(period.lifecycle);

  const handleUpdatePeriodMetadata = () => {
    if (!editLabel.trim()) {
      toast.error("Label periode wajib diisi");
      return;
    }
    const cleaned = editMissions.map((m) => m.trim()).filter(Boolean);

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("id", period.id);
        formData.append("version", String(period.version));
        formData.append("label", editLabel.trim());
        formData.append("startYear", String(editStartYear));
        formData.append("endYear", String(editEndYear));
        formData.append("vision", editVision.trim());
        formData.append("missionJson", JSON.stringify(cleaned));
        formData.append("lifecycle", editLifecycle);

        await updatePeriodAction(formData);
        toast.success("Metadata periode berhasil diperbarui");
        setIsEditPeriodOpen(false);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Gagal memperbarui metadata periode");
      }
    });
  };

  // Missions array for display
  const missionsList: string[] = useMemo(() => {
    try {
      const parsed = JSON.parse(period.missionJson);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [period.missionJson]);

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-dgb-100 pb-3">
        <Link
          href="/admin/organization"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-dgb hover:underline"
        >
          <ArrowLeft size={14} /> Kembali ke daftar kepengurusan
        </Link>

        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-border bg-muted p-0.5">
            <button
              type="button"
              onClick={() => setActiveView("tree")}
              className={cn(
                "flex items-center gap-1 rounded-xs px-2.5 py-1 text-xs font-semibold transition-colors",
                activeView === "tree" ? "bg-white text-dgb shadow-xs" : "text-muted-foreground"
              )}
            >
              <FolderTree size={13} /> Struktur Tree
            </button>
            <button
              type="button"
              onClick={() => setActiveView("visual")}
              className={cn(
                "flex items-center gap-1 rounded-xs px-2.5 py-1 text-xs font-semibold transition-colors",
                activeView === "visual" ? "bg-white text-dgb shadow-xs" : "text-muted-foreground"
              )}
            >
              <LayoutGrid size={13} /> Bagan Visual
            </button>
          </div>

          {canEdit ? (
            <AdminButton onClick={openCreateRootUnit} className="gap-1.5 text-xs">
              <Plus size={14} /> Tambah unit utama
            </AdminButton>
          ) : null}
        </div>
      </div>

      {/* Period Metadata Card */}
      <div className="rounded-xl border border-dgb-100 bg-white p-5 shadow-xs">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <AdminBadge value={period.lifecycle} />
              <span className="text-xs font-semibold text-fb-700">
                Masa Bakti: {period.startYear} - {period.endYear}
              </span>
            </div>
            <h2 className="font-montserrat text-2xl font-bold text-dgb-900">{period.label}</h2>
            {period.vision ? (
              <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">
                <strong className="text-dgb">Visi:</strong> {period.vision}
              </p>
            ) : null}

            {missionsList.length > 0 ? (
              <div className="mt-2 space-y-1">
                <span className="text-xs font-semibold text-dgb">Misi Organisasi:</span>
                <ul className="list-inside list-disc space-y-0.5 text-xs text-muted-foreground">
                  {missionsList.map((m, idx) => (
                    <li key={idx}>{m}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 shrink-0 lg:items-end">
            {canEdit ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditPeriodOpen(true)}
                className="h-8 text-xs border-dgb-200 text-dgb hover:bg-dgb-50"
              >
                <Edit2 size={13} className="mr-1.5" /> Edit metadata periode
              </Button>
            ) : null}

            <div className="rounded-lg bg-dgb-50/50 p-3 text-xs">
              <p className="font-semibold text-dgb">Edisi Pasanggiri Terhubung:</p>
              {connectedEditions.length === 0 ? (
                <p className="text-[11px] text-muted-foreground italic mt-0.5">Belum ada edisi terhubung.</p>
              ) : (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {connectedEditions.map((ed) => (
                    <span
                      key={ed.id}
                      className="rounded-md border border-dgb-200 bg-white px-2 py-0.5 text-[11px] font-medium text-dgb-900"
                    >
                      {ed.name} ({ed.year})
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* TREE VIEW (UP TO 4 LEVELS) */}
      {/* ===================================================================== */}
      {activeView === "tree" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-montserrat text-lg font-bold text-dgb-900">
              Hierarki Struktur Unit & Penugasan Pengurus
            </h3>
            <span className="text-xs text-muted-foreground">
              Total {units.length} unit kerja · {members.length} penugasan
            </span>
          </div>

          {treeRoots.length === 0 ? (
            <AdminCard>
              <div className="p-8">
                <AdminEmptyState
                  icon="building"
                  title="Belum ada unit kerja"
                  description="Mulai susun struktur organisasi dengan menambahkan unit kerja utama (level 1)."
                />
                {canEdit ? (
                  <div className="mt-4 flex justify-center">
                    <AdminButton onClick={openCreateRootUnit} className="gap-1.5">
                      <Plus size={14} /> Tambah unit pertama
                    </AdminButton>
                  </div>
                ) : null}
              </div>
            </AdminCard>
          ) : (
            <div className="space-y-3">
              {treeRoots.map((root) => (
                <UnitTreeRow
                  key={root.id}
                  node={root}
                  onAddSubunit={openCreateSubUnit}
                  onEditUnit={openEditUnit}
                  onDeleteUnit={(u) => setDeletingUnit(u)}
                  onMoveUnit={handleMoveUnit}
                  onAssignMember={openAssignMember}
                  onEditMember={openEditMember}
                  onDeleteMember={(m) => setDeletingMember(m)}
                  canEdit={canEdit}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* VISUAL ORGANOGRAM PREVIEW */}
      {/* ===================================================================== */}
      {activeView === "visual" && (
        <div className="rounded-xl border border-dgb-100 bg-dgb-50/20 p-6 overflow-x-auto">
          <div className="min-w-[700px] text-center">
            <div className="inline-block rounded-xl border-2 border-dgb bg-dgb px-6 py-3 text-white shadow-md">
              <h4 className="font-montserrat text-base font-bold">{period.label}</h4>
              <p className="text-xs text-white/80">Visi: {period.vision || "Nu Nyunda Tur Nyakola"}</p>
            </div>

            {treeRoots.length > 0 ? (
              <div className="mt-8 flex justify-center gap-6">
                {treeRoots.map((root) => (
                  <VisualOrganogramNode key={root.id} node={root} />
                ))}
              </div>
            ) : (
              <p className="mt-8 text-xs text-muted-foreground italic">Belum ada struktur unit untuk ditampilkan.</p>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SHEET: BUAT / EDIT UNIT */}
      {/* ===================================================================== */}
      <Sheet open={isUnitSheetOpen} onOpenChange={setIsUnitSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="border-b border-border pb-4">
            <SheetTitle className="font-montserrat text-lg font-bold text-dgb-900">
              {editingUnit ? "Edit Unit Organisasi" : "Tambah Unit Baru"}
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground">
              {unitParentId
                ? "Unit ini akan menjadi sub-unit di bawah unit induk terpilih."
                : "Unit utama tingkat 1 (Root)."}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 py-4">
            <AdminField label="Nama unit organisasi" hint="Contoh: Bidang Pengembangan Budaya & Pariwisata">
              <AdminInput
                value={unitName}
                onChange={(e) => setUnitName(e.target.value)}
                placeholder="Nama unit kerja..."
              />
            </AdminField>

            <AdminField label="Unit induk (Parent)">
              <AdminSelect
                value={unitParentId ?? ""}
                onChange={(e) => setUnitParentId(e.target.value ? e.target.value : null)}
              >
                <option value="">Unit Utama (Tingkat 1 - Root)</option>
                {units
                  .filter((u) => !editingUnit || u.id !== editingUnit.id)
                  .map((u) => {
                    const depth = unitDepthMap.get(u.id) ?? 1;
                    return (
                      <option key={u.id} value={u.id} disabled={depth >= 4}>
                        {"— ".repeat(depth - 1)} {u.name} (Tk. {depth})
                      </option>
                    );
                  })}
              </AdminSelect>
            </AdminField>

            <div className="grid grid-cols-2 gap-3">
              <AdminField label="Nomor urut tampilan">
                <AdminInput
                  type="number"
                  value={unitDisplayOrder}
                  onChange={(e) => setUnitDisplayOrder(Number(e.target.value))}
                />
              </AdminField>

              <AdminField label="Status unit">
                <AdminSelect
                  value={unitActive ? "true" : "false"}
                  onChange={(e) => setUnitActive(e.target.value === "true")}
                >
                  <option value="true">Aktif</option>
                  <option value="false">Nonaktif</option>
                </AdminSelect>
              </AdminField>
            </div>
          </div>

          <SheetFooter className="border-t border-border pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsUnitSheetOpen(false)}
              className="text-xs"
            >
              Batal
            </Button>
            <AdminButton disabled={isPending} onClick={handleSaveUnit} className="text-xs">
              {isPending ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
              {editingUnit ? "Simpan perubahan" : "Tambah unit"}
            </AdminButton>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ===================================================================== */}
      {/* SHEET: PENUGASAN PENGURUS */}
      {/* ===================================================================== */}
      <Sheet open={isMemberSheetOpen} onOpenChange={setIsMemberSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="border-b border-border pb-4">
            <SheetTitle className="font-montserrat text-lg font-bold text-dgb-900">
              {editingMember ? "Edit Penugasan Pengurus" : "Tugaskan Pengurus ke Unit"}
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground">
              Pilih profil orang dari direktori dan tentukan nama jabatan pengurus.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 py-4">
            <AdminField label="Unit organisasi tujuan">
              <AdminSelect
                value={memberTargetUnitId}
                onChange={(e) => setMemberTargetUnitId(e.target.value)}
              >
                {units.map((u) => {
                  const d = unitDepthMap.get(u.id) ?? 1;
                  return (
                    <option key={u.id} value={u.id}>
                      {"— ".repeat(d - 1)} {u.name}
                    </option>
                  );
                })}
              </AdminSelect>
            </AdminField>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-foreground">
                Pilih profil orang
              </label>
              <div className="relative">
                <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <AdminInput
                  placeholder="Cari profil..."
                  value={personSearchQuery}
                  onChange={(e) => setPersonSearchQuery(e.target.value)}
                  className="pl-7 h-8 text-xs mb-2"
                />
              </div>

              <div className="max-h-44 overflow-y-auto rounded-md border border-input p-1 space-y-1 bg-background">
                {filteredPeopleOptions.length === 0 ? (
                  <p className="p-3 text-center text-xs text-muted-foreground italic">
                    Profil tidak ditemukan. Tambahkan di tab Direktori Profil.
                  </p>
                ) : (
                  filteredPeopleOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setMemberPersonId(opt.id)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-md p-2 text-left text-xs transition-colors",
                        memberPersonId === opt.id
                          ? "bg-dgb text-white font-semibold"
                          : "hover:bg-muted text-foreground"
                      )}
                    >
                      <div className="relative size-6 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
                        {opt.portraitUrl ? (
                          <Image src={opt.portraitUrl} alt="" fill sizes="24px" className="object-cover" />
                        ) : (
                          <div className="grid size-full place-items-center text-muted-foreground">
                            <User size={12} />
                          </div>
                        )}
                      </div>
                      <span className="truncate">{opt.name}</span>
                    </button>
                  ))
                )}
              </div>
            </div>

            <AdminField label="Nama jabatan" hint="Contoh: Ketua Umum, Koordinator Divisi, Anggota">
              <AdminInput
                value={memberTitle}
                onChange={(e) => setMemberTitle(e.target.value)}
                placeholder="Contoh: Ketua Umum"
              />
            </AdminField>

            <div className="grid grid-cols-2 gap-3">
              <AdminField label="Urutan penugasan">
                <AdminInput
                  type="number"
                  value={memberDisplayOrder}
                  onChange={(e) => setMemberDisplayOrder(Number(e.target.value))}
                />
              </AdminField>

              <AdminField label="Status keaktifan">
                <AdminSelect
                  value={memberActive ? "true" : "false"}
                  onChange={(e) => setMemberActive(e.target.value === "true")}
                >
                  <option value="true">Aktif</option>
                  <option value="false">Nonaktif</option>
                </AdminSelect>
              </AdminField>
            </div>
          </div>

          <SheetFooter className="border-t border-border pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsMemberSheetOpen(false)}
              className="text-xs"
            >
              Batal
            </Button>
            <AdminButton disabled={isPending} onClick={handleSaveMember} className="text-xs">
              {isPending ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
              {editingMember ? "Simpan perubahan" : "Tugaskan pengurus"}
            </AdminButton>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ===================================================================== */}
      {/* DIALOG: EDIT METADATA PERIODE */}
      {/* ===================================================================== */}
      <Dialog open={isEditPeriodOpen} onOpenChange={setIsEditPeriodOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-montserrat text-base font-bold text-dgb-900">
              Edit Metadata Periode
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Perbarui label, rentang tahun, visi, dan poin misi periode ini.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <AdminField label="Label periode">
              <AdminInput value={editLabel} onChange={(e) => setEditLabel(e.target.value)} />
            </AdminField>

            <div className="grid grid-cols-2 gap-3">
              <AdminField label="Tahun mulai">
                <AdminInput
                  type="number"
                  value={editStartYear}
                  onChange={(e) => setEditStartYear(Number(e.target.value))}
                />
              </AdminField>
              <AdminField label="Tahun selesai">
                <AdminInput
                  type="number"
                  value={editEndYear}
                  onChange={(e) => setEditEndYear(Number(e.target.value))}
                />
              </AdminField>
            </div>

            <AdminField label="Status siklus">
              <AdminSelect
                value={editLifecycle}
                onChange={(e) => setEditLifecycle(e.target.value as PeriodLifecycle)}
              >
                <option value="draft">Draft (Konseptual)</option>
                <option value="active">Active (Sedang Berjalan)</option>
                <option value="archived">Archived (Arsip)</option>
              </AdminSelect>
            </AdminField>

            <AdminField label="Visi organisasi">
              <AdminTextarea
                value={editVision}
                onChange={(e) => setEditVision(e.target.value)}
                className="min-h-20"
              />
            </AdminField>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">Misi Organisasi</span>
                <button
                  type="button"
                  onClick={() => setEditMissions([...editMissions, ""])}
                  className="text-xs font-semibold text-dgb hover:underline inline-flex items-center gap-1"
                >
                  <Plus size={12} /> Tambah misi
                </button>
              </div>
              <div className="space-y-2">
                {editMissions.map((m, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-dgb-50 text-[10px] font-bold text-dgb">
                      {idx + 1}
                    </span>
                    <AdminInput
                      value={m}
                      onChange={(e) => {
                        const updated = [...editMissions];
                        updated[idx] = e.target.value;
                        setEditMissions(updated);
                      }}
                      className="text-xs"
                    />
                    {editMissions.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => setEditMissions(editMissions.filter((_, i) => i !== idx))}
                        className="p-1 text-muted-foreground hover:text-rose-600"
                      >
                        <Trash2 size={13} />
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditPeriodOpen(false)}
              className="text-xs"
            >
              Batal
            </Button>
            <AdminButton disabled={isPending} onClick={handleUpdatePeriodMetadata} className="text-xs">
              {isPending ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
              Simpan metadata
            </AdminButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===================================================================== */}
      {/* ALERT DIALOG: HAPUS UNIT */}
      {/* ===================================================================== */}
      <AlertDialog open={Boolean(deletingUnit)} onOpenChange={(open) => !open && setDeletingUnit(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-montserrat text-base font-bold text-destructive">
              Hapus Unit Organisasi?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Unit <strong>{deletingUnit?.name}</strong> beserta seluruh sub-unit dan penugasan pengurus di dalamnya akan dihapus.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUnit}
              className="bg-destructive text-xs text-white hover:bg-destructive/90"
            >
              Hapus unit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ===================================================================== */}
      {/* ALERT DIALOG: HAPUS PENUGASAN */}
      {/* ===================================================================== */}
      <AlertDialog open={Boolean(deletingMember)} onOpenChange={(open) => !open && setDeletingMember(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-montserrat text-base font-bold text-destructive">
              Hapus Penugasan Pengurus?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Cabut penugasan <strong>{deletingMember?.personName}</strong> sebagai <strong>{deletingMember?.title}</strong>? Profil orang tetap tersimpan di direktori.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMember}
              className="bg-destructive text-xs text-white hover:bg-destructive/90"
            >
              Cabut penugasan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Unit Tree Recursive Component
// ---------------------------------------------------------------------------

function UnitTreeRow({
  node,
  onAddSubunit,
  onEditUnit,
  onDeleteUnit,
  onMoveUnit,
  onAssignMember,
  onEditMember,
  onDeleteMember,
  canEdit,
}: {
  node: TreeNode;
  onAddSubunit: (unit: DetailUnit) => void;
  onEditUnit: (unit: DetailUnit) => void;
  onDeleteUnit: (unit: DetailUnit) => void;
  onMoveUnit: (unit: DetailUnit, dir: "up" | "down") => void;
  onAssignMember: (unitId: string) => void;
  onEditMember: (member: DetailMember) => void;
  onDeleteMember: (member: DetailMember) => void;
  canEdit: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  const depthPadding = (node.depth - 1) * 20;

  return (
    <div className="rounded-xl border border-dgb-100 bg-white shadow-xs overflow-hidden">
      {/* Unit Header Bar */}
      <div
        style={{ paddingLeft: `${16 + depthPadding}px` }}
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 p-3.5 border-b border-border/60 transition-colors",
          node.depth === 1 ? "bg-dgb-50/40" : node.depth === 2 ? "bg-muted/30" : "bg-white"
        )}
      >
        <div className="flex items-center gap-2.5">
          {node.children.length > 0 || node.members.length > 0 ? (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : (
            <span className="size-5" />
          )}

          <div className="flex items-center gap-2">
            <span
              className={cn(
                "rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase",
                node.depth === 1
                  ? "bg-dgb text-white"
                  : node.depth === 2
                  ? "bg-dgb-100 text-dgb-900"
                  : "bg-muted text-muted-foreground"
              )}
            >
              Level {node.depth}
            </span>
            <h4 className="font-montserrat text-sm font-bold text-dgb-900">{node.name}</h4>
          </div>

          <span className="text-[11px] text-muted-foreground">
            ({node.members.length} pengurus · {node.children.length} sub-unit)
          </span>
        </div>

        {canEdit ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onMoveUnit(node, "up")}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Pindahkan ke atas"
            >
              <ArrowUp size={13} />
            </button>
            <button
              type="button"
              onClick={() => onMoveUnit(node, "down")}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Pindahkan ke bawah"
            >
              <ArrowDown size={13} />
            </button>

            {node.depth < 4 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onAddSubunit(node)}
                className="h-7 px-2 text-xs border-dgb-200 text-dgb hover:bg-dgb-50"
              >
                <Plus size={12} className="mr-1" /> Sub-unit
              </Button>
            ) : null}

            <Button
              type="button"
              size="sm"
              onClick={() => onAssignMember(node.id)}
              className="h-7 bg-dgb px-2.5 text-xs text-white hover:bg-dgb-600"
            >
              <UserPlus size={12} className="mr-1" /> Tambah pengurus
            </Button>

            <button
              type="button"
              onClick={() => onEditUnit(node)}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Edit nama unit"
            >
              <Edit2 size={13} />
            </button>
            <button
              type="button"
              onClick={() => onDeleteUnit(node)}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-rose-50 hover:text-rose-700"
              title="Hapus unit"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ) : null}
      </div>

      {/* Expanded Content: Members in this unit & Subunits */}
      {isExpanded && (
        <div className="divide-y divide-border/50">
          {/* Members List in this unit */}
          {node.members.length > 0 ? (
            <div
              style={{ paddingLeft: `${32 + depthPadding}px` }}
              className="p-3 bg-muted/10 grid gap-2 sm:grid-cols-2 md:grid-cols-3"
            >
              {node.members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-white p-2.5 shadow-2xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative size-9 shrink-0 overflow-hidden rounded-full border border-dgb-100 bg-muted">
                      {member.portraitUrl ? (
                        <Image
                          src={member.portraitUrl}
                          alt={member.personName}
                          fill
                          sizes="36px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="grid size-full place-items-center text-dgb">
                          <User size={16} />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-dgb-900" title={member.personName}>
                        {member.personName}
                      </p>
                      <p className="truncate text-[11px] font-semibold text-fb-700" title={member.title}>
                        {member.title}
                      </p>
                    </div>
                  </div>

                  {canEdit ? (
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <button
                        type="button"
                        onClick={() => onEditMember(member)}
                        className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        title="Edit jabatan"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteMember(member)}
                        className="rounded-md p-1 text-muted-foreground hover:bg-rose-50 hover:text-rose-700"
                        title="Cabut penugasan"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{ paddingLeft: `${32 + depthPadding}px` }}
              className="p-2.5 text-xs text-muted-foreground italic bg-muted/5"
            >
              Belum ada pengurus di unit ini.
            </div>
          )}

          {/* Subunits recursive render */}
          {node.children.length > 0 ? (
            <div className="space-y-2 p-2 bg-muted/5">
              {node.children.map((child) => (
                <UnitTreeRow
                  key={child.id}
                  node={child}
                  onAddSubunit={onAddSubunit}
                  onEditUnit={onEditUnit}
                  onDeleteUnit={onDeleteUnit}
                  onMoveUnit={onMoveUnit}
                  onAssignMember={onAssignMember}
                  onEditMember={onEditMember}
                  onDeleteMember={onDeleteMember}
                  canEdit={canEdit}
                />
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Visual Organogram Node Component
// ---------------------------------------------------------------------------

function VisualOrganogramNode({ node }: { node: TreeNode }) {
  return (
    <div className="flex flex-col items-center">
      {/* Unit Box */}
      <div className="w-56 rounded-xl border border-dgb-200 bg-white p-3.5 shadow-sm text-left">
        <div className="flex items-center justify-between">
          <span className="rounded-sm bg-dgb-50 px-1.5 py-0.2 text-[9px] font-bold text-dgb uppercase">
            Level {node.depth}
          </span>
          <span className="text-[10px] text-muted-foreground font-semibold">
            {node.members.length} Orang
          </span>
        </div>
        <h5 className="mt-1 font-montserrat text-xs font-bold text-dgb-900 line-clamp-2">
          {node.name}
        </h5>

        {node.members.length > 0 ? (
          <div className="mt-2.5 space-y-1.5 border-t border-border pt-2">
            {node.members.map((m) => (
              <div key={m.id} className="flex items-center gap-1.5">
                <div className="relative size-5 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
                  {m.portraitUrl ? (
                    <Image src={m.portraitUrl} alt="" fill sizes="20px" className="object-cover" />
                  ) : (
                    <div className="grid size-full place-items-center text-muted-foreground">
                      <User size={10} />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[10px] font-bold text-foreground">{m.personName}</p>
                  <p className="truncate text-[9px] text-fb-700 font-medium">{m.title}</p>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* Children branches */}
      {node.children.length > 0 ? (
        <div className="mt-4 flex gap-4 pt-4 border-t-2 border-dgb-200">
          {node.children.map((child) => (
            <VisualOrganogramNode key={child.id} node={child} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

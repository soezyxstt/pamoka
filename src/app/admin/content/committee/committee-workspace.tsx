"use client";

import {
  ArrowDown,
  ArrowUp,
  Building,
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
import { cn } from "@/lib/utils";
import type { AdminEditionContext } from "@/server/cms/context";
import {
  assignCommitteeMemberAction,
  createCommitteeUnitAction,
  createQuickPersonAction,
  deleteCommitteeUnitAction,
  removeCommitteeAssignmentAction,
  reorderCommitteeUnitsAction,
  updateCommitteeAssignmentAction,
  updateCommitteeUnitAction,
} from "./actions";

export type CommitteeUnitItem = {
  id: string;
  editionId: string;
  parentId: string | null;
  name: string;
  displayOrder: number;
  active: boolean;
};

export type CommitteeMemberItem = {
  id: string;
  editionId: string;
  unitId: string;
  personId: string;
  title: string;
  displayOrder: number;
  active: boolean;
  version: number;
  personName: string;
  personSlug: string;
  portraitUrl: string | null;
  shortBio: string | null;
};

export type PersonOption = {
  id: string;
  name: string;
  slug: string;
  shortBio: string | null;
  portraitUrl: string | null;
  portraitMediaId?: string | null;
};

type TreeNode = CommitteeUnitItem & {
  level: number;
  children: TreeNode[];
  memberCount: number;
};

type CommitteeWorkspaceProps = {
  edition: AdminEditionContext;
  initialUnits: CommitteeUnitItem[];
  initialMembers: CommitteeMemberItem[];
  initialPeople: PersonOption[];
  canEdit: boolean;
  canPublish: boolean;
};

export function CommitteeWorkspaceClient({
  edition,
  initialUnits,
  initialMembers,
  initialPeople,
  canEdit,
  canPublish,
}: CommitteeWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<"structure" | "members" | "preview">("structure");
  const [isPending, startTransition] = useTransition();

  // Search & Filters
  const [selectedUnitId, setSelectedUnitId] = useState<string | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  // People Directory List (can grow on quick create)
  const [peopleList, setPeopleList] = useState<PersonOption[]>(initialPeople);

  // Dialog States
  const [unitDialogOpen, setUnitDialogOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<CommitteeUnitItem | null>(null);
  const [unitParentId, setUnitParentId] = useState<string>("");
  const [unitName, setUnitName] = useState("");
  const [unitDisplayOrder, setUnitDisplayOrder] = useState(0);
  const [unitActive, setUnitActive] = useState(true);

  const [deleteUnitTarget, setDeleteUnitTarget] = useState<CommitteeUnitItem | null>(null);

  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<CommitteeMemberItem | null>(null);
  const [memberUnitId, setMemberUnitId] = useState<string>("");
  const [memberPersonId, setMemberPersonId] = useState<string>("");
  const [memberTitle, setMemberTitle] = useState("");
  const [memberDisplayOrder, setMemberDisplayOrder] = useState(0);
  const [memberActive, setMemberActive] = useState(true);

  const [deleteMemberTarget, setDeleteMemberTarget] = useState<CommitteeMemberItem | null>(null);

  // Quick Person Modal State
  const [quickPersonOpen, setQuickPersonOpen] = useState(false);
  const [quickPersonName, setQuickPersonName] = useState("");
  const [quickPersonBio, setQuickPersonBio] = useState("");
  const [quickPersonPortraitMedia, setQuickPersonPortraitMedia] = useState<MediaAssetSummary | null>(null);

  // Expanded Tree Nodes
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  const toggleNode = (id: string) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [id]: prev[id] === undefined ? false : !prev[id],
    }));
  };

  // Build Hierarchical Tree Structure
  const { tree, flatTree, unitMap } = useMemo(() => {
    const map = new Map<string, CommitteeUnitItem>();
    initialUnits.forEach((u) => map.set(u.id, u));

    const childrenMap = new Map<string | null, CommitteeUnitItem[]>();
    initialUnits.forEach((u) => {
      const pId = u.parentId ?? null;
      const list = childrenMap.get(pId) ?? [];
      list.push(u);
      childrenMap.set(pId, list);
    });

    // Count members per unit
    const countMap = new Map<string, number>();
    initialMembers.forEach((m) => {
      countMap.set(m.unitId, (countMap.get(m.unitId) ?? 0) + 1);
    });

    const flat: TreeNode[] = [];

    function buildNodes(pId: string | null, level: number): TreeNode[] {
      const children = childrenMap.get(pId) ?? [];
      children.sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));

      return children.map((u) => {
        const node: TreeNode = {
          ...u,
          level,
          children: level < 4 ? buildNodes(u.id, level + 1) : [],
          memberCount: countMap.get(u.id) ?? 0,
        };
        flat.push(node);
        return node;
      });
    }

    const builtTree = buildNodes(null, 1);
    return { tree: builtTree, flatTree: flat, unitMap: map };
  }, [initialUnits, initialMembers]);

  // Statistics
  const stats = useMemo(() => {
    const totalUnits = initialUnits.length;
    const activeUnits = initialUnits.filter((u) => u.active).length;
    const totalMembers = initialMembers.length;
    const activeMembers = initialMembers.filter((m) => m.active).length;
    const rootUnits = initialUnits.filter((u) => !u.parentId).length;
    return {
      totalUnits,
      activeUnits,
      totalMembers,
      activeMembers,
      rootUnits,
    };
  }, [initialUnits, initialMembers]);

  // Filtered Members List
  const filteredMembers = useMemo(() => {
    return initialMembers.filter((m) => {
      if (selectedUnitId !== "all" && m.unitId !== selectedUnitId) return false;
      if (statusFilter === "active" && !m.active) return false;
      if (statusFilter === "inactive" && m.active) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = m.personName.toLowerCase().includes(q);
        const matchesTitle = m.title.toLowerCase().includes(q);
        const unit = unitMap.get(m.unitId);
        const matchesUnit = unit ? unit.name.toLowerCase().includes(q) : false;
        if (!matchesName && !matchesTitle && !matchesUnit) return false;
      }
      return true;
    });
  }, [initialMembers, selectedUnitId, statusFilter, searchQuery, unitMap]);

  // Open Unit Dialog (Create Root or Sub-unit or Edit)
  const openCreateUnitDialog = (parentId: string | null = null) => {
    setEditingUnit(null);
    setUnitParentId(parentId ?? "");
    setUnitName("");
    setUnitDisplayOrder(initialUnits.length + 1);
    setUnitActive(true);
    setUnitDialogOpen(true);
  };

  const openEditUnitDialog = (unit: CommitteeUnitItem) => {
    setEditingUnit(unit);
    setUnitParentId(unit.parentId ?? "");
    setUnitName(unit.name);
    setUnitDisplayOrder(unit.displayOrder);
    setUnitActive(unit.active);
    setUnitDialogOpen(true);
  };

  // Submit Unit Form
  const handleSaveUnit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!unitName.trim()) {
      toast.error("Nama unit panitia wajib diisi");
      return;
    }

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("name", unitName.trim());
        if (unitParentId) {
          formData.append("parentId", unitParentId);
        }
        formData.append("displayOrder", String(unitDisplayOrder));
        formData.append("active", unitActive ? "true" : "false");

        if (editingUnit) {
          formData.append("id", editingUnit.id);
          const res = await updateCommitteeUnitAction(formData);
          if (res.success) {
            toast.success("Unit panitia berhasil diperbarui");
            setUnitDialogOpen(false);
          }
        } else {
          const res = await createCommitteeUnitAction(formData);
          if (res.success) {
            toast.success("Unit panitia baru berhasil ditambahkan");
            setUnitDialogOpen(false);
          }
        }
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Gagal menyimpan unit panitia");
      }
    });
  };

  // Delete Unit
  const handleDeleteUnit = () => {
    if (!deleteUnitTarget) return;

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("id", deleteUnitTarget.id);
        const res = await deleteCommitteeUnitAction(formData);
        if (res.success) {
          toast.success(`Unit "${deleteUnitTarget.name}" berhasil dihapus`);
          setDeleteUnitTarget(null);
          if (selectedUnitId === deleteUnitTarget.id) {
            setSelectedUnitId("all");
          }
        }
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Gagal menghapus unit panitia");
      }
    });
  };

  // Reorder Unit Up/Down
  const handleReorderUnit = (unit: TreeNode, direction: "up" | "down") => {
    const siblings = flatTree.filter((u) => u.parentId === unit.parentId);
    const currentIndex = siblings.findIndex((u) => u.id === unit.id);
    if (currentIndex === -1) return;
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= siblings.length) return;

    const targetUnit = siblings[targetIndex];
    const items = [
      { id: unit.id, displayOrder: targetUnit.displayOrder },
      { id: targetUnit.id, displayOrder: unit.displayOrder },
    ];

    startTransition(async () => {
      try {
        await reorderCommitteeUnitsAction(items);
        toast.success("Urutan unit panitia berhasil diperbarui");
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Gagal mengubah urutan unit");
      }
    });
  };

  // Open Member Dialog
  const openAssignMemberDialog = (unitId: string | null = null) => {
    setEditingMember(null);
    setMemberUnitId(unitId || (selectedUnitId !== "all" ? selectedUnitId : initialUnits[0]?.id || ""));
    setMemberPersonId(peopleList[0]?.id || "");
    setMemberTitle("");
    setMemberDisplayOrder(initialMembers.length + 1);
    setMemberActive(true);
    setMemberDialogOpen(true);
  };

  const openEditMemberDialog = (member: CommitteeMemberItem) => {
    setEditingMember(member);
    setMemberUnitId(member.unitId);
    setMemberPersonId(member.personId);
    setMemberTitle(member.title);
    setMemberDisplayOrder(member.displayOrder);
    setMemberActive(member.active);
    setMemberDialogOpen(true);
  };

  // Submit Member Form
  const handleSaveMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberUnitId) {
      toast.error("Pilih unit panitia");
      return;
    }
    if (!memberPersonId) {
      toast.error("Pilih profil orang");
      return;
    }
    if (!memberTitle.trim()) {
      toast.error("Jabatan panitia wajib diisi");
      return;
    }

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("unitId", memberUnitId);
        formData.append("personId", memberPersonId);
        formData.append("title", memberTitle.trim());
        formData.append("displayOrder", String(memberDisplayOrder));
        formData.append("active", memberActive ? "true" : "false");

        if (editingMember) {
          formData.append("id", editingMember.id);
          formData.append("version", String(editingMember.version));
          const res = await updateCommitteeAssignmentAction(formData);
          if (res.success) {
            toast.success("Penugasan panitia berhasil diperbarui");
            setMemberDialogOpen(false);
          }
        } else {
          const res = await assignCommitteeMemberAction(formData);
          if (res.success) {
            toast.success("Anggota panitia berhasil ditugaskan");
            setMemberDialogOpen(false);
          }
        }
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Gagal menyimpan penugasan panitia");
      }
    });
  };

  // Remove Member Assignment
  const handleDeleteMember = () => {
    if (!deleteMemberTarget) return;

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("id", deleteMemberTarget.id);
        const res = await removeCommitteeAssignmentAction(formData);
        if (res.success) {
          toast.success(`Penugasan "${deleteMemberTarget.personName}" berhasil dihapus`);
          setDeleteMemberTarget(null);
        }
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Gagal menghapus penugasan panitia");
      }
    });
  };

  // Quick Create Person Action
  const handleQuickCreatePerson = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickPersonName.trim()) {
      toast.error("Nama lengkap profil wajib diisi");
      return;
    }

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("name", quickPersonName.trim());
        if (quickPersonBio.trim()) {
          formData.append("shortBio", quickPersonBio.trim());
        }
        if (quickPersonPortraitMedia?.id) {
          formData.append("portraitMediaId", quickPersonPortraitMedia.id);
        }

        const res = await createQuickPersonAction(formData);
        if (res.success && res.person) {
          toast.success(`Profil "${res.person.name}" berhasil dibuat`);
          // Add to local people list and select it
          const newPerson: PersonOption = {
            id: res.person.id,
            name: res.person.name,
            slug: res.person.slug,
            shortBio: res.person.shortBio,
            portraitUrl: res.person.portraitUrl,
          };
          setPeopleList((prev) => [newPerson, ...prev]);
          setMemberPersonId(newPerson.id);
          setQuickPersonOpen(false);
          setQuickPersonName("");
          setQuickPersonBio("");
          setQuickPersonPortraitMedia(null);
        }
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Gagal membuat profil orang baru");
      }
    });
  };

  // Render Tree Hierarchy Recursively
  const renderTreeNodes = (nodes: TreeNode[]) => {
    return nodes.map((node) => {
      const isExpanded = expandedNodes[node.id] !== false; // default expanded
      const hasChildren = node.children && node.children.length > 0;
      const isSelected = selectedUnitId === node.id;
      const canAddSubunit = node.level < 4;

      return (
        <div key={node.id} className="space-y-1.5">
          <div
            className={cn(
              "group relative flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2.5 transition-all text-sm",
              isSelected
                ? "border-dgb-300 bg-dgb-50/50 shadow-xs ring-1 ring-dgb/20"
                : "border-border bg-card hover:border-dgb-200 hover:bg-muted/30",
              node.level === 1 && "font-medium",
              node.level === 2 && "ml-4 border-l-2 border-l-fb-400",
              node.level === 3 && "ml-8 border-l-2 border-l-dgb-400",
              node.level === 4 && "ml-12 border-l-2 border-l-amber-400 text-xs"
            )}
          >
            {/* Left: Expander + Unit Name + Info */}
            <div
              className="flex min-w-0 flex-1 cursor-pointer items-center gap-2"
              onClick={() => setSelectedUnitId(isSelected ? "all" : node.id)}
            >
              {hasChildren ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleNode(node.id);
                  }}
                  className="grid size-6 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label={isExpanded ? "Tutup cabang" : "Buka cabang"}
                >
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
              ) : (
                <span className="size-6 text-center text-xs text-muted-foreground/50">·</span>
              )}

              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="truncate font-montserrat font-semibold text-foreground">
                  {node.name}
                </span>

                <span
                  className={cn(
                    "rounded-xs px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase",
                    node.level === 1 && "bg-dgb-100 text-dgb-800",
                    node.level === 2 && "bg-fb-100 text-fb-800",
                    node.level === 3 && "bg-blue-100 text-blue-800",
                    node.level === 4 && "bg-amber-100 text-amber-800"
                  )}
                >
                  Lvl {node.level}
                </span>

                <span
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-muted-foreground"
                  title={`${node.memberCount} penugasan panitia`}
                >
                  <Users size={11} className="text-dgb" />
                  {node.memberCount}
                </span>

                {!node.active && (
                  <span className="rounded-xs bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    Nonaktif
                  </span>
                )}
              </div>
            </div>

            {/* Right: Quick Actions */}
            {canEdit && (
              <div className="flex items-center gap-1 opacity-90 transition-opacity group-hover:opacity-100">
                {canAddSubunit && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-dgb hover:bg-dgb-50"
                    onClick={() => openCreateUnitDialog(node.id)}
                    title={`Tambah sub-unit level ${node.level + 1}`}
                  >
                    <Plus size={13} className="mr-1" /> Sub-unit
                  </Button>
                )}

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-fb-600 hover:bg-fb-50"
                  onClick={() => openAssignMemberDialog(node.id)}
                  title="Tambah penugasan panitia pada unit ini"
                >
                  <UserPlus size={13} className="mr-1" /> Tugas
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                  onClick={() => handleReorderUnit(node, "up")}
                  title="Pindah ke atas"
                >
                  <ArrowUp size={13} />
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                  onClick={() => handleReorderUnit(node, "down")}
                  title="Pindah ke bawah"
                >
                  <ArrowDown size={13} />
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                  onClick={() => openEditUnitDialog(node)}
                  title="Edit unit panitia"
                >
                  <Edit2 size={13} />
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                  onClick={() => setDeleteUnitTarget(node)}
                  title="Hapus unit panitia"
                >
                  <Trash2 size={13} />
                </Button>
              </div>
            )}
          </div>

          {/* Render Children Recursively */}
          {hasChildren && isExpanded && (
            <div className="space-y-1.5">{renderTreeNodes(node.children)}</div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Summary Card */}
      <AdminCard>
        <AdminCardHeader
          eyebrow="Konteks Edisi Aktif"
          title={`Panitia ${edition.name} (${edition.year})`}
          description="Kelola susunan panitia per edisi dengan hierarki unit bertingkat (maksimal 4 level) dan penugasan profil orang."
          action={
            <div className="flex flex-wrap items-center gap-2">
              <AdminBadge value={edition.lifecycle} />
              {canEdit && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 border-dgb-200 text-xs font-semibold text-dgb hover:bg-dgb-50"
                    onClick={() => openCreateUnitDialog(null)}
                  >
                    <Plus size={13} className="mr-1.5" /> Tambah Unit Utama
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 bg-dgb text-xs font-semibold text-white hover:bg-dgb/90"
                    onClick={() => openAssignMemberDialog(null)}
                    disabled={initialUnits.length === 0}
                  >
                    <UserPlus size={13} className="mr-1.5" /> Tambah Penugasan
                  </Button>
                </>
              )}
            </div>
          }
        />

        {/* Completeness Metrics */}
        <div className="grid grid-cols-2 gap-3 border-t border-border/60 bg-muted/20 p-4 sm:grid-cols-4">
          <div className="rounded-lg border border-border/80 bg-card p-3 shadow-2xs">
            <p className="text-xs font-medium text-muted-foreground">Total Unit Panitia</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-montserrat text-2xl font-bold text-foreground">
                {stats.totalUnits}
              </span>
              <span className="text-[11px] text-muted-foreground">
                ({stats.rootUnits} unit utama)
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-border/80 bg-card p-3 shadow-2xs">
            <p className="text-xs font-medium text-muted-foreground">Total Penugasan</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-montserrat text-2xl font-bold text-dgb">
                {stats.totalMembers}
              </span>
              <span className="text-[11px] text-muted-foreground">orang</span>
            </div>
          </div>

          <div className="rounded-lg border border-border/80 bg-card p-3 shadow-2xs">
            <p className="text-xs font-medium text-muted-foreground">Status Unit</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-montserrat text-2xl font-bold text-emerald-600">
                {stats.activeUnits}
              </span>
              <span className="text-[11px] text-muted-foreground">
                aktif / {stats.totalUnits - stats.activeUnits} nonaktif
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-border/80 bg-card p-3 shadow-2xs">
            <p className="text-xs font-medium text-muted-foreground">Status Penugasan</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-montserrat text-2xl font-bold text-emerald-600">
                {stats.activeMembers}
              </span>
              <span className="text-[11px] text-muted-foreground">
                aktif / {stats.totalMembers - stats.activeMembers} nonaktif
              </span>
            </div>
          </div>
        </div>
      </AdminCard>

      {/* Tabs Navigation */}
      <div className="flex border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab("structure")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-2.5 font-montserrat text-sm font-semibold transition-colors",
            activeTab === "structure"
              ? "border-dgb text-dgb"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <FolderTree size={16} /> Struktur & Penugasan
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("members")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-2.5 font-montserrat text-sm font-semibold transition-colors",
            activeTab === "members"
              ? "border-dgb text-dgb"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Users size={16} /> Daftar Anggota ({initialMembers.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("preview")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-2.5 font-montserrat text-sm font-semibold transition-colors",
            activeTab === "preview"
              ? "border-dgb text-dgb"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <LayoutGrid size={16} /> Preview Visual
        </button>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* TAB 1: STRUKTUR & PENUGASAN (DUAL COLUMN WORKSPACE) */}
      {/* ------------------------------------------------------------------- */}
      {activeTab === "structure" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Column: Hierarchical Unit Tree */}
          <div className="space-y-4 lg:col-span-5">
            <AdminCard>
              <div className="flex items-center justify-between border-b border-border/80 p-4">
                <div>
                  <h3 className="font-montserrat text-sm font-semibold text-foreground">
                    Hierarki Unit Panitia
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Maksimal 4 level kedalaman struktur.
                  </p>
                </div>
                {canEdit && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 border-dgb-200 text-xs text-dgb hover:bg-dgb-50"
                    onClick={() => openCreateUnitDialog(null)}
                  >
                    <Plus size={13} className="mr-1" /> Unit Utama
                  </Button>
                )}
              </div>

              <div className="p-3">
                {tree.length === 0 ? (
                  <div className="space-y-3">
                    <AdminEmptyState
                      icon="folder"
                      title="Belum ada unit panitia"
                      description="Tambahkan unit utama pertama untuk memulai struktur kepanitiaan."
                    />
                    {canEdit && (
                      <div className="text-center">
                        <Button
                          type="button"
                          size="sm"
                          className="bg-dgb text-xs text-white hover:bg-dgb/90"
                          onClick={() => openCreateUnitDialog(null)}
                        >
                          <Plus size={13} className="mr-1.5" /> Buat Unit Utama
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Filter All reset button if filtered */}
                    {selectedUnitId !== "all" && (
                      <div className="flex items-center justify-between rounded-md bg-muted/60 px-3 py-1.5 text-xs text-muted-foreground">
                        <span>
                          Filter aktif: <strong>{unitMap.get(selectedUnitId)?.name}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedUnitId("all")}
                          className="font-medium text-dgb hover:underline"
                        >
                          Tampilkan Semua
                        </button>
                      </div>
                    )}
                    {renderTreeNodes(tree)}
                  </div>
                )}
              </div>
            </AdminCard>
          </div>

          {/* Right Column: Member Assignments in Selected / All Units */}
          <div className="space-y-4 lg:col-span-7">
            <AdminCard>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 p-4">
                <div>
                  <h3 className="font-montserrat text-sm font-semibold text-foreground">
                    {selectedUnitId === "all"
                      ? "Seluruh Penugasan Panitia"
                      : `Penugasan Unit: ${unitMap.get(selectedUnitId)?.name || ""}`}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Daftar anggota yang ditugaskan beserta jabatan pada edisi ini.
                  </p>
                </div>
                {canEdit && (
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 bg-dgb text-xs font-semibold text-white hover:bg-dgb/90"
                    onClick={() => openAssignMemberDialog(selectedUnitId !== "all" ? selectedUnitId : null)}
                    disabled={initialUnits.length === 0}
                  >
                    <UserPlus size={13} className="mr-1.5" /> Tambah Anggota
                  </Button>
                )}
              </div>

              {/* Filter and Search Bar */}
              <div className="flex flex-wrap items-center gap-3 border-b border-border/50 bg-muted/10 p-3">
                <div className="relative min-w-[180px] flex-1">
                  <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari nama atau jabatan panitia..."
                    className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-dgb focus:outline-hidden focus:ring-1 focus:ring-dgb"
                  />
                </div>

                <select
                  value={selectedUnitId}
                  onChange={(e) => setSelectedUnitId(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground focus:border-dgb focus:outline-hidden focus:ring-1 focus:ring-dgb"
                >
                  <option value="all">Semua Unit ({initialUnits.length})</option>
                  {flatTree.map((u) => (
                    <option key={u.id} value={u.id}>
                      {"—".repeat(u.level - 1)} {u.name} (Lvl {u.level})
                    </option>
                  ))}
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "inactive")}
                  className="h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground focus:border-dgb focus:outline-hidden focus:ring-1 focus:ring-dgb"
                >
                  <option value="all">Semua Status</option>
                  <option value="active">Aktif</option>
                  <option value="inactive">Nonaktif</option>
                </select>
              </div>

              {/* Members List */}
              <div className="p-3">
                {filteredMembers.length === 0 ? (
                  <div className="space-y-3">
                    <AdminEmptyState
                      icon="users"
                      title="Tidak ada anggota panitia"
                      description={
                        searchQuery
                          ? "Tidak ada panitia yang sesuai dengan kata kunci pencarian."
                          : "Belum ada anggota yang ditugaskan pada unit ini."
                      }
                    />
                    {canEdit && initialUnits.length > 0 && (
                      <div className="text-center">
                        <Button
                          type="button"
                          size="sm"
                          className="bg-dgb text-xs text-white hover:bg-dgb/90"
                          onClick={() => openAssignMemberDialog(selectedUnitId !== "all" ? selectedUnitId : null)}
                        >
                          <UserPlus size={13} className="mr-1.5" /> Tugaskan Anggota
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="divide-y divide-border/60">
                    {filteredMembers.map((member) => {
                      const unit = unitMap.get(member.unitId);

                      return (
                        <div
                          key={member.id}
                          className="flex flex-wrap items-center justify-between gap-3 py-3 transition-colors hover:bg-muted/20"
                        >
                          {/* Left: Avatar + Name + Title + Unit */}
                          <div className="flex items-center gap-3">
                            <div className="relative size-10 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
                              {member.portraitUrl ? (
                                <Image
                                  src={member.portraitUrl}
                                  alt={member.personName}
                                  fill
                                  sizes="40px"
                                  className="object-cover"
                                />
                              ) : (
                                <div className="grid size-full place-items-center bg-dgb-50 text-dgb font-montserrat text-xs font-bold">
                                  {member.personName.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                            </div>

                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-montserrat text-sm font-semibold text-foreground">
                                  {member.personName}
                                </span>
                                {!member.active && (
                                  <span className="rounded-xs bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                    Nonaktif
                                  </span>
                                )}
                              </div>
                              <p className="text-xs font-medium text-dgb">{member.title}</p>
                              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                                <span className="rounded-xs bg-muted/60 px-1.5 py-0.5">
                                  {unit?.name ?? "Unit tidak diketahui"}
                                </span>
                                <span>Urutan: {member.displayOrder}</span>
                              </div>
                            </div>
                          </div>

                          {/* Right: Actions */}
                          {canEdit && (
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                                onClick={() => openEditMemberDialog(member)}
                              >
                                <Edit2 size={13} className="mr-1" /> Edit
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-xs text-destructive hover:bg-destructive/10"
                                onClick={() => setDeleteMemberTarget(member)}
                              >
                                <Trash2 size={13} />
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </AdminCard>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* TAB 2: DAFTAR SELURUH ANGGOTA PANITIA (TABLE VIEW) */}
      {/* ------------------------------------------------------------------- */}
      {activeTab === "members" && (
        <AdminCard>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 p-4">
            <div>
              <h3 className="font-montserrat text-base font-semibold text-foreground">
                Seluruh Panitia {edition.name}
              </h3>
              <p className="text-xs text-muted-foreground">
                Total {filteredMembers.length} anggota panitia terdaftar pada edisi ini.
              </p>
            </div>
            {canEdit && (
              <Button
                type="button"
                size="sm"
                className="bg-dgb text-xs font-semibold text-white hover:bg-dgb/90"
                onClick={() => openAssignMemberDialog(null)}
                disabled={initialUnits.length === 0}
              >
                <UserPlus size={13} className="mr-1.5" /> Tambah Penugasan
              </Button>
            )}
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-3 border-b border-border/50 bg-muted/10 p-3">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama, jabatan, atau unit..."
                className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-dgb focus:outline-hidden focus:ring-1 focus:ring-dgb"
              />
            </div>

            <select
              value={selectedUnitId}
              onChange={(e) => setSelectedUnitId(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground focus:border-dgb focus:outline-hidden focus:ring-1 focus:ring-dgb"
            >
              <option value="all">Semua Unit ({initialUnits.length})</option>
              {flatTree.map((u) => (
                <option key={u.id} value={u.id}>
                  {"—".repeat(u.level - 1)} {u.name} (Lvl {u.level})
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "inactive")}
              className="h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground focus:border-dgb focus:outline-hidden focus:ring-1 focus:ring-dgb"
            >
              <option value="all">Semua Status</option>
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
            </select>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/40 font-montserrat text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Panitia</th>
                  <th className="px-4 py-3">Jabatan</th>
                  <th className="px-4 py-3">Unit Organisasi</th>
                  <th className="px-4 py-3 text-center">Urutan</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  {canEdit && <th className="px-4 py-3 text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={canEdit ? 6 : 5} className="py-8 text-center text-muted-foreground">
                      Tidak ada data anggota panitia.
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map((member) => {
                    const unit = unitMap.get(member.unitId);

                    return (
                      <tr key={member.id} className="transition-colors hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="relative size-8 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
                              {member.portraitUrl ? (
                                <Image
                                  src={member.portraitUrl}
                                  alt={member.personName}
                                  fill
                                  sizes="32px"
                                  className="object-cover"
                                />
                              ) : (
                                <div className="grid size-full place-items-center bg-dgb-50 text-dgb font-montserrat text-[10px] font-bold">
                                  {member.personName.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                            </div>
                            <div>
                              <span className="font-montserrat font-semibold text-foreground">
                                {member.personName}
                              </span>
                              {member.shortBio && (
                                <p className="line-clamp-1 text-[11px] text-muted-foreground">
                                  {member.shortBio}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3 font-medium text-dgb">{member.title}</td>

                        <td className="px-4 py-3">
                          <span className="inline-block rounded-xs bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground">
                            {unit?.name ?? "—"}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-center text-muted-foreground">
                          {member.displayOrder}
                        </td>

                        <td className="px-4 py-3 text-center">
                          {member.active ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                              Aktif
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground border border-border">
                              Nonaktif
                            </span>
                          )}
                        </td>

                        {canEdit && (
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                onClick={() => openEditMemberDialog(member)}
                                title="Edit penugasan"
                              >
                                <Edit2 size={13} />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                                onClick={() => setDeleteMemberTarget(member)}
                                title="Hapus penugasan"
                              >
                                <Trash2 size={13} />
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </AdminCard>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* TAB 3: PREVIEW VISUAL STRUKTUR PANITIA */}
      {/* ------------------------------------------------------------------- */}
      {activeTab === "preview" && (
        <div className="space-y-6">
          <AdminCard>
            <AdminCardHeader
              eyebrow="Preview Struktur Organisasi Panitia"
              title={`Bagan Kepanitiaan ${edition.name} (${edition.year})`}
              description="Visualisasi hierarki struktural unit dan penugasan panitia aktif."
            />

            <div className="space-y-8 p-4 md:p-6">
              {tree.length === 0 ? (
                <AdminEmptyState
                  icon="folder"
                  title="Struktur panitia belum diatur"
                  description="Tambahkan unit panitia dan tugaskan anggota untuk melihat bagan struktur."
                />
              ) : (
                <div className="space-y-8">
                  {tree.map((rootUnit) => {
                    const rootMembers = initialMembers.filter(
                      (m) => m.unitId === rootUnit.id && m.active
                    );

                    return (
                      <div
                        key={rootUnit.id}
                        className="rounded-xl border-2 border-dgb-300 bg-linear-to-b from-dgb-50/40 via-background to-background p-4 shadow-sm md:p-6"
                      >
                        {/* Root Unit Header */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-dgb-200 pb-3">
                          <div className="flex items-center gap-2">
                            <span className="grid size-8 place-items-center rounded-lg bg-dgb text-white shadow-xs">
                              <Building size={16} />
                            </span>
                            <div>
                              <h3 className="font-montserrat text-lg font-bold text-dgb-900">
                                {rootUnit.name}
                              </h3>
                              <p className="text-xs text-muted-foreground">
                                Unit Tingkat 1 (Root) · {rootMembers.length} panitia aktif
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Root Unit Members */}
                        {rootMembers.length > 0 && (
                          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {rootMembers.map((m) => (
                              <div
                                key={m.id}
                                className="flex items-center gap-3 rounded-lg border border-dgb-200 bg-white p-3 shadow-2xs"
                              >
                                <div className="relative size-11 shrink-0 overflow-hidden rounded-full border border-dgb-200 bg-muted">
                                  {m.portraitUrl ? (
                                    <Image
                                      src={m.portraitUrl}
                                      alt={m.personName}
                                      fill
                                      sizes="44px"
                                      className="object-cover"
                                    />
                                  ) : (
                                    <div className="grid size-full place-items-center bg-dgb-50 text-dgb font-montserrat text-xs font-bold">
                                      {m.personName.slice(0, 2).toUpperCase()}
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate font-montserrat text-xs font-bold text-foreground">
                                    {m.personName}
                                  </p>
                                  <p className="truncate text-xs font-semibold text-fb-600">{m.title}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Level 2 Sub-units */}
                        {rootUnit.children.length > 0 && (
                          <div className="mt-6 space-y-6 pl-2 md:pl-6 border-l-2 border-dashed border-dgb-200">
                            {rootUnit.children.map((subUnit) => {
                              const subMembers = initialMembers.filter(
                                (m) => m.unitId === subUnit.id && m.active
                              );

                              return (
                                <div
                                  key={subUnit.id}
                                  className="rounded-lg border border-fb-200 bg-fb-50/20 p-4 shadow-2xs"
                                >
                                  <div className="flex items-center justify-between border-b border-fb-100 pb-2">
                                    <div>
                                      <h4 className="font-montserrat text-sm font-bold text-fb-900">
                                        {subUnit.name}
                                      </h4>
                                      <p className="text-[11px] text-muted-foreground">
                                        Unit Tingkat 2 · {subMembers.length} panitia aktif
                                      </p>
                                    </div>
                                  </div>

                                  {/* Sub-unit Members */}
                                  {subMembers.length > 0 && (
                                    <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3">
                                      {subMembers.map((m) => (
                                        <div
                                          key={m.id}
                                          className="flex items-center gap-2.5 rounded-md border border-border bg-white p-2.5 shadow-2xs"
                                        >
                                          <div className="relative size-9 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
                                            {m.portraitUrl ? (
                                              <Image
                                                src={m.portraitUrl}
                                                alt={m.personName}
                                                fill
                                                sizes="36px"
                                                className="object-cover"
                                              />
                                            ) : (
                                              <div className="grid size-full place-items-center bg-fb-50 text-fb-700 font-montserrat text-[10px] font-bold">
                                                {m.personName.slice(0, 2).toUpperCase()}
                                              </div>
                                            )}
                                          </div>
                                          <div className="min-w-0 flex-1">
                                            <p className="truncate font-montserrat text-xs font-bold text-foreground">
                                              {m.personName}
                                            </p>
                                            <p className="truncate text-[11px] font-semibold text-dgb">
                                              {m.title}
                                            </p>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* Level 3 Sub-units */}
                                  {subUnit.children.length > 0 && (
                                    <div className="mt-4 space-y-4 pl-2 md:pl-4 border-l-2 border-dotted border-fb-300">
                                      {subUnit.children.map((lvl3Unit) => {
                                        const lvl3Members = initialMembers.filter(
                                          (m) => m.unitId === lvl3Unit.id && m.active
                                        );

                                        return (
                                          <div
                                            key={lvl3Unit.id}
                                            className="rounded-md border border-blue-200 bg-blue-50/20 p-3"
                                          >
                                            <h5 className="font-montserrat text-xs font-bold text-blue-950">
                                              {lvl3Unit.name}
                                            </h5>
                                            <p className="text-[10px] text-muted-foreground">
                                              Unit Tingkat 3 · {lvl3Members.length} panitia aktif
                                            </p>

                                            {lvl3Members.length > 0 && (
                                              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                                {lvl3Members.map((m) => (
                                                  <div
                                                    key={m.id}
                                                    className="flex items-center gap-2 rounded-xs border border-border bg-white p-2 text-xs"
                                                  >
                                                    <span className="font-montserrat font-bold text-foreground">
                                                      {m.personName}
                                                    </span>
                                                    <span className="text-muted-foreground">·</span>
                                                    <span className="text-dgb font-medium">{m.title}</span>
                                                  </div>
                                                ))}
                                              </div>
                                            )}

                                            {/* Level 4 Sub-units */}
                                            {lvl3Unit.children.length > 0 && (
                                              <div className="mt-3 space-y-2 pl-3 border-l border-amber-300">
                                                {lvl3Unit.children.map((lvl4Unit) => {
                                                  const lvl4Members = initialMembers.filter(
                                                    (m) => m.unitId === lvl4Unit.id && m.active
                                                  );

                                                  return (
                                                    <div
                                                      key={lvl4Unit.id}
                                                      className="rounded-xs border border-amber-200 bg-amber-50/30 p-2 text-xs"
                                                    >
                                                      <span className="font-montserrat font-bold text-amber-950">
                                                        {lvl4Unit.name} (Lvl 4):
                                                      </span>{" "}
                                                      {lvl4Members.length > 0 ? (
                                                        lvl4Members.map((m) => (
                                                          <span key={m.id} className="mr-2 text-foreground">
                                                            {m.personName} (
                                                            <strong className="text-dgb">{m.title}</strong>)
                                                          </span>
                                                        ))
                                                      ) : (
                                                        <span className="text-muted-foreground">
                                                          Belum ada penugasan
                                                        </span>
                                                      )}
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </AdminCard>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 1: FORM UNIT PANITIA (TAMBAH / EDIT) */}
      {/* =================================================================== */}
      <Dialog open={unitDialogOpen} onOpenChange={setUnitDialogOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleSaveUnit}>
            <DialogHeader>
              <DialogTitle className="font-montserrat text-lg">
                {editingUnit ? "Edit Unit Panitia" : "Tambah Unit Panitia"}
              </DialogTitle>
              <DialogDescription>
                Tentukan nama unit, hierarki induk (maksimal 4 level), dan urutan tampilan.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <AdminField label="Unit Induk (Parent)" hint="Kosongkan jika ini adalah unit tingkat utama (Root).">
                <select
                  value={unitParentId}
                  onChange={(e) => setUnitParentId(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs text-foreground focus:border-dgb focus:outline-hidden focus:ring-1 focus:ring-dgb"
                >
                  <option value="">— Unit Utama (Level 1 Root) —</option>
                  {flatTree
                    .filter((u) => !editingUnit || u.id !== editingUnit.id)
                    .filter((u) => u.level < 4) // Only allow parents if level < 4
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {"—".repeat(u.level - 1)} {u.name} (Lvl {u.level})
                      </option>
                    ))}
                </select>
              </AdminField>

              <AdminField label="Nama Unit Panitia" hint="Contoh: Panitia Inti, Divisi Acara, Seksi Logistik.">
                <AdminInput
                  value={unitName}
                  onChange={(e) => setUnitName(e.target.value)}
                  placeholder="Masukkan nama unit..."
                  required
                />
              </AdminField>

              <div className="grid grid-cols-2 gap-3">
                <AdminField label="Urutan Tampilan">
                  <AdminInput
                    type="number"
                    min={0}
                    value={unitDisplayOrder}
                    onChange={(e) => setUnitDisplayOrder(Number(e.target.value))}
                  />
                </AdminField>

                <AdminField label="Status Unit">
                  <label className="flex h-9 cursor-pointer items-center gap-2 text-xs font-medium text-foreground">
                    <input
                      type="checkbox"
                      checked={unitActive}
                      onChange={(e) => setUnitActive(e.target.checked)}
                      className="size-4 rounded-sm border-input text-dgb focus:ring-dgb"
                    />
                    Unit Aktif
                  </label>
                </AdminField>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setUnitDialogOpen(false)}
                disabled={isPending}
              >
                Batal
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-dgb text-white hover:bg-dgb/90"
                disabled={isPending}
              >
                {isPending ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : null}
                {editingUnit ? "Perbarui Unit" : "Simpan Unit"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* =================================================================== */}
      {/* MODAL 2: FORM PENUGASAN PANITIA (ASSIGN MEMBER) */}
      {/* =================================================================== */}
      <Dialog open={memberDialogOpen} onOpenChange={setMemberDialogOpen}>
        <DialogContent className="max-w-lg">
          <form onSubmit={handleSaveMember}>
            <DialogHeader>
              <DialogTitle className="font-montserrat text-lg">
                {editingMember ? "Edit Penugasan Panitia" : "Tambah Penugasan Panitia"}
              </DialogTitle>
              <DialogDescription>
                Tugaskan profil orang ke unit panitia dengan jabatan spesifik pada edisi ini.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <AdminField label="Unit Panitia">
                <select
                  value={memberUnitId}
                  onChange={(e) => setMemberUnitId(e.target.value)}
                  required
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs text-foreground focus:border-dgb focus:outline-hidden focus:ring-1 focus:ring-dgb"
                >
                  <option value="" disabled>
                    Pilih Unit Panitia
                  </option>
                  {flatTree.map((u) => (
                    <option key={u.id} value={u.id}>
                      {"—".repeat(u.level - 1)} {u.name} (Lvl {u.level})
                    </option>
                  ))}
                </select>
              </AdminField>

              {/* Person Selector with Quick Create Button */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="block text-xs font-semibold text-foreground">
                    Profil Orang <span className="text-destructive">*</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuickPersonOpen(true)}
                    className="flex items-center gap-1 text-[11px] font-semibold text-dgb hover:underline"
                  >
                    <Plus size={12} /> Buat profil baru
                  </button>
                </div>

                <select
                  value={memberPersonId}
                  onChange={(e) => setMemberPersonId(e.target.value)}
                  required
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs text-foreground focus:border-dgb focus:outline-hidden focus:ring-1 focus:ring-dgb"
                >
                  <option value="" disabled>
                    Pilih Profil Orang
                  </option>
                  {peopleList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.shortBio ? `(${p.shortBio})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <AdminField label="Jabatan Panitia (Title)" hint="Contoh: Ketua Pelaksana, Koordinator Acara, Staff Logistik.">
                <AdminInput
                  value={memberTitle}
                  onChange={(e) => setMemberTitle(e.target.value)}
                  placeholder="Masukkan jabatan..."
                  required
                />
              </AdminField>

              <div className="grid grid-cols-2 gap-3">
                <AdminField label="Urutan Tampilan">
                  <AdminInput
                    type="number"
                    min={0}
                    value={memberDisplayOrder}
                    onChange={(e) => setMemberDisplayOrder(Number(e.target.value))}
                  />
                </AdminField>

                <AdminField label="Status Penugasan">
                  <label className="flex h-9 cursor-pointer items-center gap-2 text-xs font-medium text-foreground">
                    <input
                      type="checkbox"
                      checked={memberActive}
                      onChange={(e) => setMemberActive(e.target.checked)}
                      className="size-4 rounded-sm border-input text-dgb focus:ring-dgb"
                    />
                    Penugasan Aktif
                  </label>
                </AdminField>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setMemberDialogOpen(false)}
                disabled={isPending}
              >
                Batal
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-dgb text-white hover:bg-dgb/90"
                disabled={isPending}
              >
                {isPending ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : null}
                {editingMember ? "Perbarui Penugasan" : "Simpan Penugasan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* =================================================================== */}
      {/* MODAL 3: BUAT PROFIL ORANG ON-THE-FLY (QUICK CREATE PERSON) */}
      {/* =================================================================== */}
      <Dialog open={quickPersonOpen} onOpenChange={setQuickPersonOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleQuickCreatePerson}>
            <DialogHeader>
              <DialogTitle className="font-montserrat text-lg">
                Buat Profil Orang Baru
              </DialogTitle>
              <DialogDescription>
                Tambahkan profil orang langsung ke direktori tanpa meninggalkan halaman panitia.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <AdminField label="Nama Lengkap">
                <AdminInput
                  value={quickPersonName}
                  onChange={(e) => setQuickPersonName(e.target.value)}
                  placeholder="Contoh: Muhammad Rizki..."
                  required
                />
              </AdminField>

              <AdminField label="Bio Singkat (Opsional)">
                <AdminInput
                  value={quickPersonBio}
                  onChange={(e) => setQuickPersonBio(e.target.value)}
                  placeholder="Contoh: Alumni Mojang Jajaka 2023..."
                />
              </AdminField>

              <AdminMediaField
                name="portraitMediaId"
                label="Foto Profil (Opsional)"
                aspectRatioHint="1:1"
                acceptType="image"
                value={quickPersonPortraitMedia?.id ?? ""}
                onChange={(asset) => setQuickPersonPortraitMedia(asset)}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setQuickPersonOpen(false)}
                disabled={isPending}
              >
                Batal
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-dgb text-white hover:bg-dgb/90"
                disabled={isPending}
              >
                {isPending ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : null}
                Buat Profil
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* =================================================================== */}
      {/* ALERT DIALOG: HAPUS UNIT PANITIA */}
      {/* =================================================================== */}
      <AlertDialog open={!!deleteUnitTarget} onOpenChange={(open) => !open && setDeleteUnitTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-montserrat">
              Hapus Unit Panitia?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Unit <strong>&quot;{deleteUnitTarget?.name}&quot;</strong> akan dihapus beserta seluruh sub-unit dan penugasan panitia di dalamnya. Tindakan ini dicatat pada audit log dan tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUnit}
              disabled={isPending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isPending ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : null}
              Hapus Unit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* =================================================================== */}
      {/* ALERT DIALOG: HAPUS PENUGASAN PANITIA */}
      {/* =================================================================== */}
      <AlertDialog open={!!deleteMemberTarget} onOpenChange={(open) => !open && setDeleteMemberTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-montserrat">
              Hapus Penugasan Panitia?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Penugasan <strong>{deleteMemberTarget?.personName}</strong> sebagai <strong>{deleteMemberTarget?.title}</strong> pada edisi ini akan dihapus. Profil orang tetap tersimpan di direktori.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMember}
              disabled={isPending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isPending ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : null}
              Hapus Penugasan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

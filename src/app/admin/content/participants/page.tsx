import { asc, eq, inArray } from "drizzle-orm";

import { AdminBadge, AdminCard, AdminEmptyState, AdminPage } from "@/components/admin/primitives";
import { requirePermission } from "@/server/auth/authorization";
import { getAdminEditionContext } from "@/server/cms/context";
import { database } from "@/server/db/client";
import {
  categories,
  mediaAssets,
  participantAchievements,
  participantMedia,
  participantSocialLinks,
  participantTitleAssignments,
  participants,
  selectionStages,
} from "@/server/db/schema";
import { ParticipantDirectory, type DirectoryParticipant } from "./participant-directory";

export const metadata = { title: "Mojang Jajaka" };

export default async function ParticipantsPage() {
  const { effectivePermissions } = await requirePermission("content.view");
  const canEdit = effectivePermissions.has("participants.manage");

  const currentEdition = await getAdminEditionContext();

  if (!currentEdition) {
    return (
      <AdminPage
        eyebrow="Konten / peserta"
        title="Mojang Jajaka"
        description="Kelola peserta, kategori, dan tahap seleksi Pasanggiri Mojang Jajaka Garut."
      >
        <AdminCard padding="none">
          <div className="p-8">
            <AdminEmptyState
              icon="users"
              title="Belum ada edisi dipilih"
              description="Silakan buat atau pilih edisi pada selector di header untuk mengelola peserta."
            />
          </div>
        </AdminCard>
      </AdminPage>
    );
  }

  // Fetch categories of the current edition
  const categoryRows = await database
    .select({
      id: categories.id,
      code: categories.code,
      label: categories.label,
    })
    .from(categories)
    .where(eq(categories.editionId, currentEdition.id))
    .orderBy(asc(categories.displayOrder));

  const stageRows = await database
    .select({ id: selectionStages.id, name: selectionStages.name })
    .from(selectionStages)
    .where(eq(selectionStages.editionId, currentEdition.id))
    .orderBy(asc(selectionStages.displayOrder));

  // Fetch participants with joined category and selectionStages
  const participantRows = await database
    .select({
      id: participants.id,
      categoryId: participants.categoryId,
      categoryCode: categories.code,
      categoryLabel: categories.label,
      number: participants.number,
      name: participants.name,
      currentStageId: participants.currentStageId,
      currentStageName: selectionStages.name,
      selectionStatus: participants.selectionStatus,
      portraitMediaId: participants.portraitMediaId,
      qrisMediaId: participants.qrisMediaId,
      active: participants.active,
      version: participants.version,
    })
    .from(participants)
    .innerJoin(categories, eq(participants.categoryId, categories.id))
    .leftJoin(selectionStages, eq(participants.currentStageId, selectionStages.id))
    .where(eq(participants.editionId, currentEdition.id))
    .orderBy(asc(participants.displayOrder), asc(participants.number));

  const participantIds = participantRows.map((p) => p.id);

  // Fetch media assets for portraits
  const portraitMediaIds = participantRows.map((p) => p.portraitMediaId).filter(Boolean) as string[];
  const mediaMap = new Map<string, { url: string; alt: string | null }>();
  if (portraitMediaIds.length > 0) {
    const assets = await database
      .select({ id: mediaAssets.id, url: mediaAssets.url, alt: mediaAssets.alt })
      .from(mediaAssets)
      .where(inArray(mediaAssets.id, portraitMediaIds));
    for (const a of assets) {
      mediaMap.set(a.id, { url: a.url, alt: a.alt });
    }
  }

  // Fetch count of achievements, social links, and media per participant
  const achievementsCounts = new Map<string, number>();
  const socialLinksCounts = new Map<string, number>();
  const mediaCounts = new Map<string, number>();
  const titleCounts = new Map<string, number>();
  const closeupMap = new Map<string, boolean>();

  if (participantIds.length > 0) {
    const [achievements, socialLinks, mediaItems, titleAssignments] = await Promise.all([
      database
        .select({ id: participantAchievements.id, participantId: participantAchievements.participantId })
        .from(participantAchievements)
        .where(inArray(participantAchievements.participantId, participantIds)),
      database
        .select({ id: participantSocialLinks.id, participantId: participantSocialLinks.participantId })
        .from(participantSocialLinks)
        .where(inArray(participantSocialLinks.participantId, participantIds)),
      database
        .select({ id: participantMedia.id, participantId: participantMedia.participantId, role: participantMedia.role })
        .from(participantMedia)
        .where(inArray(participantMedia.participantId, participantIds)),
      database
        .select({ participantId: participantTitleAssignments.participantId })
        .from(participantTitleAssignments)
        .where(inArray(participantTitleAssignments.participantId, participantIds)),
    ]);

    for (const a of achievements) {
      achievementsCounts.set(a.participantId, (achievementsCounts.get(a.participantId) ?? 0) + 1);
    }
    for (const s of socialLinks) {
      socialLinksCounts.set(s.participantId, (socialLinksCounts.get(s.participantId) ?? 0) + 1);
    }
    for (const m of mediaItems) {
      mediaCounts.set(m.participantId, (mediaCounts.get(m.participantId) ?? 0) + 1);
      if (m.role === "closeup") {
        closeupMap.set(m.participantId, true);
      }
    }
    for (const assignment of titleAssignments) {
      titleCounts.set(assignment.participantId, (titleCounts.get(assignment.participantId) ?? 0) + 1);
    }
  }

  const initialParticipants: DirectoryParticipant[] = participantRows.map((row) => {
    const portraitAsset = row.portraitMediaId ? mediaMap.get(row.portraitMediaId) : null;
    const hasCloseup = closeupMap.get(row.id) ?? Boolean(row.portraitMediaId);

    return {
      id: row.id,
      categoryId: row.categoryId,
      categoryCode: row.categoryCode,
      categoryLabel: row.categoryLabel,
      number: row.number,
      name: row.name,
      currentStageId: row.currentStageId,
      currentStageName: row.currentStageName,
      selectionStatus: row.selectionStatus,
      portraitUrl: portraitAsset?.url ?? null,
      portraitAlt: portraitAsset?.alt ?? null,
      qrisMediaId: row.qrisMediaId,
      active: row.active,
      version: row.version,
      achievementsCount: achievementsCounts.get(row.id) ?? 0,
      socialLinksCount: socialLinksCounts.get(row.id) ?? 0,
      mediaCount: mediaCounts.get(row.id) ?? 0,
      titleCount: titleCounts.get(row.id) ?? 0,
      hasCloseup,
    };
  });

  return (
    <AdminPage
      eyebrow="Konten / peserta"
      title="Mojang Jajaka"
      description="Kelola pendaftar, tahap seleksi, dan profil peserta."
      action={<AdminBadge value={currentEdition.lifecycle} />}
    >
      <ParticipantDirectory
        key={`${currentEdition.id}:${initialParticipants.map((participant) => `${participant.id}:${participant.version}`).join(",")}`}
        categories={categoryRows}
        stages={stageRows}
        initialParticipants={initialParticipants}
        canEdit={canEdit}
      />
    </AdminPage>
  );
}

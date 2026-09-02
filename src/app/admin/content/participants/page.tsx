import { asc, eq } from "drizzle-orm";

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
  participants,
} from "@/server/db/schema";
import {
  ParticipantsListClient,
  type CategoryOption,
  type ParticipantItem,
} from "./participants-list-client";

export const metadata = { title: "Mojang Jajaka" };

export default async function ParticipantsPage() {
  const { effectivePermissions } = await requirePermission("content.view");
  const canEdit = effectivePermissions.has("participants.manage") || effectivePermissions.has("content.edit");
  const canManageMedia = effectivePermissions.has("media.manage");

  const currentEdition = await getAdminEditionContext();

  if (!currentEdition) {
    return (
      <AdminPage
        eyebrow="Konten / peserta"
        title="Mojang Jajaka"
        description="Kelola peserta, kategori, dan tahap seleksi Pasanggiri Mojang Jajaka Garut."
      >
        <AdminCard>
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

  const categoryOptions: CategoryOption[] = categoryRows.map((c) => ({
    id: c.id,
    code: c.code,
    label: c.label,
  }));

  // Fetch participants with joined category and mediaAssets
  const participantRows = await database
    .select({
      id: participants.id,
      editionId: participants.editionId,
      categoryId: participants.categoryId,
      categoryCode: categories.code,
      categoryLabel: categories.label,
      number: participants.number,
      name: participants.name,
      slug: participants.slug,
      stage: participants.stage,
      bio: participants.bio,
      portraitMediaId: participants.portraitMediaId,
      qrisMediaId: participants.qrisMediaId,
      paymentUrl: participants.paymentUrl,
      displayOrder: participants.displayOrder,
      active: participants.active,
      version: participants.version,
    })
    .from(participants)
    .innerJoin(categories, eq(participants.categoryId, categories.id))
    .where(eq(participants.editionId, currentEdition.id))
    .orderBy(asc(participants.displayOrder), asc(participants.number));

  const participantIds = participantRows.map((p) => p.id);

  // Fetch media assets for portraits & qris
  const portraitMediaIds = participantRows.map((p) => p.portraitMediaId).filter(Boolean) as string[];
  const qrisMediaIds = participantRows.map((p) => p.qrisMediaId).filter(Boolean) as string[];
  const allMediaIds = Array.from(new Set([...portraitMediaIds, ...qrisMediaIds]));

  const mediaMap = new Map<string, { url: string; alt: string | null }>();
  if (allMediaIds.length > 0) {
    const assets = await database
      .select({ id: mediaAssets.id, url: mediaAssets.url, alt: mediaAssets.alt })
      .from(mediaAssets);
    for (const a of assets) {
      mediaMap.set(a.id, { url: a.url, alt: a.alt });
    }
  }

  // Fetch count of achievements, social links, and media per participant
  const achievementsCounts = new Map<string, number>();
  const socialLinksCounts = new Map<string, number>();
  const mediaCounts = new Map<string, number>();
  const closeupMap = new Map<string, boolean>();

  if (participantIds.length > 0) {
    const [achievements, socialLinks, mediaItems] = await Promise.all([
      database.select({ id: participantAchievements.id, participantId: participantAchievements.participantId }).from(participantAchievements),
      database.select({ id: participantSocialLinks.id, participantId: participantSocialLinks.participantId }).from(participantSocialLinks),
      database.select({ id: participantMedia.id, participantId: participantMedia.participantId, role: participantMedia.role }).from(participantMedia),
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
  }

  const initialParticipants: ParticipantItem[] = participantRows.map((row) => {
    const portraitAsset = row.portraitMediaId ? mediaMap.get(row.portraitMediaId) : null;
    const qrisAsset = row.qrisMediaId ? mediaMap.get(row.qrisMediaId) : null;
    const hasCloseup = closeupMap.get(row.id) ?? Boolean(row.portraitMediaId);

    return {
      id: row.id,
      editionId: row.editionId,
      categoryId: row.categoryId,
      categoryCode: row.categoryCode,
      categoryLabel: row.categoryLabel,
      number: row.number,
      name: row.name,
      slug: row.slug,
      stage: row.stage,
      bio: row.bio,
      portraitMediaId: row.portraitMediaId,
      portraitUrl: portraitAsset?.url ?? null,
      portraitAlt: portraitAsset?.alt ?? null,
      qrisMediaId: row.qrisMediaId,
      qrisUrl: qrisAsset?.url ?? null,
      paymentUrl: row.paymentUrl,
      displayOrder: row.displayOrder,
      active: row.active,
      version: row.version,
      achievementsCount: achievementsCounts.get(row.id) ?? 0,
      socialLinksCount: socialLinksCounts.get(row.id) ?? 0,
      mediaCount: mediaCounts.get(row.id) ?? 0,
      hasCloseup,
    };
  });

  return (
    <AdminPage
      eyebrow="Konten / peserta"
      title="Mojang Jajaka"
      description={`Kelola identitas peserta, prestasi, tautan sosial media, galeri foto, dan QRIS untuk ${currentEdition.name} (${currentEdition.year}).`}
      action={<AdminBadge value={currentEdition.lifecycle} />}
    >
      <ParticipantsListClient
        edition={{
          id: currentEdition.id,
          year: currentEdition.year,
          name: currentEdition.name,
          lifecycle: currentEdition.lifecycle,
        }}
        categories={categoryOptions}
        initialParticipants={initialParticipants}
        canEdit={canEdit}
        canManageMedia={canManageMedia}
      />
    </AdminPage>
  );
}

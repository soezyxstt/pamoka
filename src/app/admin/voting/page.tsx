import { and, desc, eq, inArray } from "drizzle-orm";

import { AdminBadge, AdminCard, AdminEmptyState, AdminPage } from "@/components/admin/primitives";
import { requirePermission } from "@/server/auth/authorization";
import { database } from "@/server/db/client";
import { categories, editions, participants, voteDailyTallies, votingCampaigns } from "@/server/db/schema";
import { getAdminEditionContext } from "@/server/cms/context";

import { VotingWorkspace } from "./voting-workspace";

export const metadata = { title: "Voting tahunan" };

export default async function VotingAdminPage() {
  const { effectivePermissions } = await requirePermission("voting.view");
  const currentEdition = await getAdminEditionContext();

  if (!currentEdition) {
    return (
      <AdminPage
        eyebrow="Operasional / voting"
        title="Voting tahunan"
        description="Kelola kampanye per edisi, QRIS finalis, dan pembaruan tally manual tanpa mencampur peserta antar tahun."
      >
        <AdminCard>
          <AdminEmptyState
            icon="calendar"
            title="Belum ada edisi aktif"
            description="Pilih edisi dari header selector atau buat edisi baru di menu kelola edisi untuk mengelola voting."
          />
        </AdminCard>
      </AdminPage>
    );
  }

  const [campaignRows, participantRows] = await Promise.all([
    database
      .select({
        id: votingCampaigns.id,
        editionId: votingCampaigns.editionId,
        editionName: editions.name,
        year: editions.year,
        name: votingCampaigns.name,
        status: votingCampaigns.status,
        pricePerPoint: votingCampaigns.pricePerPoint,
        startsAt: votingCampaigns.startsAt,
        endsAt: votingCampaigns.endsAt,
      })
      .from(votingCampaigns)
      .innerJoin(editions, eq(votingCampaigns.editionId, editions.id))
      .where(eq(votingCampaigns.editionId, currentEdition.id))
      .orderBy(desc(votingCampaigns.startsAt)),

    database
      .select({
        id: participants.id,
        editionId: participants.editionId,
        name: participants.name,
        number: participants.number,
        categoryCode: categories.code,
        categoryLabel: categories.label,
        qrisMediaId: participants.qrisMediaId,
      })
      .from(participants)
      .innerJoin(categories, eq(participants.categoryId, categories.id))
      .where(
        and(
          eq(participants.editionId, currentEdition.id),
          eq(participants.stage, "finalis"),
          eq(participants.active, true),
        ),
      )
      .orderBy(categories.displayOrder, participants.displayOrder),
  ]);

  const campaignIds = campaignRows.map((c) => c.id);
  const tallyRows = campaignIds.length
    ? await database
        .select({
          id: voteDailyTallies.id,
          campaignId: voteDailyTallies.campaignId,
          participantId: voteDailyTallies.participantId,
          localDate: voteDailyTallies.localDate,
          amount: voteDailyTallies.amount,
          version: voteDailyTallies.version,
          updatedAt: voteDailyTallies.updatedAt,
        })
        .from(voteDailyTallies)
        .where(inArray(voteDailyTallies.campaignId, campaignIds))
        .orderBy(desc(voteDailyTallies.localDate))
    : [];

  return (
    <AdminPage
      eyebrow="Operasional / voting"
      title={`Voting ${currentEdition.name}`}
      description="Kelola kampanye, QRIS finalis, dan pembaruan tally manual untuk edisi yang dipilih di selector header."
      action={<AdminBadge value={currentEdition.lifecycle} />}
    >
      <VotingWorkspace
        currentEdition={currentEdition}
        campaigns={campaignRows.map((campaign) => ({
          ...campaign,
          startsAt: campaign.startsAt.toISOString(),
          endsAt: campaign.endsAt.toISOString(),
        }))}
        participants={participantRows.map((participant) => ({
          ...participant,
          qrisReady: Boolean(participant.qrisMediaId),
        }))}
        tallies={tallyRows.map((tally) => ({
          ...tally,
          updatedAt: tally.updatedAt.toISOString(),
        }))}
        canManage={effectivePermissions.has("voting.manage")}
        canTally={effectivePermissions.has("voting.tally")}
      />
    </AdminPage>
  );
}

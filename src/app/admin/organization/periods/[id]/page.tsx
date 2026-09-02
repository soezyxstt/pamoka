import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { AdminPage } from "@/components/admin/primitives";
import { requirePermission } from "@/server/auth/authorization";
import { database } from "@/server/db/client";
import {
  editions,
  mediaAssets,
  organizationMemberships,
  organizationPeriods,
  organizationUnits,
  people,
} from "@/server/db/schema";
import {
  PeriodDetailClient,
  type ConnectedEdition,
  type DetailMember,
  type DetailPeriod,
  type DetailUnit,
  type PersonOption,
} from "./period-detail-client";

export const metadata = { title: "Detail Periode Kepengurusan" };

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function PeriodDetailPage({ params }: PageProps) {
  const { id } = await params;
  const { effectivePermissions } = await requirePermission("content.view");
  const canEdit = effectivePermissions.has("people.manage") || effectivePermissions.has("content.edit");
  const canPublish = effectivePermissions.has("content.publish");

  // Fetch target period
  const [periodRow] = await database
    .select()
    .from(organizationPeriods)
    .where(eq(organizationPeriods.id, id))
    .limit(1);

  if (!periodRow) {
    notFound();
  }

  const period: DetailPeriod = {
    id: periodRow.id,
    label: periodRow.label,
    startYear: periodRow.startYear,
    endYear: periodRow.endYear,
    vision: periodRow.vision,
    missionJson: periodRow.missionJson,
    lifecycle: periodRow.lifecycle,
    version: periodRow.version,
    createdAt: periodRow.createdAt,
    updatedAt: periodRow.updatedAt,
  };

  // Fetch units for this period
  const unitRows = await database
    .select()
    .from(organizationUnits)
    .where(eq(organizationUnits.periodId, id))
    .orderBy(asc(organizationUnits.displayOrder), asc(organizationUnits.name));

  const units: DetailUnit[] = unitRows.map((u) => ({
    id: u.id,
    periodId: u.periodId,
    parentId: u.parentId,
    name: u.name,
    displayOrder: u.displayOrder,
    active: u.active,
  }));

  // Fetch memberships for this period with joined person and portrait asset
  const memberRows = await database
    .select({
      id: organizationMemberships.id,
      periodId: organizationMemberships.periodId,
      unitId: organizationMemberships.unitId,
      personId: organizationMemberships.personId,
      title: organizationMemberships.title,
      displayOrder: organizationMemberships.displayOrder,
      active: organizationMemberships.active,
      version: organizationMemberships.version,
      personName: people.name,
      personSlug: people.slug,
      portraitUrl: mediaAssets.url,
    })
    .from(organizationMemberships)
    .innerJoin(people, eq(organizationMemberships.personId, people.id))
    .leftJoin(mediaAssets, eq(people.portraitMediaId, mediaAssets.id))
    .where(eq(organizationMemberships.periodId, id))
    .orderBy(asc(organizationMemberships.displayOrder));

  const members: DetailMember[] = memberRows.map((m) => ({
    id: m.id,
    periodId: m.periodId,
    unitId: m.unitId,
    personId: m.personId,
    title: m.title,
    displayOrder: m.displayOrder,
    active: m.active,
    version: m.version,
    personName: m.personName,
    personSlug: m.personSlug,
    portraitUrl: m.portraitUrl,
  }));

  // Fetch connected editions
  const editionRows = await database
    .select({
      id: editions.id,
      year: editions.year,
      name: editions.name,
      slug: editions.slug,
      lifecycle: editions.lifecycle,
    })
    .from(editions)
    .where(eq(editions.organizationPeriodId, id))
    .orderBy(asc(editions.year));

  const connectedEditions: ConnectedEdition[] = editionRows.map((e) => ({
    id: e.id,
    year: e.year,
    name: e.name,
    slug: e.slug,
    lifecycle: e.lifecycle,
  }));

  // Fetch people options for assignments
  const peopleRaw = await database
    .select({
      id: people.id,
      name: people.name,
      slug: people.slug,
      portraitUrl: mediaAssets.url,
    })
    .from(people)
    .leftJoin(mediaAssets, eq(people.portraitMediaId, mediaAssets.id))
    .orderBy(asc(people.name));

  const peopleOptions: PersonOption[] = peopleRaw.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    portraitUrl: p.portraitUrl,
  }));

  return (
    <AdminPage
      eyebrow="Kepengurusan / detail periode"
      title={period.label}
      description={`Kelola pohon struktur unit hingga 4 level dan penugasan pengurus untuk masa bakti ${period.startYear} - ${period.endYear}.`}
    >
      <PeriodDetailClient
        period={period}
        units={units}
        members={members}
        connectedEditions={connectedEditions}
        peopleOptions={peopleOptions}
        canEdit={canEdit}
        canPublish={canPublish}
      />
    </AdminPage>
  );
}

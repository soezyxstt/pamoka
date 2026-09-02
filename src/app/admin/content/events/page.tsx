import { asc, eq, sql } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";

import { AdminPage } from "@/components/admin/primitives";
import { requirePermission } from "@/server/auth/authorization";
import { getAdminEditionContext } from "@/server/cms/context";
import { database } from "@/server/db/client";
import { events, galleries, mediaAssets } from "@/server/db/schema";
import { EventsClient, type EventItem } from "./events-client";

export const metadata = { title: "Acara" };

export default async function EventsPage() {
  const actor = await requirePermission("content.view");
  const currentEdition = await getAdminEditionContext();

  if (!currentEdition) {
    return (
      <AdminPage
        eyebrow="Studio / events"
        title="Acara & Rangkaian Kegiatan"
        description="Silakan pilih edisi aktif terlebih dahulu untuk mengelola acara."
      >
        <div className="p-8 text-center text-muted-foreground text-sm">
          Tidak ada edisi yang aktif.
        </div>
      </AdminPage>
    );
  }

  // Fetch events with heroMedia asset and gallery count
  const rawEvents = await database
    .select({
      id: events.id,
      label: events.label,
      slug: events.slug,
      description: events.description,
      heroMediaId: events.heroMediaId,
      displayOrder: events.displayOrder,
      active: events.active,
      heroMedia: {
        id: mediaAssets.id,
        url: mediaAssets.url,
        filename: mediaAssets.filename,
        alt: mediaAssets.alt,
        mimeType: mediaAssets.mimeType,
        bytes: mediaAssets.bytes,
        decorative: mediaAssets.decorative,
        lifecycle: mediaAssets.lifecycle,
        folderId: mediaAssets.folderId,
      },
    })
    .from(events)
    .leftJoin(mediaAssets, eq(events.heroMediaId, mediaAssets.id))
    .where(eq(events.editionId, currentEdition.id))
    .orderBy(asc(events.displayOrder));

  // Count galleries for each event
  const galleryCounts = await database
    .select({
      ownerId: galleries.ownerId,
      count: sql<number>`count(${galleries.id})`.mapWith(Number),
    })
    .from(galleries)
    .where(eq(galleries.ownerType, "event"))
    .groupBy(galleries.ownerId);

  const galleryCountMap = new Map<string, number>();
  for (const row of galleryCounts) {
    if (row.ownerId) {
      galleryCountMap.set(row.ownerId, row.count);
    }
  }

  const initialEvents: EventItem[] = rawEvents.map((ev) => ({
    id: ev.id,
    label: ev.label,
    slug: ev.slug,
    description: ev.description,
    heroMediaId: ev.heroMediaId,
    heroMedia: ev.heroMedia?.id ? ev.heroMedia : null,
    displayOrder: ev.displayOrder,
    active: Boolean(ev.active),
    galleryCount: galleryCountMap.get(ev.id) ?? 0,
  }));

  const canEdit = actor.effectivePermissions.has("events.manage");

  return (
    <AdminPage
      eyebrow="Studio / events"
      title="Acara & Rangkaian Kegiatan"
      description={`Kelola jadwal dan rangkaian kegiatan untuk ${currentEdition.name} (${currentEdition.year}).`}
    >
      <EventsClient
        initialEvents={initialEvents}
        editionName={currentEdition.name}
        editionId={currentEdition.id}
        canEdit={canEdit}
      />
    </AdminPage>
  );
}

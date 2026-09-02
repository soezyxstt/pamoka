import { asc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { AdminPage } from "@/components/admin/primitives";
import { requirePermission } from "@/server/auth/authorization";
import { getAdminEditionContext } from "@/server/cms/context";
import { database } from "@/server/db/client";
import { events } from "@/server/db/schema";
import { NewGalleryForm } from "./new-gallery-form";

export const metadata = { title: "Buat Album Galeri Baru" };

export default async function NewGalleryPage() {
  const actor = await requirePermission("gallery.manage");
  const currentEdition = await getAdminEditionContext();

  if (!currentEdition) {
    redirect("/admin/content/galleries");
  }

  const eventRows = await database
    .select({ id: events.id, label: events.label })
    .from(events)
    .where(eq(events.editionId, currentEdition.id))
    .orderBy(asc(events.displayOrder));

  return (
    <AdminPage
      eyebrow="Studio / gallery"
      title="Buat Album Baru"
      description={`Buat album galeri dokumentasi foto dan video untuk ${currentEdition.name} (${currentEdition.year}).`}
    >
      <NewGalleryForm
        editionName={currentEdition.name}
        editionId={currentEdition.id}
        eventsList={eventRows}
      />
    </AdminPage>
  );
}

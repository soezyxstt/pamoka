"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";

import { appendAuditLog } from "@/server/auth/audit";
import { auth } from "@/server/auth/config";
import { ADMIN_EDITION_COOKIE_NAME } from "@/server/cms/context";
import { database } from "@/server/db/client";
import { editions } from "@/server/db/schema";

/**
 * Server action to set the admin edition cookie and revalidate admin routes.
 */
export async function setAdminEditionCookie(editionId: string) {
  if (!editionId) {
    throw new Error("ID edisi wajib disertakan");
  }

  const [edition] = await database
    .select({
      id: editions.id,
      year: editions.year,
      slug: editions.slug,
      name: editions.name,
      lifecycle: editions.lifecycle,
    })
    .from(editions)
    .where(eq(editions.id, editionId))
    .limit(1);

  if (!edition) {
    throw new Error("Edisi tidak ditemukan");
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_EDITION_COOKIE_NAME, edition.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/admin",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  });

  // Log audit if session is authenticated
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (session?.user) {
      await database.transaction(async (tx) => {
        await appendAuditLog(tx, {
          actorUserId: session.user.id,
          actorLabel: session.user.email,
          action: "edition.context.select",
          resourceType: "edition",
          resourceId: edition.id,
          resourceLabel: `${edition.name} (${edition.year})`,
          after: { editionId: edition.id, year: edition.year, name: edition.name },
          changedFields: ["editionContext"],
          source: "admin-shell",
        });
      });
    }
  } catch {
    // If audit logging fails outside request context, proceed gracefully
  }

  revalidatePath("/admin");
  return { success: true, edition };
}

import { createClient } from "@libsql/client/node";
import { asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import {
  assignEditionTitle,
  createEditionTitle,
  deleteEditionTitle,
  reorderEditionTitles,
  setEditionTitleActive,
  unassignEditionTitle,
  updateEditionTitle,
} from "../selection/title-operations";
import * as schema from "./schema";
import {
  auditLogs,
  authUsers,
  categories,
  editions,
  editionTitles,
  participantTitleAssignments,
  participants,
  selectionStages,
} from "./schema";

const actor = { userId: "title-actor", label: "title@example.com" };
const now = new Date("2026-09-05T04:00:00.000Z");

async function createTestDatabase() {
  const directory = await mkdtemp(join(tmpdir(), "moka-title-test-"));
  const client = createClient({ url: `file:${join(directory, "test.db")}` });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: resolve("drizzle") });
  await db.insert(authUsers).values({ id: actor.userId, name: "Title Actor", email: actor.label, emailVerified: true, createdAt: now, updatedAt: now });
  await db.insert(editions).values([
    { id: "edition-a", year: 2031, slug: "2031-title", name: "Edisi A", lifecycle: "active", createdAt: now, updatedAt: now },
    { id: "edition-b", year: 2032, slug: "2032-title", name: "Edisi B", lifecycle: "draft", createdAt: now, updatedAt: now },
  ]);
  await db.insert(categories).values([
    { id: "category-a", editionId: "edition-a", code: "JD", slug: "jd-title-a", label: "JD", displayOrder: 1, active: true, createdAt: now, updatedAt: now },
    { id: "category-b", editionId: "edition-b", code: "JD", slug: "jd-title-b", label: "JD", displayOrder: 1, active: true, createdAt: now, updatedAt: now },
  ]);
  await db.insert(selectionStages).values([
    { id: "stage-a-early", editionId: "edition-a", name: "Semifinal", slug: "semifinal", displayOrder: 1, targetParticipantCount: 4, lifecycle: "closed", finalStage: false, createdAt: now, updatedAt: now },
    { id: "stage-a-final", editionId: "edition-a", name: "Final", slug: "final", displayOrder: 2, targetParticipantCount: 2, lifecycle: "active", finalStage: true, createdAt: now, updatedAt: now },
    { id: "stage-b-final", editionId: "edition-b", name: "Final", slug: "final", displayOrder: 1, targetParticipantCount: 1, lifecycle: "active", finalStage: true, createdAt: now, updatedAt: now },
  ]);
  await db.insert(participants).values([
    { id: "participant-final-a", editionId: "edition-a", categoryId: "category-a", stage: "final", currentStageId: "stage-a-final", selectionStatus: "active", number: 1, name: "Finalis A", slug: "finalis-a", displayOrder: 1, active: true, createdAt: now, updatedAt: now },
    { id: "participant-final-a-2", editionId: "edition-a", categoryId: "category-a", stage: "final", currentStageId: "stage-a-final", selectionStatus: "active", number: 2, name: "Finalis A Dua", slug: "finalis-a-dua", displayOrder: 2, active: true, createdAt: now, updatedAt: now },
    { id: "participant-early-a", editionId: "edition-a", categoryId: "category-a", stage: "semifinal", currentStageId: "stage-a-early", selectionStatus: "active", number: 3, name: "Semifinalis A", slug: "semifinalis-a", displayOrder: 3, active: true, createdAt: now, updatedAt: now },
    { id: "participant-final-b", editionId: "edition-b", categoryId: "category-b", stage: "final", currentStageId: "stage-b-final", selectionStatus: "active", number: 1, name: "Finalis B", slug: "finalis-b", displayOrder: 1, active: true, createdAt: now, updatedAt: now },
  ]);
  return { client, db };
}

test("gelar edisi mendukung CRUD, urutan, versi, dan audit", async () => {
  const { client, db } = await createTestDatabase();
  try {
    const winner = await createEditionTitle(db, "edition-a", { name: "Mojang Pinilih", description: "Gelar utama", capacity: 1 }, actor, now);
    const favorite = await createEditionTitle(db, "edition-a", { name: "Mojang Kameumeut", capacity: 2 }, actor, now);
    await assert.rejects(
      createEditionTitle(db, "edition-a", { name: "Mojang Pinilih", capacity: 1 }, actor, now),
      /sudah digunakan/,
    );
    await assert.rejects(
      updateEditionTitle(db, "edition-a", { titleId: winner.id, expectedVersion: 99, name: "Pinilih", capacity: 1 }, actor, now),
      /telah diubah/,
    );
    await updateEditionTitle(db, "edition-a", { titleId: winner.id, expectedVersion: 1, name: "Mojang Pinilih", description: "Gelar utama edisi", capacity: 2 }, actor, now);
    await reorderEditionTitles(db, "edition-a", [
      { id: favorite.id, expectedVersion: 1 },
      { id: winner.id, expectedVersion: 2 },
    ], actor, now);
    const rows = await db.select().from(editionTitles).where(eq(editionTitles.editionId, "edition-a")).orderBy(asc(editionTitles.displayOrder));
    assert.deepEqual(rows.map((row) => row.id), [favorite.id, winner.id]);
    await setEditionTitleActive(db, "edition-a", { titleId: favorite.id, expectedVersion: 2, active: false }, actor, now);
    await deleteEditionTitle(db, "edition-a", { titleId: favorite.id, expectedVersion: 3 }, actor, now);
    const audits = await db.select().from(auditLogs).where(eq(auditLogs.source, "admin-selection"));
    assert.ok(audits.some((audit) => audit.action === "edition_title.create"));
    assert.ok(audits.some((audit) => audit.action === "edition_title.reorder"));
    assert.ok(audits.some((audit) => audit.action === "edition_title.delete"));
  } finally {
    client.close();
  }
});

test("penyematan gelar hanya menerima peserta tahap final dan menjaga capacity", async () => {
  const { client, db } = await createTestDatabase();
  try {
    const winner = await createEditionTitle(db, "edition-a", { name: "Mojang Pinilih", capacity: 1 }, actor, now);
    const favorite = await createEditionTitle(db, "edition-a", { name: "Mojang Kameumeut", capacity: 2 }, actor, now);
    await assert.rejects(
      assignEditionTitle(db, "edition-a", { titleId: winner.id, participantId: "participant-early-a", expectedTitleVersion: 1 }, actor, now),
      /tahap final/,
    );
    await assert.rejects(
      assignEditionTitle(db, "edition-a", { titleId: winner.id, participantId: "participant-final-b", expectedTitleVersion: 1 }, actor, now),
      /tidak ditemukan/,
    );
    const first = await assignEditionTitle(db, "edition-a", { titleId: winner.id, participantId: "participant-final-a", expectedTitleVersion: 1 }, actor, now);
    assert.equal(first.version, 2);
    await assert.rejects(
      assignEditionTitle(db, "edition-a", { titleId: winner.id, participantId: "participant-final-a-2", expectedTitleVersion: 2 }, actor, now),
      /sudah penuh/,
    );
    await assignEditionTitle(db, "edition-a", { titleId: favorite.id, participantId: "participant-final-a", expectedTitleVersion: 1 }, actor, now);
    const assignments = await db.select().from(participantTitleAssignments).where(eq(participantTitleAssignments.participantId, "participant-final-a"));
    assert.equal(assignments.length, 2);
    await assert.rejects(
      deleteEditionTitle(db, "edition-a", { titleId: winner.id, expectedVersion: 2 }, actor, now),
      /sudah diberikan/,
    );
  } finally {
    client.close();
  }
});

test("pelepasan gelar memakai versi terbaru dan membuka kembali slot", async () => {
  const { client, db } = await createTestDatabase();
  try {
    const title = await createEditionTitle(db, "edition-a", { name: "Mojang Pinilih", capacity: 1 }, actor, now);
    await assignEditionTitle(db, "edition-a", { titleId: title.id, participantId: "participant-final-a", expectedTitleVersion: 1 }, actor, now);
    await assert.rejects(
      unassignEditionTitle(db, "edition-a", { titleId: title.id, participantId: "participant-final-a", expectedTitleVersion: 1 }, actor, now),
      /telah diubah/,
    );
    const removed = await unassignEditionTitle(db, "edition-a", { titleId: title.id, participantId: "participant-final-a", expectedTitleVersion: 2 }, actor, now);
    assert.equal(removed.version, 3);
    await assignEditionTitle(db, "edition-a", { titleId: title.id, participantId: "participant-final-a-2", expectedTitleVersion: 3 }, actor, now);
    const assignments = await db.select().from(participantTitleAssignments).where(eq(participantTitleAssignments.editionTitleId, title.id));
    assert.deepEqual(assignments.map((assignment) => assignment.participantId), ["participant-final-a-2"]);
  } finally {
    client.close();
  }
});

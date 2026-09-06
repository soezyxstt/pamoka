import { createClient } from "@libsql/client/node";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import * as schema from "./schema";
import {
  committeeAssignments,
  committeeUnits,
  editions,
  organizationMemberships,
  organizationPeriods,
  organizationUnits,
  people,
} from "./schema";

async function createTestDatabase() {
  const directory = await mkdtemp(join(tmpdir(), "moka-committee-test-"));
  const client = createClient({ url: `file:${join(directory, "test.db")}` });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: resolve("drizzle") });
  return { client, db };
}

test("committeeUnits mendukung struktur tree hierarkis bertingkat per edisi (maksimal 4 level)", async () => {
  const { client, db } = await createTestDatabase();
  try {
    const now = new Date("2026-09-02T00:00:00.000Z");

    const [edition] = await db
      .insert(editions)
      .values({
        id: "ed-2025",
        year: 2025,
        slug: "2025",
        name: "Pasanggiri MOKA 2025",
        lifecycle: "active",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // Level 1: Panitia Inti (Root)
    const [inti] = await db
      .insert(committeeUnits)
      .values({
        id: "unit-inti",
        editionId: edition.id,
        parentId: null,
        name: "Panitia Inti",
        displayOrder: 1,
        active: true,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // Level 2: Divisi Acara
    const [acara] = await db
      .insert(committeeUnits)
      .values({
        id: "unit-acara",
        editionId: edition.id,
        parentId: inti.id,
        name: "Divisi Acara",
        displayOrder: 2,
        active: true,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // Level 3: Seksi Perlengkapan
    const [perlengkapan] = await db
      .insert(committeeUnits)
      .values({
        id: "unit-perlengkapan",
        editionId: edition.id,
        parentId: acara.id,
        name: "Seksi Perlengkapan",
        displayOrder: 3,
        active: true,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // Level 4: Sub-seksi Panggung & Sound
    await db
      .insert(committeeUnits)
      .values({
        id: "unit-sound",
        editionId: edition.id,
        parentId: perlengkapan.id,
        name: "Sub-seksi Panggung dan Sound",
        displayOrder: 4,
        active: true,
        createdAt: now,
        updatedAt: now,
      });

    const units = await db
      .select()
      .from(committeeUnits)
      .where(eq(committeeUnits.editionId, edition.id))
      .orderBy(committeeUnits.displayOrder);

    assert.equal(units.length, 4);
    assert.equal(units[0].parentId, null);
    assert.equal(units[1].parentId, inti.id);
    assert.equal(units[2].parentId, acara.id);
    assert.equal(units[3].parentId, perlengkapan.id);
  } finally {
    client.close();
  }
});

test("committeeUnits dan assignments terisolasi per edisi (tidak tercampur antar edisi)", async () => {
  const { client, db } = await createTestDatabase();
  try {
    const now = new Date("2026-09-02T00:00:00.000Z");

    await db.insert(editions).values([
      {
        id: "ed-2024",
        year: 2024,
        slug: "2024",
        name: "Pasanggiri MOKA 2024",
        lifecycle: "archived",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "ed-2025",
        year: 2025,
        slug: "2025",
        name: "Pasanggiri MOKA 2025",
        lifecycle: "active",
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const [unit2024] = await db
      .insert(committeeUnits)
      .values({
        id: "unit-2024",
        editionId: "ed-2024",
        name: "Panitia 2024",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const [unit2025] = await db
      .insert(committeeUnits)
      .values({
        id: "unit-2025",
        editionId: "ed-2025",
        name: "Panitia 2025",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const [person] = await db
      .insert(people)
      .values({
        id: "person-1",
        name: "Ahmad Fauzi",
        slug: "ahmad-fauzi",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    await db.insert(committeeAssignments).values([
      {
        id: "assign-2024",
        editionId: "ed-2024",
        unitId: unit2024.id,
        personId: person.id,
        title: "Ketua Pelaksana 2024",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "assign-2025",
        editionId: "ed-2025",
        unitId: unit2025.id,
        personId: person.id,
        title: "Penasihat Panitia 2025",
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const assignments2024 = await db
      .select()
      .from(committeeAssignments)
      .where(eq(committeeAssignments.editionId, "ed-2024"));

    const assignments2025 = await db
      .select()
      .from(committeeAssignments)
      .where(eq(committeeAssignments.editionId, "ed-2025"));

    assert.equal(assignments2024.length, 1);
    assert.equal(assignments2024[0].title, "Ketua Pelaksana 2024");

    assert.equal(assignments2025.length, 1);
    assert.equal(assignments2025[0].title, "Penasihat Panitia 2025");
  } finally {
    client.close();
  }
});

test("people dapat dipakai ulang untuk kepengurusan organisasi dan panitia berbagai edisi", async () => {
  const { client, db } = await createTestDatabase();
  try {
    const now = new Date("2026-09-02T00:00:00.000Z");

    const [period] = await db
      .insert(organizationPeriods)
      .values({
        id: "period-1",
        label: "Periode 2024-2026",
        startYear: 2024,
        endYear: 2026,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const [orgUnit] = await db
      .insert(organizationUnits)
      .values({
        id: "org-unit-1",
        periodId: period.id,
        name: "Bidang Humas",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const [edition] = await db
      .insert(editions)
      .values({
        id: "ed-2025",
        year: 2025,
        slug: "2025",
        name: "Pasanggiri MOKA 2025",
        lifecycle: "active",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const [commUnit] = await db
      .insert(committeeUnits)
      .values({
        id: "comm-unit-1",
        editionId: edition.id,
        name: "Divisi Publikasi",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const [person] = await db
      .insert(people)
      .values({
        id: "person-siti",
        name: "Siti Nurhaliza",
        slug: "siti-nurhaliza",
        shortBio: "Pegiat budaya dan humas aktif",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // 1. Penugasan sebagai pengurus umum organisasi
    await db.insert(organizationMemberships).values({
      id: "org-mem-1",
      periodId: period.id,
      unitId: orgUnit.id,
      personId: person.id,
      title: "Kepala Bidang Humas",
      createdAt: now,
      updatedAt: now,
    });

    // 2. Penugasan sebagai panitia edisi 2025
    await db.insert(committeeAssignments).values({
      id: "comm-assign-1",
      editionId: edition.id,
      unitId: commUnit.id,
      personId: person.id,
      title: "Koordinator Publikasi dan Dokumentasi",
      createdAt: now,
      updatedAt: now,
    });

    // Verifikasi person terdaftar di kedua tempat tanpa duplikasi profil
    const orgMembers = await db
      .select()
      .from(organizationMemberships)
      .where(eq(organizationMemberships.personId, person.id));

    const commMembers = await db
      .select()
      .from(committeeAssignments)
      .where(eq(committeeAssignments.personId, person.id));

    assert.equal(orgMembers.length, 1);
    assert.equal(orgMembers[0].title, "Kepala Bidang Humas");

    assert.equal(commMembers.length, 1);
    assert.equal(commMembers[0].title, "Koordinator Publikasi dan Dokumentasi");
  } finally {
    client.close();
  }
});

test("committeeAssignments mendukung pembaruan versi optimistik dan cascading delete saat unit dihapus", async () => {
  const { client, db } = await createTestDatabase();
  try {
    const now = new Date("2026-09-02T00:00:00.000Z");

    const [edition] = await db
      .insert(editions)
      .values({
        id: "ed-2025",
        year: 2025,
        slug: "2025",
        name: "Pasanggiri MOKA 2025",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const [unit] = await db
      .insert(committeeUnits)
      .values({
        id: "unit-temp",
        editionId: edition.id,
        name: "Divisi Keamanan",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const [person] = await db
      .insert(people)
      .values({
        id: "person-budi",
        name: "Budi Santoso",
        slug: "budi-santoso",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const [assignment] = await db
      .insert(committeeAssignments)
      .values({
        id: "assign-temp",
        editionId: edition.id,
        unitId: unit.id,
        personId: person.id,
        title: "Koordinator Keamanan",
        version: 1,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    assert.equal(assignment.version, 1);

    // Update versi optimistik
    await db
      .update(committeeAssignments)
      .set({
        title: "Ketua Seksi Keamanan",
        version: 2,
        updatedAt: new Date(),
      })
      .where(and(eq(committeeAssignments.id, assignment.id), eq(committeeAssignments.version, 1)));

    const [updated] = await db
      .select()
      .from(committeeAssignments)
      .where(eq(committeeAssignments.id, assignment.id));

    assert.equal(updated.version, 2);
    assert.equal(updated.title, "Ketua Seksi Keamanan");

    // Hapus unit panitia (cascade delete assignment di SQLite)
    await db.delete(committeeUnits).where(eq(committeeUnits.id, unit.id));

    const remainingAssignments = await db
      .select()
      .from(committeeAssignments)
      .where(eq(committeeAssignments.id, assignment.id));

    assert.equal(remainingAssignments.length, 0);
  } finally {
    client.close();
  }
});

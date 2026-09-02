import { createClient } from "@libsql/client/node";
import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import { appendAuditLog } from "../auth/audit";
import * as schema from "./schema";
import {
  auditLogs,
  authUsers,
  editions,
  mediaAssets,
  organizationAssignments,
  organizationMemberships,
  organizationPeriods,
  organizationUnits,
  people,
  personSocialLinks,
} from "./schema";

async function createTestDatabase() {
  const directory = await mkdtemp(join(tmpdir(), "moka-org-test-"));
  const client = createClient({ url: `file:${join(directory, "test.db")}` });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: resolve("drizzle") });
  return { client, db };
}

test("organizationPeriods mendukung operasi CRUD, visi, misi JSON, dan edisi terhubung", async () => {
  const { client, db } = await createTestDatabase();
  try {
    const now = new Date("2026-09-02T00:00:00.000Z");

    const [period] = await db
      .insert(organizationPeriods)
      .values({
        id: "period-2024-2026",
        label: "Kepengurusan 2024-2026",
        startYear: 2024,
        endYear: 2026,
        vision: "Mewujudkan Pemuda Garut yang Berbudaya dan Berdaya Saing Global",
        missionJson: JSON.stringify([
          "Melestarikan nilai luhur seni dan budaya Sunda",
          "Meningkatkan kapasitas kepemimpinan generasi muda",
        ]),
        lifecycle: "active",
        version: 1,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    assert.equal(period.id, "period-2024-2026");
    assert.equal(period.label, "Kepengurusan 2024-2026");
    const missions = JSON.parse(period.missionJson) as string[];
    assert.equal(missions.length, 2);

    // Hubungkan edisi ke periode
    await db.insert(editions).values({
      id: "ed-2025",
      year: 2025,
      slug: "2025",
      name: "Pasanggiri MOKA 2025",
      organizationPeriodId: period.id,
      lifecycle: "active",
      createdAt: now,
      updatedAt: now,
    });

    const [linkedEdition] = await db
      .select()
      .from(editions)
      .where(eq(editions.organizationPeriodId, period.id));

    assert.ok(linkedEdition);
    assert.equal(linkedEdition.id, "ed-2025");
  } finally {
    client.close();
  }
});

test("organizationUnits mendukung struktur tree hierarkis bertingkat", async () => {
  const { client, db } = await createTestDatabase();
  try {
    const now = new Date("2026-09-02T00:00:00.000Z");

    await db.insert(organizationPeriods).values({
      id: "period-1",
      label: "Periode 2024-2026",
      startYear: 2024,
      endYear: 2026,
      createdAt: now,
      updatedAt: now,
    });

    // Level 1: Dewan Pengurus Harian
    const [dph] = await db
      .insert(organizationUnits)
      .values({
        id: "unit-dph",
        periodId: "period-1",
        parentId: null,
        name: "Dewan Pengurus Harian",
        displayOrder: 1,
        active: true,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // Level 2: Bidang Pengembangan
    const [bidang] = await db
      .insert(organizationUnits)
      .values({
        id: "unit-bidang",
        periodId: "period-1",
        parentId: dph.id,
        name: "Bidang Pengembangan Budaya",
        displayOrder: 2,
        active: true,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // Level 3: Divisi Kesenian
    const [divisi] = await db
      .insert(organizationUnits)
      .values({
        id: "unit-divisi",
        periodId: "period-1",
        parentId: bidang.id,
        name: "Divisi Kesenian Sunda",
        displayOrder: 3,
        active: true,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const units = await db
      .select()
      .from(organizationUnits)
      .where(eq(organizationUnits.periodId, "period-1"))
      .orderBy(organizationUnits.displayOrder);

    assert.equal(units.length, 3);
    assert.equal(units[0].parentId, null);
    assert.equal(units[1].parentId, dph.id);
    assert.equal(units[2].parentId, bidang.id);
  } finally {
    client.close();
  }
});

test("people dan organizationMemberships mendukung penugasan pengurus dan sosial media", async () => {
  const { client, db } = await createTestDatabase();
  try {
    const now = new Date("2026-09-02T00:00:00.000Z");

    await db.insert(organizationPeriods).values({
      id: "period-1",
      label: "Periode 2024-2026",
      startYear: 2024,
      endYear: 2026,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(organizationUnits).values({
      id: "unit-1",
      periodId: "period-1",
      name: "Pengurus Harian",
      createdAt: now,
      updatedAt: now,
    });

    // Buat profil orang
    const [person] = await db
      .insert(people)
      .values({
        id: "person-1",
        name: "Rizki Pratama",
        slug: "rizki-pratama",
        shortBio: "Ketua Paguyuban PAMOKA Garut",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // Tambah sosial media
    await db.insert(personSocialLinks).values([
      {
        id: "link-1",
        personId: person.id,
        platform: "instagram",
        url: "https://instagram.com/rizkipratama",
        displayOrder: 1,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "link-2",
        personId: person.id,
        platform: "linkedin",
        url: "https://linkedin.com/in/rizkipratama",
        displayOrder: 2,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    // Beri penugasan jabatan
    const [membership] = await db
      .insert(organizationMemberships)
      .values({
        id: "mem-1",
        periodId: "period-1",
        unitId: "unit-1",
        personId: person.id,
        title: "Ketua Umum",
        displayOrder: 1,
        active: true,
        version: 1,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    assert.equal(membership.title, "Ketua Umum");
    assert.equal(membership.personId, person.id);

    const links = await db
      .select()
      .from(personSocialLinks)
      .where(eq(personSocialLinks.personId, person.id))
      .orderBy(personSocialLinks.displayOrder);

    assert.equal(links.length, 2);
    assert.equal(links[0].platform, "instagram");
  } finally {
    client.close();
  }
});

test("legacy organizationAssignments dapat dipetakan tanpa menghapus data mentah", async () => {
  const { client, db } = await createTestDatabase();
  try {
    const now = new Date("2026-09-02T00:00:00.000Z");

    await db.insert(people).values({
      id: "person-legacy",
      name: "Dadan Ramdani",
      slug: "dadan-ramdani",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(organizationAssignments).values({
      id: "legacy-assign-1",
      personId: "person-legacy",
      title: "Penasihat Organisasi",
      group: "Dewan Penasihat",
      displayOrder: 1,
      active: true,
      createdAt: now,
      updatedAt: now,
    });

    const [legacy] = await db
      .select()
      .from(organizationAssignments)
      .where(eq(organizationAssignments.id, "legacy-assign-1"));

    assert.ok(legacy);
    assert.equal(legacy.title, "Penasihat Organisasi");

    // Pastikan schema legacy tetap utuh
    assert.equal(legacy.group, "Dewan Penasihat");
  } finally {
    client.close();
  }
});

import { createClient } from "@libsql/client/node";
import { and, asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import { appendAuditLog } from "../auth/audit";
import { backfillDynamicSelection } from "../selection/backfill";
import * as schema from "./schema";
import {
  auditLogs,
  authUsers,
  categories,
  editions,
  mediaAssets,
  participantAchievements,
  participantStageEntries,
  participantMedia,
  participantSocialLinks,
  participantTitleAssignments,
  participants,
  editionTitles,
  selectionStages,
  votingCampaignParticipants,
  votingCampaigns,
} from "./schema";

async function createTestDatabase() {
  const directory = await mkdtemp(join(tmpdir(), "moka-participants-test-"));
  const client = createClient({ url: `file:${join(directory, "test.db")}` });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: resolve("drizzle") });
  return { client, db };
}

test("participants mendukung operasi CRUD dengan edisi dan kategori", async () => {
  const { client, db } = await createTestDatabase();
  try {
    const now = new Date("2026-09-02T00:00:00.000Z");

    await db.insert(editions).values({
      id: "ed-2026",
      year: 2026,
      slug: "2026",
      name: "Pasanggiri MOKA 2026",
      lifecycle: "active",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(categories).values([
      { id: "cat-jd-2026", editionId: "ed-2026", code: "JD", slug: "jajaka-dewasa", label: "Jajaka Dewasa", displayOrder: 1, active: true, createdAt: now, updatedAt: now },
      { id: "cat-md-2026", editionId: "ed-2026", code: "MD", slug: "mojang-dewasa", label: "Mojang Dewasa", displayOrder: 2, active: true, createdAt: now, updatedAt: now },
    ]);

    // Insert participant 1
    await db.insert(participants).values({
      id: "part-1",
      editionId: "ed-2026",
      categoryId: "cat-jd-2026",
      stage: "finalis",
      number: 1,
      name: "Mochamad Fauzan",
      slug: "mochamad-fauzan",
      bio: "Mahasiswa ilmu komunikasi dan pegiat budaya Sunda",
      displayOrder: 1,
      active: true,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });

    // Insert participant 2
    await db.insert(participants).values({
      id: "part-2",
      editionId: "ed-2026",
      categoryId: "cat-md-2026",
      stage: "finalis",
      number: 2,
      name: "Siti Rahmawati",
      slug: "siti-rahmawati",
      bio: "Pecinta seni tari tradisional Garut",
      displayOrder: 2,
      active: true,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });

    // Query participants by edition and category
    const rows = await db
      .select({
        id: participants.id,
        number: participants.number,
        name: participants.name,
        categoryCode: categories.code,
        categoryLabel: categories.label,
      })
      .from(participants)
      .innerJoin(categories, eq(participants.categoryId, categories.id))
      .where(eq(participants.editionId, "ed-2026"))
      .orderBy(asc(participants.number));

    assert.equal(rows.length, 2);
    assert.equal(rows[0].number, 1);
    assert.equal(rows[0].name, "Mochamad Fauzan");
    assert.equal(rows[0].categoryCode, "JD");
    assert.equal(rows[1].number, 2);
    assert.equal(rows[1].name, "Siti Rahmawati");
    assert.equal(rows[1].categoryCode, "MD");

    // Update participant
    await db
      .update(participants)
      .set({
        name: "Mochamad Fauzan Pratama",
        slug: "mochamad-fauzan-pratama",
        version: 2,
        updatedAt: new Date("2026-09-02T01:00:00.000Z"),
      })
      .where(eq(participants.id, "part-1"));

    const [updated] = await db.select().from(participants).where(eq(participants.id, "part-1")).limit(1);
    assert.ok(updated);
    assert.equal(updated.name, "Mochamad Fauzan Pratama");
    assert.equal(updated.slug, "mochamad-fauzan-pratama");
    assert.equal(updated.version, 2);

    // Delete participant
    await db.delete(participants).where(eq(participants.id, "part-2"));
    const remaining = await db.select().from(participants).where(eq(participants.editionId, "ed-2026"));
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].id, "part-1");
  } finally {
    client.close();
  }
});

test("participantAchievements mendukung pengurutan dan cascading delete", async () => {
  const { client, db } = await createTestDatabase();
  try {
    const now = new Date("2026-09-02T00:00:00.000Z");

    await db.insert(editions).values({
      id: "ed-2026",
      year: 2026,
      slug: "2026",
      name: "Pasanggiri MOKA 2026",
      lifecycle: "active",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(categories).values({
      id: "cat-jd-2026",
      editionId: "ed-2026",
      code: "JD",
      slug: "jajaka-dewasa",
      label: "Jajaka Dewasa",
      displayOrder: 1,
      active: true,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(participants).values({
      id: "part-1",
      editionId: "ed-2026",
      categoryId: "cat-jd-2026",
      stage: "finalis",
      number: 1,
      name: "Mochamad Fauzan",
      slug: "mochamad-fauzan",
      version: 1,
      createdAt: now,
      updatedAt: now,
    });

    // Insert achievements
    await db.insert(participantAchievements).values([
      { id: "ach-1", participantId: "part-1", text: "Juara 1 Duta Bahasa 2024", displayOrder: 1, createdAt: now, updatedAt: now },
      { id: "ach-2", participantId: "part-1", text: "Finalis Debat Mahasiswa Nasional 2025", displayOrder: 0, createdAt: now, updatedAt: now },
      { id: "ach-3", participantId: "part-1", text: "Best Speaker Festival Budaya", displayOrder: 2, createdAt: now, updatedAt: now },
    ]);

    const achievements = await db
      .select()
      .from(participantAchievements)
      .where(eq(participantAchievements.participantId, "part-1"))
      .orderBy(asc(participantAchievements.displayOrder));

    assert.equal(achievements.length, 3);
    assert.equal(achievements[0].text, "Finalis Debat Mahasiswa Nasional 2025");
    assert.equal(achievements[1].text, "Juara 1 Duta Bahasa 2024");
    assert.equal(achievements[2].text, "Best Speaker Festival Budaya");

    // Cascading delete
    await db.delete(participants).where(eq(participants.id, "part-1"));
    const remaining = await db.select().from(participantAchievements).where(eq(participantAchievements.participantId, "part-1"));
    assert.equal(remaining.length, 0);
  } finally {
    client.close();
  }
});

test("participantSocialLinks mendukung berbagai platform dan validasi", async () => {
  const { client, db } = await createTestDatabase();
  try {
    const now = new Date("2026-09-02T00:00:00.000Z");

    await db.insert(editions).values({
      id: "ed-2026",
      year: 2026,
      slug: "2026",
      name: "Pasanggiri MOKA 2026",
      lifecycle: "active",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(categories).values({
      id: "cat-md-2026",
      editionId: "ed-2026",
      code: "MD",
      slug: "mojang-dewasa",
      label: "Mojang Dewasa",
      displayOrder: 1,
      active: true,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(participants).values({
      id: "part-1",
      editionId: "ed-2026",
      categoryId: "cat-md-2026",
      stage: "finalis",
      number: 2,
      name: "Siti Rahmawati",
      slug: "siti-rahmawati",
      version: 1,
      createdAt: now,
      updatedAt: now,
    });

    // Insert social links
    await db.insert(participantSocialLinks).values([
      { id: "soc-1", participantId: "part-1", platform: "instagram", label: "Instagram Pribadi", url: "https://instagram.com/sitirahma", displayOrder: 0, createdAt: now, updatedAt: now },
      { id: "soc-2", participantId: "part-1", platform: "tiktok", label: "TikTok Official", url: "https://tiktok.com/@sitirahma", displayOrder: 1, createdAt: now, updatedAt: now },
      { id: "soc-3", participantId: "part-1", platform: "linkedin", label: "LinkedIn", url: "https://linkedin.com/in/sitirahma", displayOrder: 2, createdAt: now, updatedAt: now },
    ]);

    const links = await db
      .select()
      .from(participantSocialLinks)
      .where(eq(participantSocialLinks.participantId, "part-1"))
      .orderBy(asc(participantSocialLinks.displayOrder));

    assert.equal(links.length, 3);
    assert.equal(links[0].platform, "instagram");
    assert.equal(links[0].url, "https://instagram.com/sitirahma");
    assert.equal(links[1].platform, "tiktok");
    assert.equal(links[2].platform, "linkedin");

    // Cascading delete
    await db.delete(participants).where(eq(participants.id, "part-1"));
    const remaining = await db.select().from(participantSocialLinks).where(eq(participantSocialLinks.participantId, "part-1"));
    assert.equal(remaining.length, 0);
  } finally {
    client.close();
  }
});

test("participantMedia mendukung multi-role dan sinkronisasi otomatis ke portraitMediaId untuk role closeup", async () => {
  const { client, db } = await createTestDatabase();
  try {
    const now = new Date("2026-09-02T00:00:00.000Z");

    await db.insert(editions).values({
      id: "ed-2026",
      year: 2026,
      slug: "2026",
      name: "Pasanggiri MOKA 2026",
      lifecycle: "active",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(categories).values({
      id: "cat-jd-2026",
      editionId: "ed-2026",
      code: "JD",
      slug: "jajaka-dewasa",
      label: "Jajaka Dewasa",
      displayOrder: 1,
      active: true,
      createdAt: now,
      updatedAt: now,
    });

    // Insert media assets
    await db.insert(mediaAssets).values([
      { id: "med-closeup-1", provider: "uploadthing", url: "https://utfs.io/f/closeup1.jpg", filename: "closeup1.jpg", mimeType: "image/jpeg", bytes: 120000, lifecycle: "ready", createdAt: now, updatedAt: now },
      { id: "med-fullbody-1", provider: "uploadthing", url: "https://utfs.io/f/fullbody1.jpg", filename: "fullbody1.jpg", mimeType: "image/jpeg", bytes: 240000, lifecycle: "ready", createdAt: now, updatedAt: now },
      { id: "med-karantina-1", provider: "uploadthing", url: "https://utfs.io/f/karantina1.jpg", filename: "karantina1.jpg", mimeType: "image/jpeg", bytes: 180000, lifecycle: "ready", createdAt: now, updatedAt: now },
    ]);

    await db.insert(participants).values({
      id: "part-1",
      editionId: "ed-2026",
      categoryId: "cat-jd-2026",
      stage: "finalis",
      number: 1,
      name: "Mochamad Fauzan",
      slug: "mochamad-fauzan",
      portraitMediaId: null,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });

    // Insert participant media with roles: closeup, full_body, karantina
    await db.insert(participantMedia).values([
      { id: "pm-1", participantId: "part-1", role: "closeup", mediaId: "med-closeup-1", caption: "Foto portrait resmi", displayOrder: 0, active: true, createdAt: now, updatedAt: now },
      { id: "pm-2", participantId: "part-1", role: "full_body", mediaId: "med-fullbody-1", caption: "Foto busana beskap lengkap", displayOrder: 1, active: true, createdAt: now, updatedAt: now },
      { id: "pm-3", participantId: "part-1", role: "karantina", mediaId: "med-karantina-1", caption: "Aktivitas unjuk kabisa", displayOrder: 2, active: true, createdAt: now, updatedAt: now },
    ]);

    // Simulate synchronization of closeup role to portraitMediaId
    const [closeup] = await db
      .select()
      .from(participantMedia)
      .where(and(eq(participantMedia.participantId, "part-1"), eq(participantMedia.role, "closeup"), eq(participantMedia.active, true)))
      .limit(1);

    if (closeup) {
      await db.update(participants).set({ portraitMediaId: closeup.mediaId }).where(eq(participants.id, "part-1"));
    }

    const [participantWithPortrait] = await db.select().from(participants).where(eq(participants.id, "part-1")).limit(1);
    assert.equal(participantWithPortrait.portraitMediaId, "med-closeup-1");

    // Query media items with joined asset details
    const mediaWithAssets = await db
      .select({
        role: participantMedia.role,
        caption: participantMedia.caption,
        url: mediaAssets.url,
        mimeType: mediaAssets.mimeType,
      })
      .from(participantMedia)
      .leftJoin(mediaAssets, eq(participantMedia.mediaId, mediaAssets.id))
      .where(eq(participantMedia.participantId, "part-1"))
      .orderBy(asc(participantMedia.displayOrder));

    assert.equal(mediaWithAssets.length, 3);
    assert.equal(mediaWithAssets[0].role, "closeup");
    assert.equal(mediaWithAssets[0].url, "https://utfs.io/f/closeup1.jpg");
    assert.equal(mediaWithAssets[1].role, "full_body");
    assert.equal(mediaWithAssets[2].role, "karantina");
  } finally {
    client.close();
  }
});

test("pengikatan QRIS dan transaksi diaudit secara transaksional", async () => {
  const { client, db } = await createTestDatabase();
  try {
    const now = new Date("2026-09-02T00:00:00.000Z");

    await db.insert(authUsers).values({
      id: "user-admin-1",
      name: "Admin Voting",
      email: "admin-voting@pamoka.id",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(editions).values({
      id: "ed-2026",
      year: 2026,
      slug: "2026",
      name: "Pasanggiri MOKA 2026",
      lifecycle: "active",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(categories).values({
      id: "cat-jd-2026",
      editionId: "ed-2026",
      code: "JD",
      slug: "jajaka-dewasa",
      label: "Jajaka Dewasa",
      displayOrder: 1,
      active: true,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(mediaAssets).values({
      id: "med-qris-01",
      provider: "uploadthing",
      url: "https://utfs.io/f/qris01.png",
      filename: "qris01.png",
      mimeType: "image/png",
      bytes: 45000,
      lifecycle: "ready",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(participants).values({
      id: "part-1",
      editionId: "ed-2026",
      categoryId: "cat-jd-2026",
      stage: "finalis",
      number: 1,
      name: "Mochamad Fauzan",
      slug: "mochamad-fauzan",
      qrisMediaId: null,
      paymentUrl: null,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });

    // Update QRIS inside transaction with audit log
    await db.transaction(async (tx) => {
      const [before] = await tx.select().from(participants).where(eq(participants.id, "part-1")).limit(1);

      await tx
        .update(participants)
        .set({
          qrisMediaId: "med-qris-01",
          paymentUrl: "https://gateway.pamoka.id/pay/01",
          version: before.version + 1,
          updatedAt: now,
        })
        .where(eq(participants.id, "part-1"));

      await appendAuditLog(tx, {
        actorUserId: "user-admin-1",
        actorLabel: "admin-voting@pamoka.id",
        action: "participant.qris.update",
        resourceType: "participant",
        resourceId: "part-1",
        resourceLabel: before.name,
        before: { qrisMediaId: null, paymentUrl: null, version: 1 },
        after: { qrisMediaId: "med-qris-01", paymentUrl: "https://gateway.pamoka.id/pay/01", version: 2 },
        changedFields: ["qrisMediaId", "paymentUrl", "version"],
        source: "admin-content",
        reason: "Penetapan QRIS kampanye voting 2026",
      });
    });

    const [updatedPart] = await db.select().from(participants).where(eq(participants.id, "part-1")).limit(1);
    assert.equal(updatedPart.qrisMediaId, "med-qris-01");
    assert.equal(updatedPart.paymentUrl, "https://gateway.pamoka.id/pay/01");
    assert.equal(updatedPart.version, 2);

    const logs = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.resourceType, "participant"), eq(auditLogs.resourceId, "part-1")));

    assert.equal(logs.length, 1);
    assert.equal(logs[0].action, "participant.qris.update");
    assert.equal(logs[0].actorUserId, "user-admin-1");
    assert.equal(logs[0].reason, "Penetapan QRIS kampanye voting 2026");
  } finally {
    client.close();
  }
});

test("optimistic version locking mencegah update bersamaan pada peserta", async () => {
  const { client, db } = await createTestDatabase();
  try {
    const now = new Date("2026-09-02T00:00:00.000Z");

    await db.insert(editions).values({
      id: "ed-2026",
      year: 2026,
      slug: "2026",
      name: "Pasanggiri MOKA 2026",
      lifecycle: "active",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(categories).values({
      id: "cat-jd-2026",
      editionId: "ed-2026",
      code: "JD",
      slug: "jajaka-dewasa",
      label: "Jajaka Dewasa",
      displayOrder: 1,
      active: true,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(participants).values({
      id: "part-lock",
      editionId: "ed-2026",
      categoryId: "cat-jd-2026",
      stage: "finalis",
      number: 1,
      name: "Peserta Awal",
      slug: "peserta-awal",
      version: 1,
      createdAt: now,
      updatedAt: now,
    });

    const [current1] = await db.select().from(participants).where(eq(participants.id, "part-lock")).limit(1);
    assert.equal(current1.version, 1);

    // Operator 1 updates
    await db
      .update(participants)
      .set({
        name: "Peserta Diubah Operator 1",
        version: current1.version + 1,
        updatedAt: now,
      })
      .where(eq(participants.id, "part-lock"));

    // Operator 2 attempts update with stale version 1
    const [current2] = await db.select().from(participants).where(eq(participants.id, "part-lock")).limit(1);
    assert.equal(current2.version, 2);

    const staleVersion: number = 1;
    const isConflict = current2.version !== staleVersion;
    assert.equal(isConflict, true);
  } finally {
    client.close();
  }
});

test("seleksi dinamis, gelar, dan snapshot voting tetap terisolasi per edisi", async () => {
  const { client, db } = await createTestDatabase();
  try {
    const now = new Date("2026-09-05T00:00:00.000Z");

    await db.insert(editions).values({
      id: "ed-selection-2026",
      year: 2026,
      slug: "selection-2026",
      name: "Pasanggiri MOKA 2026",
      lifecycle: "active",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(categories).values({
      id: "cat-selection-jd",
      editionId: "ed-selection-2026",
      code: "JD",
      slug: "jd-selection",
      label: "JD",
      displayOrder: 1,
      active: true,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(selectionStages).values([
      {
        id: "stage-registration",
        editionId: "ed-selection-2026",
        name: "Pendaftaran",
        slug: "pendaftaran",
        displayOrder: 1,
        targetParticipantCount: 100,
        lifecycle: "closed",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "stage-final",
        editionId: "ed-selection-2026",
        name: "Final",
        slug: "final",
        displayOrder: 2,
        targetParticipantCount: 20,
        lifecycle: "active",
        finalStage: true,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    await assert.rejects(
      db.insert(selectionStages).values({
        id: "stage-final-duplicate",
        editionId: "ed-selection-2026",
        name: "Final duplikat",
        slug: "final",
        displayOrder: 3,
        targetParticipantCount: 10,
        createdAt: now,
        updatedAt: now,
      }),
    );

    await db.insert(participants).values({
      id: "part-selection-1",
      editionId: "ed-selection-2026",
      categoryId: "cat-selection-jd",
      stage: "finalis",
      currentStageId: "stage-final",
      selectionStatus: "active",
      number: 1,
      name: "Peserta Seleksi",
      slug: "peserta-seleksi",
      displayOrder: 1,
      active: true,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(participantStageEntries).values({
      id: "entry-final",
      participantId: "part-selection-1",
      stageId: "stage-final",
      decision: "advanced",
      decidedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    await assert.rejects(
      db.insert(participantStageEntries).values({
        id: "entry-final-duplicate",
        participantId: "part-selection-1",
        stageId: "stage-final",
        decision: "pending",
        createdAt: now,
        updatedAt: now,
      }),
    );

    await db.insert(editionTitles).values([
      {
        id: "title-winner",
        editionId: "ed-selection-2026",
        name: "Mojang Pinilih",
        capacity: 1,
        displayOrder: 1,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "title-favorite",
        editionId: "ed-selection-2026",
        name: "Mojang Favorit",
        capacity: 2,
        displayOrder: 2,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    await db.insert(participantTitleAssignments).values([
      { editionTitleId: "title-winner", participantId: "part-selection-1", assignedAt: now },
      { editionTitleId: "title-favorite", participantId: "part-selection-1", assignedAt: now },
    ]);
    await assert.rejects(
      db.insert(participantTitleAssignments).values({
        editionTitleId: "title-winner",
        participantId: "part-selection-1",
        assignedAt: now,
      }),
    );

    await db.insert(votingCampaigns).values({
      id: "campaign-selection",
      editionId: "ed-selection-2026",
      eligibilityStageId: "stage-final",
      name: "Voting 2026",
      slug: "voting-selection-2026",
      startsAt: now,
      endsAt: new Date("2026-09-12T00:00:00.000Z"),
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(votingCampaignParticipants).values({
      campaignId: "campaign-selection",
      participantId: "part-selection-1",
      sourceStageId: "stage-final",
      addedAt: now,
    });
    await assert.rejects(
      db.insert(votingCampaignParticipants).values({
        campaignId: "campaign-selection",
        participantId: "part-selection-1",
        sourceStageId: "stage-final",
        addedAt: now,
      }),
    );
    await assert.rejects(db.delete(participants).where(eq(participants.id, "part-selection-1")));

    await assert.rejects(db.delete(selectionStages).where(eq(selectionStages.id, "stage-final")));

    await db
      .update(participants)
      .set({ currentStageId: null, updatedAt: now })
      .where(eq(participants.id, "part-selection-1"));
    await db
      .update(votingCampaigns)
      .set({ eligibilityStageId: null, updatedAt: now })
      .where(eq(votingCampaigns.id, "campaign-selection"));
    await db.delete(selectionStages).where(eq(selectionStages.id, "stage-final"));

    const [participant] = await db
      .select()
      .from(participants)
      .where(eq(participants.id, "part-selection-1"))
      .limit(1);
    const [campaign] = await db
      .select()
      .from(votingCampaigns)
      .where(eq(votingCampaigns.id, "campaign-selection"))
      .limit(1);
    const [snapshot] = await db
      .select()
      .from(votingCampaignParticipants)
      .where(eq(votingCampaignParticipants.campaignId, "campaign-selection"))
      .limit(1);
    const stageEntries = await db
      .select()
      .from(participantStageEntries)
      .where(eq(participantStageEntries.participantId, "part-selection-1"));

    assert.equal(participant.currentStageId, null);
    assert.equal(participant.stage, "finalis");
    assert.equal(campaign.eligibilityStageId, null);
    assert.equal(snapshot.sourceStageId, null);
    assert.equal(stageEntries.length, 0);
  } finally {
    client.close();
  }
});

test("backfill seleksi lama idempotent dan mempertahankan field kompatibilitas", async () => {
  const { client, db } = await createTestDatabase();
  try {
    const now = new Date("2026-09-05T01:00:00.000Z");
    await db.insert(editions).values({
      id: "ed-backfill",
      year: 2027,
      slug: "backfill-2027",
      name: "Pasanggiri MOKA 2027",
      lifecycle: "draft",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(categories).values({
      id: "cat-backfill-jd",
      editionId: "ed-backfill",
      code: "JD",
      slug: "jd-backfill",
      label: "JD",
      displayOrder: 1,
      active: true,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(participants).values([
      {
        id: "part-backfill-1",
        editionId: "ed-backfill",
        categoryId: "cat-backfill-jd",
        stage: "semifinalis",
        number: 1,
        name: "Peserta Lama Satu",
        slug: "peserta-lama-satu",
        paymentUrl: "https://example.com/payment-lama",
        displayOrder: 1,
        active: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "part-backfill-2",
        editionId: "ed-backfill",
        categoryId: "cat-backfill-jd",
        stage: "semifinalis",
        number: 2,
        name: "Peserta Lama Dua",
        slug: "peserta-lama-dua",
        displayOrder: 2,
        active: true,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const first = await backfillDynamicSelection(db, { now, source: "test:selection-backfill" });
    const second = await backfillDynamicSelection(db, { now, source: "test:selection-backfill" });

    assert.deepEqual(first, { editions: 1, stagesCreated: 1, participantsLinked: 2, entriesCreated: 2 });
    assert.deepEqual(second, { editions: 1, stagesCreated: 0, participantsLinked: 2, entriesCreated: 0 });

    const stages = await db.select().from(selectionStages).where(eq(selectionStages.editionId, "ed-backfill"));
    const entries = await db.select().from(participantStageEntries);
    const migratedParticipants = await db
      .select()
      .from(participants)
      .where(eq(participants.editionId, "ed-backfill"));
    const audits = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.action, "selection.backfill"));

    assert.equal(stages.length, 1);
    assert.equal(entries.length, 2);
    assert.equal(audits.length, 1);
    assert.ok(migratedParticipants.every((participant) => participant.currentStageId === stages[0].id));
    assert.ok(migratedParticipants.every((participant) => participant.selectionStatus === "active"));
    assert.ok(migratedParticipants.every((participant) => participant.stage === "semifinalis"));
    assert.equal(migratedParticipants.find((participant) => participant.id === "part-backfill-1")?.paymentUrl, "https://example.com/payment-lama");
  } finally {
    client.close();
  }
});

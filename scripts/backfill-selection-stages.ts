import "dotenv/config";

import { createClient } from "@libsql/client/node";
import { drizzle } from "drizzle-orm/libsql";

import * as schema from "@/server/db/schema";
import { backfillDynamicSelection } from "@/server/selection/backfill";

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) throw new Error("Turso env belum lengkap");

  const host = new URL(url).host;
  const confirmationIndex = process.argv.indexOf("--confirm-host");
  const confirmation = confirmationIndex >= 0 ? process.argv[confirmationIndex + 1] : undefined;
  if (confirmation !== host) throw new Error(`Target harus dikonfirmasi dengan --confirm-host ${host}`);

  const client = createClient({ url, authToken });
  try {
    const result = await backfillDynamicSelection(drizzle(client, { schema }), {
      now: new Date(),
      source: `operator:selection-backfill:${host}`,
    });
    console.log(JSON.stringify({ target: host, ...result }, null, 2));
  } finally {
    client.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Backfill seleksi gagal");
  process.exitCode = 1;
});

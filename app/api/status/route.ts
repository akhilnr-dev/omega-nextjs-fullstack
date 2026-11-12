import { NextResponse } from "next/server";
import { schemaStatus } from "@/lib/schemaStatus";

export const dynamic = "force-dynamic";

/**
 * Machine-readable health and migration state, for integration tests:
 *   GET /api/status -> { configured, backend, objects[], migrationsApplied[], allMigrationsApplied, ... }
 */
export async function GET() {
  const status = await schemaStatus();
  return NextResponse.json(status, { headers: { "cache-control": "no-store" } });
}

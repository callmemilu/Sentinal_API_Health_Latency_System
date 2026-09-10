import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // 1. Verify cron authorization
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 2. Define retention window (e.g., delete telemetry older than 14 days)
    const retentionDays = 14;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffIso = cutoffDate.toISOString();

    // 3. Delete expired ping_logs in batches
    const { count, error } = await supabaseAdmin
      .from("ping_logs")
      .delete({ count: "exact" })
      .lt("created_at", cutoffIso);

    if (error) {
      console.error("Database retention cleanup error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      deleted_rows: count || 0,
      cutoff_date: cutoffIso,
      retention_days: retentionDays,
      executed_at: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Cleanup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
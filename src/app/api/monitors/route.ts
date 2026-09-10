import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

function sanitizeHeaders(input: unknown): Record<string, string> {
  if (!input) return {};
  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input);
      return typeof parsed === "object" && parsed !== null ? parsed : {};
    } catch {
      return {};
    }
  }
  if (typeof input === "object" && input !== null) {
    return input as Record<string, string>;
  }
  return {};
}

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth();
    const body = await req.json();

    const {
      name,
      url,
      method = "GET",
      timeout_ms = 5000,
      headers = {},
      discord_webhook_url,
      notify_email,
      consecutive_failures_threshold = 2,
      user_id,
    } = body;

    const resolvedUserId = clerkUserId || user_id;

    if (!resolvedUserId) {
      return NextResponse.json(
        { error: "Unauthorized: Active user session required to create monitors." },
        { status: 401 }
      );
    }

    if (!name || !url) {
      return NextResponse.json(
        { error: "Endpoint name and target URL are required." },
        { status: 400 }
      );
    }

    // 1. Insert monitor with user_id and custom headers
    const { data: monitor, error: monitorError } = await supabaseAdmin
      .from("monitors")
      .insert({
        user_id: resolvedUserId,
        name,
        url: url.trim(),
        method,
        timeout_ms: Number(timeout_ms),
        headers: sanitizeHeaders(headers),
        status: "Operational",
      })
      .select()
      .single();

    if (monitorError || !monitor) {
      return NextResponse.json({ error: monitorError?.message }, { status: 500 });
    }

    // 2. Insert alert settings if notification targets were configured
    if (discord_webhook_url || notify_email) {
      const { error: alertError } = await supabaseAdmin
        .from("alert_settings")
        .insert({
          monitor_id: monitor.id,
          discord_webhook_url: discord_webhook_url || null,
          notify_email: notify_email || null,
          consecutive_failures_threshold: Number(consecutive_failures_threshold) || 2,
        });

      if (alertError) {
        console.error("Failed to insert alert settings:", alertError.message);
      }
    }

    return NextResponse.json({ success: true, monitor }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      id,
      name,
      url,
      method = "GET",
      timeout_ms = 5000,
      headers,
      discord_webhook_url,
      notify_email,
      consecutive_failures_threshold = 2,
    } = body;

    if (!id || !name || !url) {
      return NextResponse.json(
        { error: "Monitor ID, name, and URL are required." },
        { status: 400 }
      );
    }

    // Build update object
    const updatePayload: Record<string, unknown> = {
      name,
      url: url.trim(),
      method,
      timeout_ms: Number(timeout_ms),
    };

    if (headers !== undefined) {
      updatePayload.headers = sanitizeHeaders(headers);
    }

    // 1. Update the monitor row
    const { error: monitorError } = await supabaseAdmin
      .from("monitors")
      .update(updatePayload)
      .eq("id", id);

    if (monitorError) {
      return NextResponse.json({ error: monitorError.message }, { status: 500 });
    }

    // 2. Upsert alert settings
    const { error: alertError } = await supabaseAdmin
      .from("alert_settings")
      .upsert(
        {
          monitor_id: id,
          discord_webhook_url: discord_webhook_url?.trim() || null,
          notify_email: notify_email?.trim() || null,
          consecutive_failures_threshold: Number(consecutive_failures_threshold) || 2,
        },
        { onConflict: "monitor_id" }
      );

    if (alertError) {
      console.error("Failed to update alert settings:", alertError.message);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update monitor";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/insforge"; // Using the app's db utility pattern
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { user_id, session_id, signals } = body;

    if (!session_id || !signals || !Array.isArray(signals)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // SECURITY: Validate JWT token from Authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid authorization" },
        { status: 401 }
      );
    }

    const token = authHeader.split("Bearer ")[1];
    const supabase = getSupabaseAdmin();

    // Verify the token is valid by checking the user
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData?.user) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    // Use the authenticated user's ID rather than trusting client-provided user_id
    const verifiedUserId = userData.user.id;

    // Rate limit: max 100 signals per batch
    if (signals.length > 100) {
      return NextResponse.json(
        { error: "Too many signals in batch (max 100)" },
        { status: 400 }
      );
    }

    // Format signals for database insertion
    const records = signals.map((sig: any) => ({
      user_id: verifiedUserId,
      session_id,
      signal_type: sig.signal_type,
      payload: sig.payload,
      created_at: new Date(sig.timestamp || Date.now()).toISOString(),
    }));

    // Insert signals into the user_signals table
    const { error: insertError } = await supabase
      .from("user_signals")
      .insert(records);

    if (insertError) {
      console.error("Failed to insert signals:", insertError.message);
      // Don't fail the request — signal collection should be best-effort
      return NextResponse.json({ success: true, count: 0, warning: "Storage unavailable" });
    }

    return NextResponse.json({ success: true, count: records.length });
  } catch (err: any) {
    console.error("Failed to process batched signals:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

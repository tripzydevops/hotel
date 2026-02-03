import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/utils/supabase/server";
import DashboardClient from "@/components/dashboard/DashboardClient";
import { DashboardData, UserSettings, HotelWithPrice } from "@/types";

export default async function Dashboard() {
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  const userId = session.user.id;

  try {
    // CRITICAL: Use Admin Client to bypass RLS and avoid API Loopback failures
    const adminSupabase = createAdminClient();

    // --- 1. Fetch Profile (Direct) ---
    // Strategy: Try 'profiles' -> Fallback to 'user_profiles'
    let finalProfile = null;
    let profileSource = "none";

    // Try profiles
    const profileRes = await adminSupabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (profileRes.data) {
      finalProfile = profileRes.data;
      profileSource = "profiles";
    } else {
      // Fallback
      const userProfileRes = await adminSupabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", userId)
        .single();
      if (userProfileRes.data) {
        finalProfile = userProfileRes.data;
        profileSource = "user_profiles";
      }
    }

    if (!finalProfile) {
      finalProfile = {
        id: userId,
        email: session.user.email,
        plan_type: "free",
      };
      profileSource = "fallback";
    }

    // --- 2. Fetch Settings (Direct) ---
    const settingsRes = await adminSupabase
      .from("settings")
      .select("*")
      .eq("user_id", userId)
      .single();

    const settings: UserSettings | undefined = settingsRes.data || undefined;

    // --- 3. Fetch Dashboard Data (Direct) ---
    // Fetch Hotels
    const hotelsRes = await adminSupabase
      .from("hotels")
      .select("*")
      .eq("user_id", userId);

    const hotels = hotelsRes.data || [];

    // Enrich with Price Info (Latest Price Log)
    // Optimization: filtering logically in JS for MVP
    const hotelsWithPrice = await Promise.all(
      hotels.map(async (h) => {
        const pricesRes = await adminSupabase
          .from("price_logs")
          .select("*")
          .eq("hotel_id", h.id)
          .order("recorded_at", { ascending: false })
          .limit(2); // Get current and previous

        const prices = pricesRes.data || [];
        const current = prices[0];
        const prev = prices[1];

        const enriched: HotelWithPrice = {
          ...h,
          price_history: prices, // Simple history
          price_info: current
            ? {
                current_price: current.price,
                currency: current.currency,
                recorded_at: current.recorded_at,
                trend: !prev
                  ? "stable"
                  : current.price < prev.price
                    ? "down"
                    : current.price > prev.price
                      ? "up"
                      : "stable",
                change_percent: !prev
                  ? 0
                  : ((current.price - prev.price) / prev.price) * 100,
                check_in: current.check_in_date,
                vendor: current.vendor,
                adults: 2,
              }
            : undefined,
        };
        return enriched;
      }),
    );

    const targetHotel = hotelsWithPrice.find((h) => h.is_target_hotel);
    const competitors = hotelsWithPrice.filter((h) => !h.is_target_hotel);

    // Fetch Other Dashboard Bits
    const [recentSearchesRes, scanHistoryRes, sessionsRes, alertsRes] =
      await Promise.all([
        adminSupabase
          .from("query_logs")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(5),
        adminSupabase
          .from("query_logs")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(10), // scan_history same table? Or different? Assuming same for now or separate logic.
        adminSupabase
          .from("scan_sessions")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(5),
        adminSupabase
          .from("alerts")
          .select("id")
          .eq("user_id", userId)
          .eq("is_read", false),
      ]);

    const dashboardData: DashboardData = {
      target_hotel: targetHotel,
      competitors: competitors,
      recent_searches: recentSearchesRes.data || [],
      scan_history: scanHistoryRes.data || [],
      recent_sessions: sessionsRes.data || [],
      unread_alerts_count: alertsRes.data?.length || 0,
      last_updated: new Date().toISOString(),
    };

    // DEBUG Logic
    const isFree = finalProfile.plan_type === "free";
    const isError = false; // We are in try block

    return (
      <div className="relative">
        {/* Only show debug if actually free/broken or if specific env var is set to force it */}
        {(isFree || !process.env.SUPABASE_SERVICE_ROLE_KEY) && (
          <div className="bg-amber-900/80 text-amber-200 p-1 text-[10px] border-b border-amber-700 font-mono text-center">
            [DIRECT DB] Plan: {finalProfile.plan_type} | Source: {profileSource}{" "}
            | Hotels: {hotels.length}
          </div>
        )}
        <DashboardClient
          userId={userId}
          initialData={dashboardData}
          initialSettings={settings}
          initialProfile={finalProfile}
        />
      </div>
    );
  } catch (error: any) {
    console.error("Server-side Direct DB error:", error);
    // Return a minimal profile so the user still looks logged in
    const minimalProfile = {
      id: userId,
      email: session.user.email,
      full_name: "User",
      plan_type: "free",
    };

    return (
      <div className="relative">
        <div className="bg-red-900/50 text-red-200 p-4 text-sm border-b border-red-700 font-mono">
          <strong>CRITICAL ERROR (Direct DB):</strong>{" "}
          {String(error?.message || error)} <br />
          ServiceKey:{" "}
          {!!process.env.SUPABASE_SERVICE_ROLE_KEY ? "PRESENT" : "MISSING"}
        </div>
        <DashboardClient
          userId={userId}
          initialData={null}
          initialSettings={undefined}
          initialProfile={minimalProfile}
        />
      </div>
    );
  }
}

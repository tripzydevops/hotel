import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import DashboardClient from "@/components/dashboard/DashboardClient";
import {
  getDashboardServer,
  getSettingsServer,
  getProfileServer,
} from "@/lib/data-access";
import { createAdminClient } from "@/utils/supabase/server";

export default async function Dashboard() {
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  const userId = session.user.id;
  const token = session.access_token;

  try {
    // Parallel data fetching for maximum performance
    const [dashboardData, settings] = await Promise.all([
      getDashboardServer(userId, token),
      getSettingsServer(userId, token),
    ]);

    // DIRECT DB ACCESS: optimization for Vercel loading
    // Strategy: Try 'profiles' (newer schema) -> Fallback to 'user_profiles' (legacy schema)
    // CRITICAL: Use Admin Client to bypass potential RLS issues on legacy tables
    const adminSupabase = createAdminClient();
    let finalProfile = null;
    let userProfileData = null; // Defined here for debug scope
    let profileData = null;

    // 1. Try profiles
    const profileRes = await adminSupabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    profileData = profileRes.data;

    if (profileData) {
      finalProfile = profileData;
    } else {
      // 2. Fallback to user_profiles
      console.log("Dashboard: Fallback to user_profiles (Admin Fetch)");
      const userProfileRes = await adminSupabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", userId)
        .single();
      userProfileData = userProfileRes.data;

      finalProfile = userProfileData;
    }

    // 3. Last Resort Fallback
    if (!finalProfile) {
      finalProfile = {
        id: userId,
        email: session.user.email,
        full_name: session.user.user_metadata?.full_name || "User",
        plan_type: "free",
      };
    }

    // DEBUG: Inject debug info into the response to visualize in frontend
    // We'll wrap the DashboardClient in a div showing the debug info if we are in this degraded state (Free plan but shouldn't be?)
    // Or just pass it as a prop? DashboardClient doesn't support it.
    // Let's modify the return to include a debug banner.
    const isServiceKeySet = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    const isFree = finalProfile?.plan_type === "free";

    return (
      <div className="relative">
        {true && (
          <div className="bg-red-900/50 text-red-200 p-2 text-xs border-b border-red-700 font-mono">
            [DEBUG MODE] Plan: {finalProfile.plan_type} | ServiceKey:{" "}
            {isServiceKeySet ? "PRESENT" : "MISSING"} | UserID: {userId} |
            Table:{" "}
            {finalProfile === profileData
              ? "profiles"
              : finalProfile === userProfileData
                ? "user_profiles"
                : "FALLBACK"}
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
    console.error("Server-side fetch error:", error);
    // Return a minimal profile so the user still looks logged in
    const minimalProfile = {
      id: userId,
      email: session.user.email,
      full_name: session.user.user_metadata?.full_name || "User",
      plan_type: "free", // Default fallback
    };

    return (
      <DashboardClient
        userId={userId}
        initialData={null}
        initialSettings={undefined}
        initialProfile={minimalProfile}
      />
    );
  }
}

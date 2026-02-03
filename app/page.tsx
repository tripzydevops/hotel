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

    // 1. Try profiles
    const { data: profileData } = await adminSupabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (profileData) {
      finalProfile = profileData;
    } else {
      // 2. Fallback to user_profiles
      console.log("Dashboard: Fallback to user_profiles (Admin Fetch)");
      const { data: userProfileData } = await adminSupabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", userId)
        .single();
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

    return (
      <DashboardClient
        userId={userId}
        initialData={dashboardData}
        initialSettings={settings}
        initialProfile={finalProfile}
      />
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

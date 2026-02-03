import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import DashboardClient from "@/components/dashboard/DashboardClient";
import {
  getDashboardServer,
  getSettingsServer,
  getProfileServer,
} from "@/lib/data-access";

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
    const [dashboardData, settings, profile] = await Promise.all([
      getDashboardServer(userId, token),
      getSettingsServer(userId, token),
      getProfileServer(userId, token),
    ]);

    return (
      <DashboardClient
        userId={userId}
        initialData={dashboardData}
        initialSettings={settings}
        initialProfile={profile}
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

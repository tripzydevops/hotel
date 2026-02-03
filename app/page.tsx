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
  } catch (error) {
    console.error("Server-side fetch error:", error);
    // In case of critical failure, we can still load the client shell
    // The client will attempt to re-fetch or show error
    // But ideally we redirect to an error page or show a fallback
    return (
      <DashboardClient
        userId={userId}
        initialData={null}
        initialSettings={undefined}
        initialProfile={null}
      />
    );
  }
}

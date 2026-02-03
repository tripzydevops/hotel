import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getProfileServer } from "@/lib/data-access";
import AnalysisClient from "@/components/analysis/AnalysisClient";

export default async function AnalysisPage() {
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  const userId = session.user.id;
  const token = session.access_token;

  // We only need profile for the header for now
  let profile = null;
  try {
    profile = await getProfileServer(userId, token);
  } catch (error) {
    console.error("Failed to fetch profile for analysis page:", error);
    // Optional: could redirect to login if we suspect token issues
    // redirect("/login");
  }

  return <AnalysisClient userId={userId} initialProfile={profile} />;
}

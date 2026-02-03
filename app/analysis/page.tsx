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
    // DIRECT DB ACCESS: optimization for Vercel loading
    // 1. Try profiles
    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (profileData) {
      profile = profileData;
    } else {
      // 2. Fallback
      const { data: userProfileData } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", userId)
        .single();
      profile = userProfileData;
    }
  } catch (error) {
    console.error("Failed to fetch profile for analysis page:", error);
    // Fallback minimal profile to ensure header stays logged in
    profile = {
      id: userId,
      email: session.user.email,
      full_name: session.user.user_metadata?.full_name || "User",
      plan_type: "free", // Default fallback, but keeps user "logged in" in UI
    };
  }

  return <AnalysisClient userId={userId} initialProfile={profile} />;
}

import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/utils/supabase/server";
import { getProfileServer } from "@/lib/data-access";
import ReportsClient from "@/components/reports/ReportsClient";

export default async function ReportsPage() {
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  const userId = session.user.id;

  try {
    // DIRECT DB ACCESS: optimization for Vercel loading
    // Strategy: Try 'profiles' -> Fallback to 'user_profiles' (legacy)
    // CRITICAL: Use Admin Client to bypass RLS
    const adminSupabase = createAdminClient();
    let profile = null;

    // 1. Try profiles
    const { data: profileData } = await adminSupabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (profileData) {
      profile = profileData;
    } else {
      // 2. Fallback to user_profiles
      const { data: userProfileData } = await adminSupabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", userId)
        .single();
      profile = userProfileData;
    }

    // 3. Critical Fallback
    if (!profile) {
      profile = {
        id: userId,
        email: session.user.email,
        full_name: session.user.user_metadata?.full_name || "User",
        plan_type: "free",
      };
    }

    return <ReportsClient userId={userId} initialProfile={profile} />;
  } catch (error) {
    console.error("Failed to fetch profile for reports:", error);
    // Fallback minimal profile to allow page render
    const fallbackProfile = {
      id: userId,
      email: session.user.email,
      full_name: session.user.user_metadata?.full_name || "User",
      plan_type: "free",
    };
    return <ReportsClient userId={userId} initialProfile={fallbackProfile} />;
  }
}

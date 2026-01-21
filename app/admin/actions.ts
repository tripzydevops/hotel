"use server";

import { createAdminClient } from "@/utils/supabase/admin";
import { revalidatePath } from "next/cache";

export async function createUser(formData: FormData) {
  const supabase = createAdminClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const companyName = formData.get("companyName") as string;

  // 1. Create Auth User
  const { data: user, error: createError } =
    await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm for B2B
    });

  if (createError) {
    return { error: createError.message };
  }

  if (!user.user) {
    return { error: "Failed to create user object" };
  }

  // 2. Insert into Settings (to initialize their profile/company)
  // We repurpose 'user_id' as the link.
  // Note: RLS might block this if we were using client, but we are using admin client.
  const { error: settingsError } = await supabase.from("settings").insert({
    user_id: user.user.id,
    notification_email: email,
    check_frequency_minutes: 144, // Default to 4 hours
    // company_name: companyName (If we had this column, we'd add it)
  });

  if (settingsError) {
    // Optional: Delete auth user if settings fail to keep clean state
    // await supabase.auth.admin.deleteUser(user.user.id);
    return {
      error:
        "User created but settings initialization failed: " +
        settingsError.message,
    };
  }

  revalidatePath("/admin");
  return { success: `User ${email} created successfully!` };
}

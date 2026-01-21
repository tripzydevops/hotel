import { createAdminClient } from "@/utils/supabase/admin";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import Header from "@/components/Header";
import CreateUserForm from "./CreateUserForm";

export default async function AdminPage() {
  // 1. Verify Access (Double check server-side)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.email !== "tripzydevops@gmail.com") {
    redirect("/");
  }

  // 2. Fetch Users (using Admin Client)
  const adminDb = createAdminClient();
  // Fetch users from auth.users is tricky via simple client, usually we check 'settings' table
  // Since 'settings' has a row for every active user B2B
  const { data: users, error } = await adminDb
    .from("settings")
    .select(
      "user_id, notification_email, check_frequency_minutes, notifications_enabled, created_at",
    );

  return (
    <div className="min-h-screen pb-12">
      <Header />

      <main className="pt-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-white">Admin Console</h1>
          <span className="bg-red-500/20 text-red-300 px-3 py-1 rounded-full text-xs font-mono">
            SUPER ADMIN ACCESS
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Create User */}
          <div className="lg:col-span-1">
            <CreateUserForm />
          </div>

          {/* Right Column: User List */}
          <div className="lg:col-span-2">
            <div className="bg-[var(--deep-ocean-card)] rounded-xl border border-white/10 overflow-hidden">
              <div className="p-6 border-b border-white/10 flex justify-between items-center">
                <h2 className="text-xl font-bold text-white">Active Clients</h2>
                <span className="text-[var(--text-secondary)] text-sm">
                  {users?.length || 0} Total
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-[var(--text-muted)] bg-white/5 uppercase">
                    <tr>
                      <th className="px-6 py-3">Email</th>
                      <th className="px-6 py-3">Frequency</th>
                      <th className="px-6 py-3">Alerts</th>
                      <th className="px-6 py-3">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {users?.map((u) => (
                      <tr
                        key={u.user_id}
                        className="hover:bg-white/5 transition-colors"
                      >
                        <td className="px-6 py-4 font-medium text-white">
                          {u.notification_email}
                        </td>
                        <td className="px-6 py-4 text-[var(--text-secondary)]">
                          {u.check_frequency_minutes === 0
                            ? "Manual"
                            : `${u.check_frequency_minutes / 60}h`}
                        </td>
                        <td className="px-6 py-4">
                          {u.notifications_enabled ? (
                            <span className="text-green-400">On</span>
                          ) : (
                            <span className="text-red-400">Off</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-[var(--text-secondary)]">
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                    {(!users || users.length === 0) && (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-6 py-8 text-center text-[var(--text-muted)]"
                        >
                          No users found. Create one!
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

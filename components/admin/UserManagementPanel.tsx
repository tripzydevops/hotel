"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  CheckCircle2,
  Loader2,
  Eye,
  UserPlus,
  Mail,
  Lock,
} from "lucide-react";
import { api } from "@/lib/api";
import { AdminUser, AdminUserUpdate } from "@/types";
import { useToast } from "@/components/ui/ToastContext";
import { motion, AnimatePresence } from "framer-motion";

const UserManagementPanel = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [userSuccess, setUserSuccess] = useState(false);

  // Form States
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPass, setNewUserPass] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserPlan, setNewUserPlan] = useState<AdminUser["plan_type"]>("trial");
  const [newUserStatus, setNewUserStatus] = useState<AdminUser["subscription_status"]>("trial");

  // Edit User State
  const [userToEdit, setUserToEdit] = useState<AdminUser | null>(null);
  const [editUserForm, setEditUserForm] = useState({
    email: "",
    display_name: "",
    password: "",
    company_name: "",
    job_title: "",
    phone: "",
    timezone: "UTC",
    check_frequency_minutes: 0,
    plan_type: "trial" as AdminUser["plan_type"],
    subscription_status: "trial" as AdminUser["subscription_status"],
  });
  const [userSaveLoading, setUserSaveLoading] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getAdminUsers();
      setUsers(data);
    } catch (err: unknown) {
      toast.error(
        "An error occurred: " +
        (err instanceof Error ? err.message : String(err)),
      );
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (userToEdit) {
      setEditUserForm({
        email: userToEdit.email || "",
        display_name: userToEdit.display_name || "",
        password: "",
        company_name: userToEdit.company_name || "",
        job_title: userToEdit.job_title || "",
        phone: userToEdit.phone || "",
        timezone: userToEdit.timezone || "UTC",
        check_frequency_minutes: userToEdit.scan_frequency_minutes || 0,
        plan_type: userToEdit.plan_type || "trial",
        subscription_status: userToEdit.subscription_status || "trial",
      });
    }
  }, [userToEdit]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createAdminUser({
        email: newUserEmail,
        password: newUserPass,
        display_name: newUserName || undefined,
        plan_type: newUserPlan,
        subscription_status: newUserStatus,
      });
      setUserSuccess(true);
      setNewUserEmail("");
      setNewUserPass("");
      setNewUserName("");
      setNewUserPlan("trial");
      setNewUserStatus("trial");
      loadUsers();
      setTimeout(() => setUserSuccess(false), 3000);
      toast.success("User created successfully");
    } catch (err: unknown) {
      toast.error(
        "An error occurred: " +
        (err instanceof Error ? err.message : String(err)),
      );
    }
  };

  const handleUpdateUser = async () => {
    if (!userToEdit) return;
    setUserSaveLoading(true);
    try {
      await api.updateAdminUser(userToEdit.id, {
        email: editUserForm.email,
        display_name: editUserForm.display_name,
        password: editUserForm.password || undefined,
        plan_type: editUserForm.plan_type as AdminUserUpdate["plan_type"],
        subscription_status:
          editUserForm.subscription_status as AdminUserUpdate["subscription_status"],
        check_frequency_minutes: editUserForm.check_frequency_minutes,
      });
      setUserToEdit(null);
      loadUsers();
      toast.success("User updated");
    } catch (err: unknown) {
      toast.error(
        "An error occurred: " +
        (err instanceof Error ? err.message : String(err)),
      );
    } finally {
      setUserSaveLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (
      !confirm(
        "Are you sure? This will delete ALL user data including hotels and logs.",
      )
    )
      return;
    try {
      await api.deleteAdminUser(userId);
      loadUsers();
      toast.success("User deleted");
    } catch (err: unknown) {
      toast.error(
        "An error occurred: " +
        (err instanceof Error ? err.message : String(err)),
      );
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      {/* Add User Form */}
      <div className="glass-card p-8 border border-white/5 relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-1 h-full bg-[var(--soft-gold)]/50 opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--soft-gold)]/10 border border-[var(--soft-gold)]/20 flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-[var(--soft-gold)]" />
            </div>
            <h3 className="text-sm font-black text-white uppercase tracking-[0.2em]">
              Provision New User
            </h3>
          </div>
          <AnimatePresence>
            {userSuccess && (
              <motion.span
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="text-[var(--optimal-green)] text-[10px] font-black uppercase tracking-widest flex items-center bg-[var(--optimal-green)]/10 px-3 py-1.5 rounded-lg border border-[var(--optimal-green)]/20 shadow-lg shadow-[var(--optimal-green)]/10"
              >
                <CheckCircle2 className="w-3 h-3 mr-2" /> Vector Link
                Established
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <form
          onSubmit={handleCreateUser}
          className="grid grid-cols-1 md:grid-cols-4 gap-6"
        >
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] ml-1 flex items-center gap-1.5">
              <Mail className="w-3 h-3" /> Email Address
            </label>
            <input
              type="email"
              placeholder="operator@nexus.com"
              required
              value={newUserEmail}
              onChange={(e) => setNewUserEmail(e.target.value)}
              className="w-full bg-black/20 border border-white/10 rounded-xl px-5 py-3 text-white focus:border-[var(--soft-gold)]/50 focus:ring-0 transition-all outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] ml-1 flex items-center gap-1.5">
              <Users className="w-3 h-3" /> Display Name
            </label>
            <input
              type="text"
              placeholder="e.g. John Doe"
              value={newUserName}
              onChange={(e) => setNewUserName(e.target.value)}
              className="w-full bg-black/20 border border-white/10 rounded-xl px-5 py-3 text-white focus:border-[var(--soft-gold)]/50 focus:ring-0 transition-all outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] ml-1 flex items-center gap-1.5">
              <Lock className="w-3 h-3" /> Initial Secret
            </label>
            <input
              type="password"
              placeholder="••••••••"
              required
              minLength={6}
              value={newUserPass}
              onChange={(e) => setNewUserPass(e.target.value)}
              className="w-full bg-black/20 border border-white/10 rounded-xl px-5 py-3 text-white focus:border-[var(--soft-gold)]/50 focus:ring-0 transition-all outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] ml-1 flex items-center gap-1.5">
              Membership Tier
            </label>
            <select
              value={newUserPlan}
              onChange={(e) => setNewUserPlan(e.target.value as AdminUser["plan_type"])}
              className="w-full bg-black/20 border border-white/10 rounded-xl px-5 py-3 text-white focus:border-[var(--soft-gold)]/50 focus:ring-0 transition-all outline-none"
            >
              <option value="trial">TRIAL (5 Hotels)</option>
              <option value="starter">STARTER (20 Hotels)</option>
              <option value="pro">PRO (100 Hotels)</option>
              <option value="enterprise">ENTERPRISE (Unlimited)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] ml-1 flex items-center gap-1.5">
              Neural Link Status
            </label>
            <select
              value={newUserStatus}
              onChange={(e) => setNewUserStatus(e.target.value as AdminUser["subscription_status"])}
              className="w-full bg-black/20 border border-white/10 rounded-xl px-5 py-3 text-white focus:border-[var(--soft-gold)]/50 focus:ring-0 transition-all outline-none"
            >
              <option value="active">ACTIVE</option>
              <option value="trial">TRIAL</option>
              <option value="past_due">PAST_DUE</option>
            </select>
          </div>

          <div className="flex items-end col-span-1 md:col-span-1">
            <button
              type="submit"
              className="w-full bg-[var(--soft-gold)] text-[var(--deep-ocean)] font-black px-8 py-3.5 rounded-xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-[var(--soft-gold)]/10 text-xs uppercase tracking-widest flex items-center justify-center gap-2 group"
            >
              <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />{" "}
              Create Account
            </button>
          </div>
        </form>
      </div>

      {/* Users Table */}
      <div className="glass-card border border-white/5 overflow-hidden shadow-2xl transition-all duration-500 hover:border-[var(--soft-gold)]/10">
        {loading && users.length === 0 ? (
          <div className="p-24 text-center">
            <Loader2 className="w-10 h-10 animate-spin text-[var(--soft-gold)] mx-auto opacity-50" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-white/[0.02] text-[var(--text-muted)] font-black text-[10px] uppercase tracking-[0.2em] border-b border-white/5">
                <tr>
                  <th className="p-5">Operator Profile</th>
                  <th className="p-5">Tier / Integrity</th>
                  <th className="p-5">Entity Resource Allocation</th>
                  <th className="p-5 text-center">Sync Matrix</th>
                  <th className="p-5">Temporal Index</th>
                  <th className="p-5 text-right">Matrix Ops</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {users.map((u) => (
                  <tr
                    key={u.id}
                    className="hover:bg-white/[0.02] transition-colors group"
                  >
                    <td className="p-5">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-[var(--soft-gold)]/10 group-hover:border-[var(--soft-gold)]/30 transition-all overflow-hidden relative">
                          {u.display_name?.[0] || u.email?.[0] || "U"}
                          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-white font-bold tracking-tight text-base group-hover:text-[var(--soft-gold)] transition-colors">
                            {u.display_name ||
                              u.email?.split("@")[0] ||
                              "Unknown"}
                          </span>
                          <span className="text-[10px] text-[var(--text-muted)] font-mono opacity-50 lowercase">
                            {u.email}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="p-5">
                      <div className="flex flex-col gap-1.5">
                        <span
                          className={`w-fit px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border ${u.plan_type === "pro" ||
                            u.plan_type === "enterprise"
                            ? "bg-[var(--soft-gold)]/10 text-[var(--soft-gold)] border-[var(--soft-gold)]/20 shadow-[0_0_10px_rgba(212,175,55,0.1)]"
                            : "bg-white/5 text-white/50 border-white/10"
                            }`}
                        >
                          {u.plan_type || "TRIAL"}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <div
                            className={`w-1.5 h-1.5 rounded-full ${u.subscription_status === "active" ? "bg-[var(--optimal-green)] animate-pulse shadow-[0_0_5px_var(--optimal-green)]" : "bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]"}`}
                          />
                          <span
                            className={`text-[10px] font-black uppercase tracking-tighter ${u.subscription_status === "active" ? "text-[var(--optimal-green)]" : "text-red-400 opacity-70"}`}
                          >
                            {u.subscription_status || "trial"}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="p-5">
                      <div className="flex flex-col gap-2 min-w-[150px]">
                        <div className="flex justify-between items-baseline mb-1">
                          <span className="text-[11px] font-black text-white tabular-nums">
                            {u.hotel_count} <span className="opacity-40 font-bold ml-0.5">/ {u.max_hotels || 5}</span>
                          </span>
                          <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-tighter opacity-50">
                            {Math.round((u.hotel_count / (u.max_hotels || 5)) * 100)}% Load
                          </span>
                        </div>
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5 p-[1px]">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, (u.hotel_count / (u.max_hotels || 5)) * 100)}%` }}
                            className={`h-full rounded-full ${(u.hotel_count / (u.max_hotels || 5)) > 0.9
                              ? 'bg-red-500'
                              : (u.hotel_count / (u.max_hotels || 5)) > 0.7
                                ? 'bg-orange-500'
                                : 'bg-[var(--soft-gold)]'
                              } shadow-[0_0_8px_currentColor] opacity-80`}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="p-5 text-center">
                      {u.scan_frequency_minutes &&
                        u.scan_frequency_minutes > 0 ? (
                        <div className="flex flex-col items-center gap-1 group/sync relative">
                          <div className="flex items-center gap-1.5 text-[var(--soft-gold)] font-black text-[10px] bg-[var(--soft-gold)]/10 px-2 py-1 rounded border border-[var(--soft-gold)]/20">
                            <RefreshCw className="w-3 h-3" />
                            {Math.round(u.scan_frequency_minutes / 60)}H
                          </div>
                          <span className="text-[9px] font-medium text-[var(--text-muted)] uppercase tracking-tighter opacity-50">
                            Next Scan Trace
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] border border-white/5 px-2 py-1 rounded opacity-30 italic">
                          Manual_Only
                        </span>
                      )}
                    </td>
                    <td className="p-5">
                      <div className="flex flex-col text-[var(--text-muted)]">
                        <span className="text-xs font-bold tabular-nums group-hover:text-white transition-colors">
                          {u.created_at
                            ? new Date(u.created_at).toLocaleDateString()
                            : "-"}
                        </span>
                        <span className="text-[9px] uppercase tracking-tighter opacity-40 mt-0.5">
                          Registration Epoch
                        </span>
                      </div>
                    </td>
                    <td className="p-5 text-right">
                      <div className="flex justify-end gap-2.5">
                        <button
                          onClick={() =>
                            window.open(`/?impersonate=${u.id}`, "_blank")
                          }
                          className="p-2.5 bg-white/5 hover:bg-[var(--soft-gold)]/10 rounded-xl text-[var(--soft-gold)] border border-white/5 hover:border-[var(--soft-gold)]/30 transition-all active:scale-95"
                          title="Impersonate Matrix"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setUserToEdit(u)}
                          className="p-2.5 bg-white/5 hover:bg-[var(--soft-gold)]/10 rounded-xl text-[var(--soft-gold)] border border-white/5 hover:border-[var(--soft-gold)]/30 transition-all active:scale-95"
                          title="Recode Profile"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u.id)}
                          className="p-2.5 bg-white/5 hover:bg-red-500/10 rounded-xl text-red-400 border border-white/5 hover:border-red-500/30 transition-all active:scale-95"
                          title="Purge Identity"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit User Modal */}
      {userToEdit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
          <div className="glass-card p-8 border border-white/10 w-full max-w-lg shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--soft-gold)]/5 blur-3xl pointer-events-none" />
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--soft-gold)]/10 flex items-center justify-center border border-[var(--soft-gold)]/20">
                  <Edit2 className="w-5 h-5 text-[var(--soft-gold)]" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white uppercase tracking-widest">
                    Recode Identity
                  </h3>
                  <p className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5 opacity-50 lowercase">
                    {userToEdit.email}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setUserToEdit(null)}
                className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/10 text-[var(--text-muted)] hover:text-white transition-all"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] ml-1">
                  Email Terminal
                </label>
                <input
                  value={editUserForm.email}
                  onChange={(e) =>
                    setEditUserForm({ ...editUserForm, email: e.target.value })
                  }
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-[var(--soft-gold)]/50 transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] ml-1">
                  Display Alias
                </label>
                <input
                  value={editUserForm.display_name}
                  onChange={(e) =>
                    setEditUserForm({
                      ...editUserForm,
                      display_name: e.target.value,
                    })
                  }
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-[var(--soft-gold)]/50 transition-all"
                />
              </div>

              {/* Plan & Status Matrix */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] ml-1">
                  Membership Tier
                </label>
                <select
                  value={editUserForm.plan_type}
                  onChange={(e) =>
                    setEditUserForm({
                      ...editUserForm,
                      plan_type: e.target.value as AdminUser["plan_type"],
                    })
                  }
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-[var(--soft-gold)]/50 transition-all outline-none"
                >
                  <option value="trial">TRIAL (5 Hotels)</option>
                  <option value="starter">STARTER (20 Hotels)</option>
                  <option value="pro">PRO (100 Hotels + Hourly)</option>
                  <option value="enterprise">ENTERPRISE (Unlimited)</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] ml-1">
                  Vector Link Status
                </label>
                <select
                  value={editUserForm.subscription_status}
                  onChange={(e) =>
                    setEditUserForm({
                      ...editUserForm,
                      subscription_status: e.target.value as AdminUser["subscription_status"],
                    })
                  }
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-[var(--soft-gold)]/50 transition-all outline-none"
                >
                  <option value="active">ACTIVE (Neural Link Est.)</option>
                  <option value="trial">TRIALING (Temporal)</option>
                  <option value="past_due">PAST_DUE (Warning)</option>
                  <option value="canceled">CANCELED (Cold Storage)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] ml-1">
                  Frequency Matrix
                </label>
                <select
                  value={editUserForm.check_frequency_minutes}
                  onChange={(e) =>
                    setEditUserForm({
                      ...editUserForm,
                      check_frequency_minutes: parseInt(e.target.value),
                    })
                  }
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-[var(--soft-gold)]/50 transition-all outline-none"
                >
                  <option value={0}>MANUAL_ONLY</option>
                  <option value={60}>HOURLY_SYNC</option>
                  <option value={360}>QUARTER_DAY_SYNC</option>
                  <option value={720}>HALF_DAY_SYNC</option>
                  <option value={1440}>DAILY_SYNC</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] ml-1">
                  Reset Key (Optional)
                </label>
                <input
                  type="password"
                  value={editUserForm.password}
                  placeholder="NEW_SECRET_KEY"
                  onChange={(e) =>
                    setEditUserForm({
                      ...editUserForm,
                      password: e.target.value,
                    })
                  }
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-[var(--soft-gold)]/50 transition-all"
                />
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setUserToEdit(null)}
                className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 text-[10px] font-black uppercase tracking-widest text-white rounded-xl transition-all border border-white/5"
              >
                Abort
              </button>
              <button
                onClick={handleUpdateUser}
                disabled={userSaveLoading}
                className="flex-[1.5] py-3.5 bg-[var(--soft-gold)] text-[var(--deep-ocean)] text-[10px] font-black uppercase tracking-widest rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-[var(--soft-gold)]/10 disabled:opacity-50 flex items-center justify-center"
              >
                {userSaveLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                ) : (
                  "Overwrite Identity"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagementPanel;

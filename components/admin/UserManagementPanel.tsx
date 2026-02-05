"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  CheckCircle2,
  Loader2,
  Eye,
} from "lucide-react";
import { api } from "@/lib/api";
import { AdminUser } from "@/types";
import { useToast } from "@/components/ui/ToastContext";

const UserManagementPanel = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [userSuccess, setUserSuccess] = useState(false);

  // Form States
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPass, setNewUserPass] = useState("");
  const [newUserName, setNewUserName] = useState("");

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
  });
  const [userSaveLoading, setUserSaveLoading] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

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
      });
    }
  }, [userToEdit]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await api.getAdminUsers();
      setUsers(data);
    } catch (err: any) {
      toast.error("Failed to load users: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createAdminUser({
        email: newUserEmail,
        password: newUserPass,
        display_name: newUserName || undefined,
      });
      setUserSuccess(true);
      setNewUserEmail("");
      setNewUserPass("");
      setNewUserName("");
      loadUsers();
      setTimeout(() => setUserSuccess(false), 3000);
    } catch (err: any) {
      toast.error("Failed to create user: " + err.message);
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
        company_name: editUserForm.company_name,
        job_title: editUserForm.job_title,
        phone: editUserForm.phone,
        timezone: editUserForm.timezone,
      });
      setUserToEdit(null);
      loadUsers();
    } catch (err: any) {
      toast.error("Failed to update: " + err.message);
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
    } catch (err: any) {
      toast.error("Failed to delete user: " + err.message);
    }
  };

  return (
    <div className="space-y-8">
      {/* Add User Form */}
      <div className="glass-card p-6 border border-white/10">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-lg font-bold text-white">Create New User</h3>
          {userSuccess && (
            <span className="text-[var(--optimal-green)] text-xs flex items-center">
              <CheckCircle2 className="w-3 h-3 mr-1" /> User created!
            </span>
          )}
        </div>
        <form
          onSubmit={handleCreateUser}
          className="flex flex-col md:flex-row gap-4"
        >
          <input
            type="email"
            placeholder="Email"
            required
            value={newUserEmail}
            onChange={(e) => setNewUserEmail(e.target.value)}
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
          />
          <input
            type="text"
            placeholder="Display Name (Opt)"
            value={newUserName}
            onChange={(e) => setNewUserName(e.target.value)}
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
          />
          <input
            type="password"
            placeholder="Password"
            required
            minLength={6}
            value={newUserPass}
            onChange={(e) => setNewUserPass(e.target.value)}
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
          />
          <button
            type="submit"
            className="bg-[var(--soft-gold)] text-black font-bold px-6 py-2 rounded-lg hover:opacity-90 flex items-center gap-2 justify-center"
          >
            <Plus className="w-4 h-4" /> Create User
          </button>
        </form>
      </div>

      <div className="glass-card border border-white/10 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-[var(--text-muted)] font-medium">
            <tr>
              <th className="p-4">User</th>
              <th className="p-4">Plan / Status</th>
              <th className="p-4">Hotels</th>
              <th className="p-4">Scans</th>
              <th className="p-4">Created</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-white/5">
                <td className="p-4">
                  <div className="font-medium text-white">
                    {u.display_name || u.email?.split("@")[0] || "Unknown"}
                  </div>
                  <div className="text-[var(--text-muted)] text-xs">
                    {u.email}
                  </div>
                  <div className="text-[var(--text-muted)] text-xs font-mono">
                    {u.id}
                  </div>
                </td>
                <td className="p-4">
                  <div className="flex flex-col">
                    <span className="uppercase text-[10px] font-bold text-white">
                      {u.plan_type || "TRIAL"}
                    </span>
                    <span
                      className={`text-xs ${u.subscription_status === "active" ? "text-[var(--optimal-green)]" : "text-[var(--alert-red)]"}`}
                    >
                      {u.subscription_status || "trial"}
                    </span>
                  </div>
                </td>
                <td className="p-4 text-white">{u.hotel_count}</td>
                <td className="p-4 text-white">{u.scan_count}</td>
                <td className="p-4 text-[var(--text-muted)]">
                  {new Date(u.created_at).toLocaleDateString()}
                </td>
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() =>
                        window.open(`/?impersonate=${u.id}`, "_blank")
                      }
                      className="p-2 hover:bg-white/10 rounded text-[var(--soft-gold)] transition-colors"
                      title="View Dashboard (Impersonate)"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setUserToEdit(u)}
                      className="p-2 hover:bg-white/10 rounded text-[var(--soft-gold)] transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm("Promote user to PRO for 30 days?")) {
                          api
                            .updateAdminUser(u.id, {
                              plan_type: "pro",
                              subscription_status: "active",
                              extend_trial_days: 30,
                            })
                            .then(loadUsers);
                        }
                      }}
                      className="p-2 hover:bg-white/10 rounded text-blue-400 transition-colors"
                      title="Quick Upgrade"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteUser(u.id)}
                      className="p-2 hover:bg-red-500/20 rounded text-red-400 hover:text-red-200 transition-colors"
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

      {/* Edit User Modal */}
      {userToEdit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card p-6 border border-white/10 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Edit User</h3>
              <button
                onClick={() => setUserToEdit(null)}
                className="text-[var(--text-muted)] hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs uppercase text-[var(--text-muted)] mb-1">
                  Email
                </label>
                <input
                  value={editUserForm.email}
                  onChange={(e) =>
                    setEditUserForm({ ...editUserForm, email: e.target.value })
                  }
                  className="w-full bg-black/30 border border-white/10 rounded px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-xs uppercase text-[var(--text-muted)] mb-1">
                  Name
                </label>
                <input
                  value={editUserForm.display_name}
                  onChange={(e) =>
                    setEditUserForm({
                      ...editUserForm,
                      display_name: e.target.value,
                    })
                  }
                  className="w-full bg-black/30 border border-white/10 rounded px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-xs uppercase text-[var(--text-muted)] mb-1">
                  Pass (Leave blank to keep current)
                </label>
                <input
                  type="password"
                  value={editUserForm.password}
                  onChange={(e) =>
                    setEditUserForm({
                      ...editUserForm,
                      password: e.target.value,
                    })
                  }
                  className="w-full bg-black/30 border border-white/10 rounded px-3 py-2 text-white"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setUserToEdit(null)}
                  className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateUser}
                  disabled={userSaveLoading}
                  className="flex-1 py-2 bg-[var(--soft-gold)] text-black font-bold rounded-lg hover:opacity-90 disabled:opacity-50"
                >
                  {userSaveLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                  ) : (
                    "Save Changes"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagementPanel;

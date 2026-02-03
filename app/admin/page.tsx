"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import {
  Building2,
  MapPin,
  Database,
  Users,
  Activity,
  Key,
  LayoutDashboard,
  Trash2,
  CheckCircle2,
  Loader2,
  AlertCircle,
  RefreshCw,
  Plus,
  Edit2,
  List,
  X,
  Save,
  Crown,
  ScanLine,
} from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  AdminStats,
  AdminUser,
  DirectoryEntry,
  AdminLog,
  KeyStatus,
} from "@/types";
import { useToast } from "@/components/ui/ToastContext";

export default function AdminPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Data States
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [directory, setDirectory] = useState<DirectoryEntry[]>([]);
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [scans, setScans] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);

  // Directory Form State
  const [dirName, setDirName] = useState("");
  const [dirLocation, setDirLocation] = useState("");
  const [dirSerpId, setDirSerpId] = useState("");
  const [dirSuccess, setDirSuccess] = useState(false);

  // User Form State
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPass, setNewUserPass] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [userSuccess, setUserSuccess] = useState(false);

  // Scan Logic
  const [selectedScanId, setSelectedScanId] = useState<string | null>(null);
  const [scanDetails, setScanDetails] = useState<{
    session: any;
    logs: any[];
  } | null>(null);
  const [scanDetailsLoading, setScanDetailsLoading] = useState(false);

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
    loadTabData();
  }, [activeTab]);

  // Fetch details when ID changes
  useEffect(() => {
    if (selectedScanId) {
      fetchScanDetails(selectedScanId);
    } else {
      setScanDetails(null);
    }
  }, [selectedScanId]);

  const fetchScanDetails = async (id: string) => {
    setScanDetailsLoading(true);
    try {
      const data = await api.getAdminScanDetails(id);
      setScanDetails(data);
    } catch (err: any) {
      toast.error("Error: " + err.message);
      setSelectedScanId(null);
    } finally {
      setScanDetailsLoading(false);
    }
  };

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

  const loadTabData = async () => {
    setLoading(true);
    setError("");
    try {
      if (activeTab === "overview") {
        const data = await api.getAdminStats();
        setStats(data);
      } else if (activeTab === "users") {
        const data = await api.getAdminUsers();
        setUsers(data);
      } else if (activeTab === "directory") {
        const data = await api.getAdminDirectory();
        setDirectory(data);
      } else if (activeTab === "logs") {
        const data = await api.getAdminLogs();
        setLogs(data);
      } else if (activeTab === "scans") {
        const data = await api.getAdminScans();
      } else if (activeTab === "scans") {
        const data = await api.getAdminScans();
        setScans(data);
      }

      // Always fetch providers for overview
      if (activeTab === "overview") {
        const pData = await api.getAdminProviders();
        setProviders(pData);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
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
      loadTabData();
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
      loadTabData(); // Refresh
    } catch (err: any) {
      toast.error("Failed to delete user: " + err.message);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail || !newUserPass) return;

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
      loadTabData();
      setTimeout(() => setUserSuccess(false), 3000);
    } catch (err: any) {
      toast.error("Failed to create user: " + err.message);
    }
  };

  const handleDeleteDirectory = async (id: number) => {
    if (!confirm("Remove this hotel from shared directory?")) return;
    try {
      await api.deleteAdminDirectory(id);
      loadTabData(); // Refresh
    } catch (err: any) {
      toast.error("Failed to delete entry: " + err.message);
    }
  };

  const handleAddDirectory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.addHotelToDirectory(
        dirName,
        dirLocation,
        dirSerpId || undefined,
      );
      setDirSuccess(true);
      setDirName("");
      setDirLocation("");
      setDirSerpId("");
      loadTabData(); // Refresh list
      setTimeout(() => setDirSuccess(false), 3000);
    } catch (err: any) {
      toast.error("Failed to add: " + err.message);
    }
  };

  const handleSyncDirectory = async () => {
    if (!confirm("Scan all user hotels and add to directory?")) return;
    try {
      const res = await api.syncDirectory();
      toast.success(`Synced ${res.synced_count} hotels.`);
      loadTabData();
    } catch (err: any) {
      toast.error("Sync failed: " + err.message);
    }
  };

  const TabButton = ({
    id,
    label,
    icon: Icon,
  }: {
    id: string;
    label: string;
    icon: React.ElementType;
  }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
        activeTab === id
          ? "bg-[var(--soft-gold)] text-[var(--deep-ocean)]"
          : "text-[var(--text-muted)] hover:text-white hover:bg-white/5"
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-xl bg-[var(--soft-gold)]/20 flex items-center justify-center">
          <Database className="w-6 h-6 text-[var(--soft-gold)]" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            System Administration
          </h1>
          <p className="text-[var(--text-muted)] mt-1">
            Manage users, directory, and monitor system health
          </p>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex flex-wrap gap-2 mb-8 border-b border-white/10 pb-4">
        <TabButton id="overview" label="Overview" icon={LayoutDashboard} />
        <TabButton id="users" label="Users" icon={Users} />
        <TabButton id="directory" label="Directory" icon={Building2} />
        <TabButton id="logs" label="System Logs" icon={Activity} />
        <TabButton id="keys" label="API Keys" icon={Key} />
        <TabButton id="plans" label="Memberships" icon={Crown} />
        <TabButton id="scans" label="User Scans" icon={ScanLine} />
      </div>

      {/* Content */}
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 p-4 rounded-lg flex items-center gap-3 text-red-200 mb-6">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <div>
              <p className="font-bold">Error Loading Data</p>
              <p className="text-xs opacity-80">{error}</p>
            </div>
            <button
              onClick={loadTabData}
              className="ml-auto hover:bg-red-500/20 p-2 rounded"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        )}
        {loading && (
          <div className="text-[var(--soft-gold)] flex items-center gap-2 mb-4">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading...
          </div>
        )}

        {/* OVERVIEW TAB */}
        {activeTab === "overview" && stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {!stats.service_role_active && (
              <div className="col-span-full bg-red-500/10 border border-red-500/50 p-4 rounded-lg flex items-center gap-3 text-red-200">
                <AlertCircle className="w-5 h-5 text-red-400" />
                <div>
                  <p className="font-bold">Service Role Key Missing</p>
                  <p className="text-xs opacity-80">
                    Admin data requires SUPABASE_SERVICE_ROLE_KEY in Vercel
                    environment variables.
                  </p>
                </div>
              </div>
            )}
            <StatCard
              label="Total Users"
              value={stats.total_users}
              icon={Users}
            />
            <StatCard
              label="Total Hotels"
              value={stats.total_hotels}
              icon={Building2}
            />
            <StatCard
              label="Total Scans"
              value={stats.total_scans}
              icon={Activity}
            />
            <StatCard
              label="Directory Size"
              value={stats.directory_size}
              icon={Database}
            />
            <div className="col-span-full mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Providers Card */}
              <div className="p-6 glass-card border border-white/10 md:col-span-2">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-white">
                    Data Providers
                  </h3>
                  <span className="text-xs text-[var(--text-muted)]">
                    Priority Order
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {providers.map((p) => (
                    <div
                      key={p.name}
                      className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-2 h-2 rounded-full ${p.enabled ? "bg-[var(--optimal-green)] shadow-[0_0_8px_var(--optimal-green)]" : "bg-red-500/50"}`}
                        />
                        <div>
                          <div className="text-sm font-bold text-white">
                            {p.name}
                          </div>
                          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                            {p.type}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs font-mono text-[var(--soft-gold)] opacity-70">
                        P{p.priority}
                      </div>
                    </div>
                  ))}
                  {providers.length === 0 && (
                    <div className="col-span-full text-xs text-center text-[var(--text-muted)] py-2">
                      Loading provider status...
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 glass-card border border-white/10">
                <h3 className="text-lg font-bold text-white mb-2">
                  System Health
                </h3>
                <div className="flex items-center gap-2 text-[var(--optimal-green)]">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>
                    All systems operational. API calls today:{" "}
                    {stats.api_calls_today}
                  </span>
                </div>
              </div>

              <div className="p-6 glass-card border border-white/10">
                <h3 className="text-lg font-bold text-white mb-2">
                  Quick Actions
                </h3>
                <div className="flex gap-3">
                  <Link
                    href="/admin/list"
                    className="bg-[var(--soft-gold)] text-black px-4 py-2 rounded-lg font-bold text-sm hover:opacity-90 inline-flex items-center gap-2"
                  >
                    <List className="w-4 h-4" /> Master Hotel List
                  </Link>
                  <button
                    onClick={() => setActiveTab("users")}
                    className="bg-white/10 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-white/20 inline-flex items-center gap-2"
                  >
                    <Users className="w-4 h-4" /> Manage Users
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* USERS TAB */}
        {activeTab === "users" && (
          <div className="space-y-8">
            {/* Add User Form */}
            <div className="glass-card p-6 border border-white/10">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-lg font-bold text-white">
                  Create New User
                </h3>
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
                          {u.display_name ||
                            u.email?.split("@")[0] ||
                            "Unknown"}
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
                                  .then(loadTabData);
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
                  {users.length === 0 && !loading && (
                    <tr>
                      <td
                        colSpan={5}
                        className="p-8 text-center text-[var(--text-muted)]"
                      >
                        No users found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* DIRECTORY TAB */}
        {activeTab === "directory" && (
          <div className="space-y-8">
            <div className="flex items-center justify-between p-4 bg-[var(--soft-gold)]/10 border border-[var(--soft-gold)]/20 rounded-lg">
              <div className="flex items-center gap-3">
                <List className="w-5 h-5 text-[var(--soft-gold)]" />
                <span className="text-white text-sm font-medium">
                  Looking to edit specific hotel monitors?
                </span>
              </div>
              <Link
                href="/admin/list"
                className="bg-[var(--soft-gold)] text-black px-4 py-2 rounded-lg text-sm font-bold hover:opacity-90"
              >
                Go to Master Hotel List
              </Link>
            </div>

            {/* Add New Form */}
            <div className="glass-card p-6 border border-white/10">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-white">Add New Entry</h3>
                <button
                  onClick={handleSyncDirectory}
                  className="text-xs bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded flex items-center gap-2 text-[var(--soft-gold)]"
                >
                  <RefreshCw className="w-3 h-3" /> Sync DB
                </button>
              </div>

              <form
                onSubmit={handleAddDirectory}
                className="flex flex-col md:flex-row gap-4"
              >
                <input
                  placeholder="Hotel Name"
                  value={dirName}
                  onChange={(e) => setDirName(e.target.value)}
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                  required
                />
                <input
                  placeholder="Location"
                  value={dirLocation}
                  onChange={(e) => setDirLocation(e.target.value)}
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                  required
                />
                <input
                  placeholder="SerpApi ID (Opt)"
                  value={dirSerpId}
                  onChange={(e) => setDirSerpId(e.target.value)}
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                />
                <button
                  type="submit"
                  className="bg-[var(--soft-gold)] text-black font-bold px-6 py-2 rounded-lg hover:opacity-90"
                >
                  Add
                </button>
              </form>
              {dirSuccess && (
                <div className="text-[var(--optimal-green)] mt-2 text-sm flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Added!
                </div>
              )}
            </div>

            {/* List */}
            <div className="glass-card border border-white/10 overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-white/5 text-[var(--text-muted)] font-medium">
                  <tr>
                    <th className="p-4">Name</th>
                    <th className="p-4">Location</th>
                    <th className="p-4">SerpApi ID</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {directory.map((d) => (
                    <tr key={d.id} className="hover:bg-white/5">
                      <td className="p-4 text-white font-medium">{d.name}</td>
                      <td className="p-4 text-[var(--text-muted)]">
                        {d.location}
                      </td>
                      <td className="p-4 font-mono text-xs text-[var(--text-muted)]">
                        {d.serp_api_id || "-"}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleDeleteDirectory(d.id)}
                          className="p-2 hover:bg-red-500/20 rounded text-red-400 hover:text-red-200 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* LOGS TAB */}
        {activeTab === "logs" && (
          <div className="glass-card border border-white/10 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 text-[var(--text-muted)] font-medium">
                <tr>
                  <th className="p-4">Time</th>
                  <th className="p-4">Level</th>
                  <th className="p-4">Action</th>
                  <th className="p-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/5">
                    <td className="p-4 text-[var(--text-muted)] whitespace-nowrap">
                      {formatDistanceToNow(new Date(log.timestamp), {
                        addSuffix: true,
                      })}
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-1 rounded text-xs font-bold ${
                          log.level === "ERROR"
                            ? "bg-red-500/20 text-red-400"
                            : log.level === "SUCCESS"
                              ? "bg-green-500/20 text-green-400"
                              : "bg-blue-500/20 text-blue-400"
                        }`}
                      >
                        {log.level}
                      </span>
                    </td>
                    <td className="p-4 text-white">{log.action}</td>
                    <td className="p-4 text-[var(--text-muted)] text-xs font-mono">
                      {log.details}
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && !loading && (
                  <tr>
                    <td
                      colSpan={4}
                      className="p-8 text-center text-[var(--text-muted)]"
                    >
                      No logs found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* SCANS TAB */}
        {activeTab === "scans" && (
          <div className="glass-card border border-white/10 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 text-[var(--text-muted)] font-medium">
                <tr>
                  <th className="p-4">Time</th>
                  <th className="p-4">User</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Credits</th>
                  <th className="p-4 text-right">Hotels</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {scans.map((scan) => (
                  <tr
                    key={scan.id}
                    className="hover:bg-white/5 cursor-pointer transition-colors"
                    onClick={() => setSelectedScanId(scan.id)}
                  >
                    <td className="p-4 text-[var(--text-muted)] whitespace-nowrap">
                      {formatDistanceToNow(new Date(scan.created_at), {
                        addSuffix: true,
                      })}
                    </td>
                    <td className="p-4 text-white font-medium">
                      {scan.user_name}
                    </td>
                    <td className="p-4">
                      <span className="bg-white/10 px-2 py-1 rounded text-xs text-white capitalize">
                        {scan.session_type}
                      </span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-1 rounded text-xs font-bold ${
                          scan.status === "completed"
                            ? "bg-[var(--optimal-green)]/20 text-[var(--optimal-green)]"
                            : scan.status === "running"
                              ? "bg-[var(--soft-gold)]/20 text-[var(--soft-gold)] animate-pulse"
                              : scan.status === "failed"
                                ? "bg-[var(--alert-red)]/20 text-[var(--alert-red)]"
                                : "bg-white/10 text-[var(--text-muted)]"
                        }`}
                      >
                        {scan.status}
                      </span>
                    </td>
                    <td className="p-4 text-right font-mono text-[var(--soft-gold)]">
                      {scan.hotels_count} {/* 1 hotel = 1 credit usually */}
                    </td>
                    <td className="p-4 text-right text-white">
                      {scan.hotels_count}
                    </td>
                  </tr>
                ))}
                {scans.length === 0 && !loading && (
                  <tr>
                    <td
                      colSpan={6}
                      className="p-8 text-center text-[var(--text-muted)]"
                    >
                      No scans recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* API KEYS TAB */}
        {activeTab === "keys" && <ApiKeysPanel />}

        {/* MEMBERSHIPS TAB */}
        {activeTab === "plans" && <MembershipPlansPanel />}
      </div>

      {/* Scan Details Modal */}
      {selectedScanId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card p-6 border border-white/10 w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-4">
              <h3 className="text-xl font-bold text-white">Scan Details</h3>
              <button
                onClick={() => setSelectedScanId(null)}
                className="text-[var(--text-muted)] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {scanDetailsLoading ? (
              <div className="flex-1 flex items-center justify-center py-12 text-[var(--soft-gold)]">
                <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading
                details...
              </div>
            ) : scanDetails ? (
              <div className="overflow-y-auto pr-2 custom-scrollbar">
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-white/5 p-3 rounded">
                    <div className="text-xs text-[var(--text-muted)] uppercase">
                      Status
                    </div>
                    <div className="text-white font-bold capitalize">
                      {scanDetails.session.status}
                    </div>
                  </div>
                  <div className="bg-white/5 p-3 rounded">
                    <div className="text-xs text-[var(--text-muted)] uppercase">
                      Hotels Found
                    </div>
                    <div className="text-white font-bold">
                      {scanDetails.session.hotels_count}
                    </div>
                  </div>
                  <div className="bg-white/5 p-3 rounded">
                    <div className="text-xs text-[var(--text-muted)] uppercase">
                      Created
                    </div>
                    <div className="text-white font-bold text-xs">
                      {new Date(
                        scanDetails.session.created_at,
                      ).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="bg-[var(--soft-gold)]/5 border border-[var(--soft-gold)]/20 p-4 rounded-xl mb-6">
                  <div className="text-[10px] text-[var(--soft-gold)] uppercase font-black tracking-widest mb-2">
                    Search Configuration
                  </div>
                  <div className="flex gap-6">
                    <div>
                      <div className="text-[10px] text-[var(--text-muted)] uppercase">
                        Check-in
                      </div>
                      <div className="text-white font-bold">
                        {scanDetails.session.check_in_date || "Today"}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[var(--text-muted)] uppercase">
                        Occupancy
                      </div>
                      <div className="text-white font-bold">
                        {scanDetails.session.adults || 2} People
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[var(--text-muted)] uppercase">
                        Currency
                      </div>
                      <div className="text-white font-bold">
                        {scanDetails.session.currency || "USD"}
                      </div>
                    </div>
                  </div>
                </div>

                <h4 className="text-white font-bold mb-2">Result Logs</h4>
                {scanDetails.logs.length === 0 ? (
                  <div className="text-[var(--text-muted)] italic">
                    No detailed logs available.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {scanDetails.logs.map((log: any) => (
                      <div
                        key={log.id}
                        className="bg-white/5 p-3 rounded flex justify-between items-center text-sm"
                      >
                        <div>
                          <div className="text-white font-medium">
                            {log.hotel_name}
                          </div>
                          <div className="text-xs text-[var(--text-muted)]">
                            {log.location || "No location"}
                          </div>
                        </div>
                        <div className="text-right">
                          {log.price ? (
                            <div className="text-[var(--optimal-green)] font-bold">
                              {log.currency} {log.price}
                            </div>
                          ) : (
                            <div className="text-[var(--alert-red)] text-xs">
                              No Price
                            </div>
                          )}
                          <div className="text-[10px] text-[var(--text-muted)]">
                            {log.vendor || "Unknown Source"}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-red-400">Failed to load data.</div>
            )}
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {userToEdit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="glass-card p-6 border border-white/10 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Edit User</h3>
              <button
                onClick={() => setUserToEdit(null)}
                className="text-[var(--text-muted)] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-1 block">
                  Email
                </label>
                <input
                  type="email"
                  value={editUserForm.email}
                  onChange={(e) =>
                    setEditUserForm((f) => ({ ...f, email: e.target.value }))
                  }
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                />
              </div>

              {/* Admin Override Subscription */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-1 block">
                    Plan Type
                  </label>
                  <select
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white [&>option]:bg-black"
                    onChange={(e) =>
                      api.updateAdminUser(userToEdit.id, {
                        plan_type: e.target.value,
                      })
                    }
                    defaultValue={userToEdit.plan_type || "trial"}
                  >
                    <option value="trial">Trial</option>
                    <option value="starter">Starter</option>
                    <option value="pro">Pro</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-1 block">
                    Status
                  </label>
                  <select
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white [&>option]:bg-black"
                    onChange={(e) =>
                      api.updateAdminUser(userToEdit.id, {
                        subscription_status: e.target.value,
                      })
                    }
                    defaultValue={userToEdit.subscription_status || "trial"}
                  >
                    <option value="active">Active</option>
                    <option value="trial">Trial</option>
                    <option value="past_due">Past Due</option>
                    <option value="canceled">Canceled</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-1 block">
                  Display Name
                </label>
                <input
                  type="text"
                  value={editUserForm.display_name}
                  onChange={(e) =>
                    setEditUserForm((f) => ({
                      ...f,
                      display_name: e.target.value,
                    }))
                  }
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-1 block">
                  New Password (Opt)
                </label>
                <input
                  type="password"
                  value={editUserForm.password}
                  onChange={(e) =>
                    setEditUserForm((f) => ({ ...f, password: e.target.value }))
                  }
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                  placeholder="Leave blank to keep current"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-1 block">
                  Company / Hotel
                </label>
                <input
                  type="text"
                  value={editUserForm.company_name}
                  onChange={(e) =>
                    setEditUserForm((f) => ({
                      ...f,
                      company_name: e.target.value,
                    }))
                  }
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-1 block">
                    Job Title
                  </label>
                  <input
                    type="text"
                    value={editUserForm.job_title}
                    onChange={(e) =>
                      setEditUserForm((f) => ({
                        ...f,
                        job_title: e.target.value,
                      }))
                    }
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-1 block">
                    Phone
                  </label>
                  <input
                    type="text"
                    value={editUserForm.phone}
                    onChange={(e) =>
                      setEditUserForm((f) => ({ ...f, phone: e.target.value }))
                    }
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-1 block">
                  Timezone
                </label>
                <select
                  value={editUserForm.timezone}
                  onChange={(e) =>
                    setEditUserForm((f) => ({ ...f, timezone: e.target.value }))
                  }
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white [&>option]:bg-[#0f172a]"
                >
                  {[
                    "UTC",
                    "Europe/Istanbul",
                    "Europe/London",
                    "Europe/Paris",
                    "America/New_York",
                    "America/Los_Angeles",
                    "Asia/Tokyo",
                    "Asia/Dubai",
                  ].map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setUserToEdit(null)}
                className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateUser}
                disabled={userSaveLoading}
                className="flex-1 px-4 py-2 bg-[var(--soft-gold)] text-black font-bold rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {userSaveLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const StatCard = ({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
}) => (
  <div className="glass-card p-6 border border-white/10 flex items-center gap-4">
    <div className="w-12 h-12 rounded-xl bg-[var(--soft-gold)]/10 flex items-center justify-center shrink-0">
      <Icon className="w-6 h-6 text-[var(--soft-gold)]" />
    </div>
    <div>
      <p className="text-[var(--text-muted)] text-xs uppercase font-bold tracking-wider">
        {label}
      </p>
      <p className="text-2xl font-bold text-white">
        {value?.toLocaleString() || 0}
      </p>
    </div>
  </div>
);

const ApiKeysPanel = () => {
  const [keyStatus, setKeyStatus] = useState<KeyStatus | null>(null);
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadKeyStatus();
  }, []);

  const loadKeyStatus = async () => {
    setLoading(true);
    try {
      const [kData, pData] = await Promise.all([
        api.getAdminKeyStatus(),
        api.getAdminProviders(),
      ]);
      setKeyStatus(kData);
      setProviders(pData);
    } catch (err: any) {
      console.error("Failed to load key status:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRotate = async () => {
    if (!confirm("Force rotate to next API key?")) return;
    setActionLoading(true);
    try {
      const data = await api.rotateAdminKey();
      setKeyStatus(data.current_status);
      alert(data.message);
    } catch (err: any) {
      alert("Failed: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReload = async () => {
    setActionLoading(true);
    try {
      const data = await api.reloadAdminKeys();

      setKeyStatus((curr) =>
        curr ? { ...curr, total_keys: data.total_keys } : null,
      );
      loadKeyStatus();

      const debugMsg = [
        `Reloaded! Found ${data.total_keys} keys.`,
        `Keys: ${data.keys_found?.join(", ")}`,
        `Env Check: ${JSON.stringify(data.env_debug, null, 2)}`,
      ].join("\n");

      alert(debugMsg);
    } catch (err: any) {
      alert("Reload Failed: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("Reset all keys to active? (Use at new billing period)"))
      return;
    setActionLoading(true);
    try {
      const data = await api.resetAdminKeys();
      setKeyStatus(data.current_status);
      alert(data.message);
    } catch (err: any) {
      alert("Failed: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="glass-card p-8 border border-white/10 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--soft-gold)] mx-auto" />
        <p className="text-[var(--text-muted)] mt-4">Loading key status...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="glass-card p-6 border border-white/10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Key className="w-6 h-6 text-[var(--soft-gold)]" />
            <h3 className="text-xl font-bold text-white">
              SerpApi Key Management
            </h3>
          </div>
          <button
            onClick={loadKeyStatus}
            className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white text-sm rounded-lg"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Providers Status */}
        <div className="mb-8">
          <h4 className="text-sm font-bold text-white mb-3 uppercase tracking-wider text-[var(--text-muted)]">
            Active Data Providers
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {providers.map((p) => (
              <div
                key={p.name}
                className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2 h-2 rounded-full ${p.enabled ? "bg-[var(--optimal-green)] shadow-[0_0_8px_var(--optimal-green)]" : "bg-red-500/50"}`}
                  />
                  <div>
                    <div className="text-sm font-bold text-white">{p.name}</div>
                    <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                      {p.type}
                    </div>
                  </div>
                </div>
                <div className="text-xs font-mono text-[var(--soft-gold)] opacity-70">
                  P{p.priority}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-black/20 p-4 rounded-lg">
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">
              Total Keys
            </div>
            <div className="text-2xl font-bold text-white">
              {keyStatus?.total_keys || 0}
            </div>
          </div>
          <div className="bg-black/20 p-4 rounded-lg">
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">
              Active Keys
            </div>
            <div className="text-2xl font-bold text-[var(--optimal-green)]">
              {keyStatus?.active_keys || 0}
            </div>
          </div>
          <div className="bg-black/20 p-4 rounded-lg">
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">
              Current Key
            </div>
            <div className="text-2xl font-bold text-[var(--soft-gold)]">
              #{keyStatus?.current_key_index || 1}
            </div>
          </div>
          <div className="bg-black/20 p-4 rounded-lg">
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">
              Quota/Key
            </div>
            <div className="text-2xl font-bold text-white">
              {keyStatus?.quota_per_key || 250}/mo
            </div>
          </div>
        </div>

        {/* Keys List */}
        <div className="space-y-3">
          {keyStatus?.keys_status?.map((key) => (
            <div
              key={key.index}
              className={`flex items-center justify-between p-4 rounded-lg border ${
                key.is_current
                  ? "bg-[var(--soft-gold)]/10 border-[var(--soft-gold)]/30"
                  : key.is_exhausted
                    ? "bg-red-500/10 border-red-500/30"
                    : "bg-white/5 border-white/10"
              }`}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold ${
                    key.is_current
                      ? "bg-[var(--soft-gold)] text-black"
                      : "bg-white/10 text-white"
                  }`}
                >
                  {key.index}
                </div>
                <div>
                  <div className="text-white font-mono text-sm">
                    {key.key_suffix}
                  </div>
                  {key.exhausted_at && (
                    <div className="text-red-400 text-xs">
                      Exhausted: {new Date(key.exhausted_at).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {key.is_current && (
                  <span className="px-2 py-1 bg-[var(--soft-gold)]/20 text-[var(--soft-gold)] text-xs rounded font-medium">
                    ACTIVE
                  </span>
                )}
                {key.is_exhausted && !key.is_current && (
                  <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded font-medium">
                    EXHAUSTED
                  </span>
                )}
                {!key.is_exhausted && !key.is_current && (
                  <span className="px-2 py-1 bg-white/10 text-[var(--text-muted)] text-xs rounded">
                    Standby
                  </span>
                )}
              </div>
            </div>
          ))}

          {(!keyStatus?.keys_status || keyStatus.keys_status.length === 0) && (
            <div className="p-6 text-center text-[var(--text-muted)] bg-white/5 rounded-lg">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No API keys configured.</p>
              <p className="text-xs mt-1">
                Add SERPAPI_API_KEY to environment variables.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <button
          onClick={handleRotate}
          disabled={actionLoading || (keyStatus?.total_keys || 0) <= 1}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {actionLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Force Rotate to Next Key
        </button>
        <button
          onClick={handleReload}
          disabled={actionLoading}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-[var(--soft-gold)]/20 text-[var(--soft-gold)] font-bold rounded-lg hover:bg-[var(--soft-gold)]/30 disabled:opacity-50"
        >
          {actionLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Reload from Env
        </button>
        <button
          onClick={handleReset}
          disabled={actionLoading}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-[var(--soft-gold)] text-black font-bold rounded-lg hover:opacity-90 disabled:opacity-50"
        >
          {actionLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <CheckCircle2 className="w-4 h-4" />
          )}
          Reset All Keys (New Month)
        </button>
      </div>
      {/* Edit User Modal */}
    </div>
  );
};

const MembershipPlansPanel = () => {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [formData, setFormData] = useState<{
    name: string;
    price_monthly: number;
    hotel_limit: number;
    scan_frequency_limit: string;
    monthly_scan_limit: number;
    features: string[];
  }>({
    name: "",
    price_monthly: 0,
    hotel_limit: 1,
    scan_frequency_limit: "daily",
    monthly_scan_limit: 100,
    features: [],
  });

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    setLoading(true);
    try {
      const data = await api.getAdminPlans();
      setPlans(data);
    } catch (err) {
      console.error("Failed to load plans", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...formData,
      // Features is already an array from TagInput
      features: Array.isArray(formData.features) ? formData.features : [],
    };

    try {
      if (editingPlan) {
        await api.updateAdminPlan(editingPlan.id, payload);
      } else {
        await api.createAdminPlan(payload);
      }
      setIsModalOpen(false);
      setEditingPlan(null);
      setFormData({
        name: "",
        price_monthly: 0,
        hotel_limit: 1,
        scan_frequency_limit: "daily",
        monthly_scan_limit: 100,
        features: [],
      });
      loadPlans();
    } catch (err: any) {
      alert("Failed to save: " + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this plan? Users on this plan might be affected."))
      return;
    try {
      await api.deleteAdminPlan(id);
      loadPlans();
    } catch (err: any) {
      alert("Delete failed: " + err.message);
    }
  };

  const openEdit = (plan: any) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      price_monthly: plan.price_monthly,
      hotel_limit: plan.hotel_limit,
      scan_frequency_limit: plan.scan_frequency_limit,
      monthly_scan_limit: plan.monthly_scan_limit || 100,
      features: Array.isArray(plan.features) ? plan.features : [],
    });
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Crown className="w-6 h-6 text-[var(--soft-gold)]" />
          <h3 className="text-xl font-bold text-white">Membership Plans</h3>
        </div>
        <button
          onClick={() => {
            setEditingPlan(null);
            setFormData({
              name: "",
              price_monthly: 0,
              hotel_limit: 1,
              scan_frequency_limit: "daily",
              monthly_scan_limit: 100,
              features: [],
            });
            setIsModalOpen(true);
          }}
          className="bg-[var(--soft-gold)] text-black font-bold px-4 py-2 rounded-lg hover:opacity-90 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add Plan
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className="glass-card p-6 border border-white/10 relative group"
          >
            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => openEdit(plan)}
                className="p-1.5 bg-white/10 hover:bg-white/20 rounded text-white"
              >
                <Edit2 className="w-3 h-3" />
              </button>
              <button
                onClick={() => handleDelete(plan.id)}
                className="p-1.5 bg-red-500/20 hover:bg-red-500/40 rounded text-red-200"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>

            <h4 className="text-lg font-bold text-white mb-1">{plan.name}</h4>
            <div className="text-2xl font-bold text-[var(--soft-gold)] mb-4">
              ${plan.price_monthly}
              <span className="text-xs text-[var(--text-muted)] font-normal">
                /mo
              </span>
            </div>

            <div className="space-y-2 text-sm text-[var(--text-muted)]">
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span>Monitors</span>
                <span className="text-white">{plan.hotel_limit} Hotels</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span>Frequency</span>
                <span className="text-white capitalize">
                  {plan.scan_frequency_limit}
                </span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span>Monthly Limit</span>
                <span className="text-white">
                  {plan.monthly_scan_limit || 100} Scans
                </span>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {Array.isArray(plan.features) &&
                plan.features.map((f: string, i: number) => (
                  <span
                    key={i}
                    className="text-[10px] bg-white/5 px-2 py-1 rounded text-[var(--text-secondary)]"
                  >
                    {f}
                  </span>
                ))}
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card p-6 border border-white/10 w-full max-w-md">
            <h3 className="text-xl font-bold text-white mb-4">
              {editingPlan ? "Edit Plan" : "Create Plan"}
            </h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs uppercase text-[var(--text-muted)] mb-1">
                  Plan Name
                </label>
                <input
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full bg-black/30 border border-white/10 rounded px-3 py-2 text-white"
                  placeholder="e.g. Gold"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase text-[var(--text-muted)] mb-1">
                    Price ($)
                  </label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    value={formData.price_monthly}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        price_monthly: parseFloat(e.target.value),
                      })
                    }
                    className="w-full bg-black/30 border border-white/10 rounded px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase text-[var(--text-muted)] mb-1">
                    Hotel Limit
                  </label>
                  <input
                    required
                    type="number"
                    value={formData.hotel_limit}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        hotel_limit: parseInt(e.target.value),
                      })
                    }
                    className="w-full bg-black/30 border border-white/10 rounded px-3 py-2 text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs uppercase text-[var(--text-muted)] mb-1">
                  Monthly Scan Limit
                </label>
                <input
                  required
                  type="number"
                  value={formData.monthly_scan_limit}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      monthly_scan_limit: parseInt(e.target.value),
                    })
                  }
                  className="w-full bg-black/30 border border-white/10 rounded px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-xs uppercase text-[var(--text-muted)] mb-1">
                  Scan Frequency
                </label>
                <select
                  value={formData.scan_frequency_limit}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      scan_frequency_limit: e.target.value,
                    })
                  }
                  className="w-full bg-black/30 border border-white/10 rounded px-3 py-2 text-white [&>option]:bg-black"
                >
                  <option value="daily">Daily</option>
                  <option value="hourly">Hourly</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
              <div>
                <label className="block text-xs uppercase text-[var(--text-muted)] mb-1">
                  Features (Comma separated)
                </label>
                <label className="block text-xs uppercase text-[var(--text-muted)] mb-1">
                  Features (Press Enter to add)
                </label>
                <div className="bg-black/30 border border-white/10 rounded px-3 py-2 min-h-[50px] flex flex-wrap gap-2">
                  {(Array.isArray(formData.features)
                    ? formData.features
                    : []
                  ).map((feat: string, i: number) => (
                    <span
                      key={i}
                      className="bg-[var(--soft-gold)]/20 text-[var(--soft-gold)] px-2 py-1 rounded text-xs flex items-center gap-1"
                    >
                      {feat}
                      <button
                        type="button"
                        onClick={() => {
                          const newFeats = [
                            ...(formData.features as unknown as string[]),
                          ];
                          newFeats.splice(i, 1);
                          setFormData({
                            ...formData,
                            features: newFeats as any,
                          });
                        }}
                        className="hover:text-white"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <input
                    className="bg-transparent outline-none flex-1 text-white min-w-[100px]"
                    placeholder="Add feature..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const val = e.currentTarget.value.trim();
                        if (val) {
                          const current = Array.isArray(formData.features)
                            ? formData.features
                            : [];
                          setFormData({
                            ...formData,
                            features: [...current, val] as any,
                          });
                          e.currentTarget.value = "";
                        }
                      }
                    }}
                  />
                </div>
                {/* Hidden textarea for compatibility if needed, but we handle state directly above */}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-[var(--soft-gold)] text-black font-bold rounded-lg hover:opacity-90"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

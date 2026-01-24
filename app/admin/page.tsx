"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { 
  Building2, MapPin, Database, Users, Activity, Key, 
  LayoutDashboard, Trash2, CheckCircle2, Loader2, AlertCircle, RefreshCw, Plus,
  Edit2, List, X, Save
} from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { AdminStats, AdminUser, DirectoryEntry, AdminLog, KeyStatus } from "@/types";

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Data States
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [directory, setDirectory] = useState<DirectoryEntry[]>([]);
  const [logs, setLogs] = useState<AdminLog[]>([]);

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

  // Edit User State
  const [userToEdit, setUserToEdit] = useState<AdminUser | null>(null);
  const [editUserForm, setEditUserForm] = useState({ 
    email: "", 
    display_name: "", 
    password: "",
    company_name: "",
    job_title: "",
    phone: "",
    timezone: "UTC"
  });
  const [userSaveLoading, setUserSaveLoading] = useState(false);

  useEffect(() => {
    loadTabData();
  }, [activeTab]);

  useEffect(() => {
    if (userToEdit) {
      setEditUserForm({
        email: userToEdit.email || "",
        display_name: userToEdit.display_name || "",
        password: "",
        company_name: userToEdit.company_name || "",
        job_title: userToEdit.job_title || "",
        phone: userToEdit.phone || "",
        timezone: userToEdit.timezone || "UTC"
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
            timezone: editUserForm.timezone
        });
        setUserToEdit(null);
        loadTabData();
    } catch (err: any) {
        alert("Failed to update: " + err.message);
    } finally {
        setUserSaveLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure? This will delete ALL user data including hotels and logs.")) return;
    try {
      await api.deleteAdminUser(userId);
      loadTabData(); // Refresh
    } catch (err: any) {
      alert("Failed to delete user: " + err.message);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail || !newUserPass) return;
    
    try {
        await api.createAdminUser({
            email: newUserEmail,
            password: newUserPass,
            display_name: newUserName || undefined
        });
        setUserSuccess(true);
        setNewUserEmail("");
        setNewUserPass("");
        setNewUserName("");
        loadTabData();
        setTimeout(() => setUserSuccess(false), 3000);
    } catch (err: any) {
        alert("Failed to create user: " + err.message);
    }
  };

  const handleDeleteDirectory = async (id: number) => {
    if (!confirm("Remove this hotel from shared directory?")) return;
    try {
      await api.deleteAdminDirectory(id);
      loadTabData(); // Refresh
    } catch (err: any) {
      alert("Failed to delete entry: " + err.message);
    }
  };

  const handleAddDirectory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.addHotelToDirectory(dirName, dirLocation, dirSerpId || undefined);
      setDirSuccess(true);
      setDirName("");
      setDirLocation("");
      setDirSerpId("");
      loadTabData(); // Refresh list
      setTimeout(() => setDirSuccess(false), 3000);
    } catch (err: any) {
      alert("Failed to add: " + err.message);
    }
  };

  const handleSyncDirectory = async () => {
    if (!confirm("Scan all user hotels and add to directory?")) return;
    try {
      const res = await api.syncDirectory();
      alert(`Synced ${res.synced_count} hotels.`);
      loadTabData();
    } catch (err: any) {
      alert("Sync failed: " + err.message);
    }
  };

  const TabButton = ({ id, label, icon: Icon }: { id: string; label: string; icon: React.ElementType }) => (
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
          <h1 className="text-3xl font-bold tracking-tight text-white">System Administration</h1>
          <p className="text-[var(--text-muted)] mt-1">Manage users, directory, and monitor system health</p>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex flex-wrap gap-2 mb-8 border-b border-white/10 pb-4">
        <TabButton id="overview" label="Overview" icon={LayoutDashboard} />
        <TabButton id="users" label="Users" icon={Users} />
        <TabButton id="directory" label="Directory" icon={Building2} />
        <TabButton id="logs" label="System Logs" icon={Activity} />
        <TabButton id="keys" label="API Keys" icon={Key} />
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
                <button onClick={loadTabData} className="ml-auto hover:bg-red-500/20 p-2 rounded">
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>
        )}
        {loading && <div className="text-[var(--soft-gold)] flex items-center gap-2 mb-4"><Loader2 className="w-4 h-4 animate-spin"/> Loading...</div>}
        
        {/* OVERVIEW TAB */}
        {activeTab === "overview" && stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {!stats.service_role_active && (
                <div className="col-span-full bg-red-500/10 border border-red-500/50 p-4 rounded-lg flex items-center gap-3 text-red-200">
                    <AlertCircle className="w-5 h-5 text-red-400" />
                    <div>
                        <p className="font-bold">Service Role Key Missing</p>
                        <p className="text-xs opacity-80">Admin data requires SUPABASE_SERVICE_ROLE_KEY in Vercel environment variables.</p>
                    </div>
                </div>
            )}
            <StatCard label="Total Users" value={stats.total_users} icon={Users} />
            <StatCard label="Total Hotels" value={stats.total_hotels} icon={Building2} />
            <StatCard label="Total Scans" value={stats.total_scans} icon={Activity} />
            <StatCard label="Directory Size" value={stats.directory_size} icon={Database} />
            <div className="col-span-full mt-4 p-6 glass-card border border-white/10">
              <h3 className="text-lg font-bold text-white mb-2">System Health</h3>
              <div className="flex items-center gap-2 text-[var(--optimal-green)]">
                <CheckCircle2 className="w-5 h-5" />
                <span>All systems operational. API calls today: {stats.api_calls_today}</span>
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
                    <h3 className="text-lg font-bold text-white">Create New User</h3>
                    {userSuccess && <span className="text-[var(--optimal-green)] text-xs flex items-center"><CheckCircle2 className="w-3 h-3 mr-1"/> User created!</span>}
                </div>
                <form onSubmit={handleCreateUser} className="flex flex-col md:flex-row gap-4">
                    <input 
                        type="email" placeholder="Email" required
                        value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)}
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                    />
                    <input 
                        type="text" placeholder="Display Name (Opt)" 
                        value={newUserName} onChange={e => setNewUserName(e.target.value)}
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                    />
                    <input 
                        type="password" placeholder="Password" required minLength={6}
                        value={newUserPass} onChange={e => setNewUserPass(e.target.value)}
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                    />
                    <button type="submit" className="bg-[var(--soft-gold)] text-black font-bold px-6 py-2 rounded-lg hover:opacity-90 flex items-center gap-2 justify-center">
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
                        <div className="font-medium text-white">{u.display_name || "Unknown"}</div>
                        <div className="text-[var(--text-muted)] text-xs">{u.email}</div>
                        <div className="text-[var(--text-muted)] text-xs font-mono">{u.id}</div>
                        </td>
                        <td className="p-4">
                            <div className="flex flex-col">
                                <span className="uppercase text-[10px] font-bold text-white">{u.plan_type || "TRIAL"}</span>
                                <span className={`text-xs ${u.subscription_status === 'active' ? 'text-[var(--optimal-green)]' : 'text-[var(--alert-red)]'}`}>
                                    {u.subscription_status || "trial"}
                                </span>
                            </div>
                        </td>
                        <td className="p-4 text-white">{u.hotel_count}</td>
                        <td className="p-4 text-white">{u.scan_count}</td>
                        <td className="p-4 text-[var(--text-muted)]">{new Date(u.created_at).toLocaleDateString()}</td>
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
                                   if(confirm("Promote user to PRO for 30 days?")) {
                                       api.updateAdminUser(u.id, {
                                           plan_type: "pro", 
                                           subscription_status: "active",
                                           extend_trial_days: 30
                                       }).then(loadTabData);
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
                        <tr><td colSpan={5} className="p-8 text-center text-[var(--text-muted)]">No users found.</td></tr>
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
                    <span className="text-white text-sm font-medium">Looking to edit specific hotel monitors?</span>
                </div>
                <Link href="/admin/list" className="bg-[var(--soft-gold)] text-black px-4 py-2 rounded-lg text-sm font-bold hover:opacity-90">
                    Go to Master Hotel List
                </Link>
             </div>

             {/* Add New Form */}
             <div className="glass-card p-6 border border-white/10">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-white">Add New Entry</h3>
                    <button onClick={handleSyncDirectory} className="text-xs bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded flex items-center gap-2 text-[var(--soft-gold)]">
                        <RefreshCw className="w-3 h-3" /> Sync DB
                    </button>
                </div>
                
                <form onSubmit={handleAddDirectory} className="flex flex-col md:flex-row gap-4">
                    <input 
                        placeholder="Hotel Name" 
                        value={dirName} onChange={e => setDirName(e.target.value)}
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                        required
                    />
                    <input 
                        placeholder="Location" 
                        value={dirLocation} onChange={e => setDirLocation(e.target.value)}
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                        required
                    />
                    <input 
                        placeholder="SerpApi ID (Opt)" 
                        value={dirSerpId} onChange={e => setDirSerpId(e.target.value)}
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                    />
                    <button type="submit" className="bg-[var(--soft-gold)] text-black font-bold px-6 py-2 rounded-lg hover:opacity-90">
                        Add
                    </button>
                </form>
                {dirSuccess && <div className="text-[var(--optimal-green)] mt-2 text-sm flex items-center gap-1"><CheckCircle2 className="w-4 h-4"/> Added!</div>}
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
                        <td className="p-4 text-[var(--text-muted)]">{d.location}</td>
                        <td className="p-4 font-mono text-xs text-[var(--text-muted)]">{d.serp_api_id || "-"}</td>
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
                        {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                            log.level === 'ERROR' ? 'bg-red-500/20 text-red-400' : 
                            log.level === 'SUCCESS' ? 'bg-green-500/20 text-green-400' : 
                            'bg-blue-500/20 text-blue-400'
                        }`}>
                            {log.level}
                        </span>
                      </td>
                      <td className="p-4 text-white">{log.action}</td>
                      <td className="p-4 text-[var(--text-muted)] text-xs font-mono">{log.details}</td>
                    </tr>
                  ))}
                  {logs.length === 0 && !loading && (
                      <tr><td colSpan={4} className="p-8 text-center text-[var(--text-muted)]">No logs found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
        )}

        {/* API KEYS TAB */}
        {activeTab === "keys" && <ApiKeysPanel />}

      </div>

      
      {/* Edit User Modal */}
      {userToEdit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="glass-card p-6 border border-white/10 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Edit User</h3>
              <button onClick={() => setUserToEdit(null)} className="text-[var(--text-muted)] hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-1 block">Email</label>
                <input 
                  type="email"
                  value={editUserForm.email}
                  onChange={(e) => setEditUserForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                />
              </div>

               {/* Admin Override Subscription */}
               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-1 block">Plan Type</label>
                    <select
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white [&>option]:bg-black"
                        onChange={(e) => api.updateAdminUser(userToEdit.id, { plan_type: e.target.value })}
                        defaultValue={userToEdit.plan_type || "trial"}
                    >
                        <option value="trial">Trial</option>
                        <option value="starter">Starter</option>
                        <option value="pro">Pro</option>
                        <option value="enterprise">Enterprise</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-1 block">Status</label>
                    <select
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white [&>option]:bg-black"
                        onChange={(e) => api.updateAdminUser(userToEdit.id, { subscription_status: e.target.value })}
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
                <label className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-1 block">Display Name</label>
                <input 
                  type="text"
                  value={editUserForm.display_name}
                  onChange={(e) => setEditUserForm(f => ({ ...f, display_name: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-1 block">New Password (Opt)</label>
                <input 
                  type="password"
                  value={editUserForm.password}
                  onChange={(e) => setEditUserForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                  placeholder="Leave blank to keep current"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-1 block">Company / Hotel</label>
                <input 
                  type="text"
                  value={editUserForm.company_name}
                  onChange={(e) => setEditUserForm(f => ({ ...f, company_name: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-1 block">Job Title</label>
                    <input 
                      type="text"
                      value={editUserForm.job_title}
                      onChange={(e) => setEditUserForm(f => ({ ...f, job_title: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-1 block">Phone</label>
                    <input 
                      type="text"
                      value={editUserForm.phone}
                      onChange={(e) => setEditUserForm(f => ({ ...f, phone: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                    />
                  </div>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-1 block">Timezone</label>
                <select
                  value={editUserForm.timezone}
                  onChange={(e) => setEditUserForm(f => ({ ...f, timezone: e.target.value }))}
                   className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white [&>option]:bg-[#0f172a]"
                >
                    {["UTC", "Europe/Istanbul", "Europe/London", "Europe/Paris", "America/New_York", "America/Los_Angeles", "Asia/Tokyo", "Asia/Dubai"].map(tz => (
                        <option key={tz} value={tz}>{tz}</option>
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
                {userSaveLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

const StatCard = ({ label, value, icon: Icon }: { label: string; value: number; icon: React.ElementType }) => (
  <div className="glass-card p-6 border border-white/10 flex items-center gap-4">
    <div className="w-12 h-12 rounded-xl bg-[var(--soft-gold)]/10 flex items-center justify-center shrink-0">
      <Icon className="w-6 h-6 text-[var(--soft-gold)]" />
    </div>
    <div>
      <p className="text-[var(--text-muted)] text-xs uppercase font-bold tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-white">{value?.toLocaleString() || 0}</p>
    </div>
  </div>
);


const ApiKeysPanel = () => {
  const [keyStatus, setKeyStatus] = useState<KeyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadKeyStatus();
  }, []);

  const loadKeyStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/api-keys/status");
      const data = await res.json();
      setKeyStatus(data);
    } catch (err) {
      console.error("Failed to load key status:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRotate = async () => {
    if (!confirm("Force rotate to next API key?")) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/api-keys/rotate", { method: "POST" });
      const data = await res.json();
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
      const res = await fetch("/api/admin/api-keys/reload", { method: "POST" });
      const data = await res.json();
      
      if (data.status === "error" || !res.ok) {
        throw new Error(data.error || data.detail || "Unknown error");
      }

      setKeyStatus(curr => curr ? ({ ...curr, total_keys: data.total_keys }) : null);
      loadKeyStatus();
      
      const debugMsg = [
        `Reloaded! Found ${data.total_keys} keys.`,
        `Keys: ${data.keys_found?.join(", ")}`,
        `Env Check: ${JSON.stringify(data.env_debug, null, 2)}`
      ].join("\n");
      
      alert(debugMsg);
    } catch (err: any) {
      alert("Reload Failed: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("Reset all keys to active? (Use at new billing period)")) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/api-keys/reset", { method: "POST" });
      const data = await res.json();
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
            <h3 className="text-xl font-bold text-white">SerpApi Key Management</h3>
          </div>
          <button 
            onClick={loadKeyStatus} 
            className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white text-sm rounded-lg"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-black/20 p-4 rounded-lg">
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">Total Keys</div>
            <div className="text-2xl font-bold text-white">{keyStatus?.total_keys || 0}</div>
          </div>
          <div className="bg-black/20 p-4 rounded-lg">
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">Active Keys</div>
            <div className="text-2xl font-bold text-[var(--optimal-green)]">{keyStatus?.active_keys || 0}</div>
          </div>
          <div className="bg-black/20 p-4 rounded-lg">
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">Current Key</div>
            <div className="text-2xl font-bold text-[var(--soft-gold)]">#{keyStatus?.current_key_index || 1}</div>
          </div>
          <div className="bg-black/20 p-4 rounded-lg">
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">Quota/Key</div>
            <div className="text-2xl font-bold text-white">{keyStatus?.quota_per_key || 250}/mo</div>
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
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold ${
                  key.is_current ? "bg-[var(--soft-gold)] text-black" : "bg-white/10 text-white"
                }`}>
                  {key.index}
                </div>
                <div>
                  <div className="text-white font-mono text-sm">{key.key_suffix}</div>
                  {key.exhausted_at && (
                    <div className="text-red-400 text-xs">Exhausted: {new Date(key.exhausted_at).toLocaleString()}</div>
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
              <p className="text-xs mt-1">Add SERPAPI_API_KEY to environment variables.</p>
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
          {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Force Rotate to Next Key
        </button>
        <button 
          onClick={handleReload}
          disabled={actionLoading}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-[var(--soft-gold)]/20 text-[var(--soft-gold)] font-bold rounded-lg hover:bg-[var(--soft-gold)]/30 disabled:opacity-50"
        >
          {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Reload from Env
        </button>
        <button 
          onClick={handleReset}
          disabled={actionLoading}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-[var(--soft-gold)] text-black font-bold rounded-lg hover:opacity-90 disabled:opacity-50"
        >
          {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          Reset All Keys (New Month)
        </button>
      </div>
      {/* Edit User Modal */}


    </div>
  );
};


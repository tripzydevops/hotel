"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { 
  Building2, MapPin, Database, Users, Activity, Key, 
  LayoutDashboard, Trash2, CheckCircle2, Loader2, AlertCircle, RefreshCw, Plus 
} from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Data States
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [directory, setDirectory] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);

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

  useEffect(() => {
    loadTabData();
  }, [activeTab]);

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

  const TabButton = ({ id, label, icon: Icon }: any) => (
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
                        <td className="p-4 text-white">{u.hotel_count}</td>
                        <td className="p-4 text-white">{u.scan_count}</td>
                        <td className="p-4 text-[var(--text-muted)]">{new Date(u.created_at).toLocaleDateString()}</td>
                        <td className="p-4 text-right">
                        <button 
                            onClick={() => handleDeleteUser(u.id)}
                            className="p-2 hover:bg-red-500/20 rounded text-red-400 hover:text-red-200 transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
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
        {activeTab === "keys" && (
            <div className="glass-card p-8 border border-white/10 text-center">
                <Key className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">API Key Management</h3>
                <p className="text-[var(--text-muted)] mb-6">Manage external service keys and quotas.</p>
                
                <div className="max-w-md mx-auto bg-black/20 p-4 rounded-lg text-left mb-6">
                    <div className="text-xs text-[var(--text-muted)] mb-1 uppercase tracking-wider">SerpApi Key</div>
                    <div className="font-mono text-white flex justify-between items-center">
                        <span>••••••••••••••••••••••••••••</span>
                        <span className="text-[var(--optimal-green)] text-xs">Active</span>
                    </div>
                </div>
                
                <button className="px-6 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors">
                    Check Quota (Coming Soon)
                </button>
            </div>
        )}

      </div>
    </div>
  );
}

const StatCard = ({ label, value, icon: Icon }: any) => (
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

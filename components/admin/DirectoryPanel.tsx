"use client";

import React, { useState, useEffect } from "react";
import {
  Building2,
  List,
  RefreshCw,
  Trash2,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { DirectoryEntry } from "@/types";
import { useToast } from "@/components/ui/ToastContext";
import { motion } from "framer-motion";

const DirectoryPanel = () => {
  const { toast } = useToast();
  const [directory, setDirectory] = useState<DirectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [dirName, setDirName] = useState("");
  const [dirLocation, setDirLocation] = useState("");
  const [dirSerpId, setDirSerpId] = useState("");

  // Edit State
  const [entryToEdit, setEntryToEdit] = useState<DirectoryEntry | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    location: "",
    serp_api_id: "",
  });

  const [dirSuccess, setDirSuccess] = useState(false);

  const loadDirectory = async () => {
    setLoading(true);
    try {
      const data = await api.getAdminDirectory();
      setDirectory(data);
    } catch (err: any) {
      toast.error("Failed to load directory: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDirectory();
  }, []);

  const handleAddDirectory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.addHotelToDirectory(
        dirName,
        dirLocation,
        dirSerpId || undefined,
      );
      setDirName("");
      setDirLocation("");
      setDirSerpId("");
      loadDirectory();
      toast.success("Added to directory");
    } catch (err: any) {
      toast.error("Failed to add: " + err.message);
    }
  };

  const handleDeleteDirectory = async (id: string) => {
    if (!confirm("Remove this hotel from shared directory?")) return;
    try {
      await api.deleteAdminDirectory(id);
      loadDirectory();
    } catch (err: any) {
      toast.error("Failed to delete entry: " + err.message);
    }
  };

  const handleSyncDirectory = async () => {
    if (!confirm("Scan all user hotels and add to directory?")) return;
    try {
      const res = await api.syncDirectory();
      toast.success(`Synced ${res.synced_count} hotels.`);
      loadDirectory();
    } catch (err: any) {
      toast.error("Sync failed: " + err.message);
    }
  };

  const handleUpdateDirectory = async () => {
    if (!entryToEdit) return;
    try {
      await api.updateAdminDirectory(String(entryToEdit.id), editForm);
      setEntryToEdit(null);
      loadDirectory();
      toast.success("Updated successfully");
    } catch (err: any) {
      toast.error("Failed to update: " + err.message);
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <div className="flex items-center justify-between p-6 bg-gradient-to-r from-[var(--soft-gold)]/10 to-[var(--soft-gold)]/5 border border-[var(--soft-gold)]/20 rounded-2xl shadow-xl overflow-hidden relative">
        <div className="absolute top-0 right-0 p-4 opacity-10 rotate-12">
          <Building2 className="w-20 h-20 text-[var(--soft-gold)]" />
        </div>
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-12 h-12 rounded-xl bg-[var(--soft-gold)]/10 border border-[var(--soft-gold)]/20 flex items-center justify-center">
            <List className="w-6 h-6 text-[var(--soft-gold)]" />
          </div>
          <div>
            <span className="text-white text-base font-bold tracking-tight">
              Master Asset Inventory
            </span>
            <p className="text-[var(--text-muted)] text-xs font-medium uppercase tracking-widest mt-0.5">
              Edit specific monitoring instances in the list
            </p>
          </div>
        </div>
        <Link
          href="/admin/list"
          className="bg-[var(--soft-gold)] text-[var(--deep-ocean)] px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-[var(--soft-gold)]/20 z-10"
        >
          Master List
        </Link>
      </div>

      {/* Add New Form */}
      <div className="glass-card p-8 border border-white/5 relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-1 h-full bg-[var(--soft-gold)]/50 opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-black text-white tracking-widest uppercase text-sm">
            Create New Entry
          </h3>
          <button
            onClick={handleSyncDirectory}
            className="text-[10px] font-black uppercase tracking-widest bg-white/5 hover:bg-[var(--soft-gold)]/10 px-4 py-2 rounded-lg flex items-center gap-2 text-[var(--soft-gold)] border border-white/5 transition-all"
          >
            <RefreshCw className="w-3 h-3" /> Sync Database
          </button>
        </div>

        <form
          onSubmit={handleAddDirectory}
          className="flex flex-col md:flex-row gap-5"
        >
          <div className="flex-1 space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] ml-1">
              Asset Name
            </label>
            <input
              placeholder="e.g. Grand Plaza Hotel"
              value={dirName}
              onChange={(e) => setDirName(e.target.value)}
              className="w-full bg-black/20 border border-white/10 rounded-xl px-5 py-3 text-white focus:border-[var(--soft-gold)]/50 focus:ring-0 transition-all outline-none"
              required
            />
          </div>
          <div className="flex-1 space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] ml-1">
              Location / Market
            </label>
            <input
              placeholder="e.g. London, UK"
              value={dirLocation}
              onChange={(e) => setDirLocation(e.target.value)}
              className="w-full bg-black/20 border border-white/10 rounded-xl px-5 py-3 text-white focus:border-[var(--soft-gold)]/50 focus:ring-0 transition-all outline-none"
              required
            />
          </div>
          <div className="flex-1 space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] ml-1">
              SerpApi Cluster ID
            </label>
            <input
              placeholder="Optional ID"
              value={dirSerpId}
              onChange={(e) => setDirSerpId(e.target.value)}
              className="w-full bg-black/20 border border-white/10 rounded-xl px-5 py-3 text-white focus:border-[var(--soft-gold)]/50 focus:ring-0 transition-all outline-none font-mono"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full md:w-auto bg-[var(--soft-gold)] text-[var(--deep-ocean)] font-black px-8 py-3.5 rounded-xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-[var(--soft-gold)]/10 text-xs uppercase tracking-widest"
            >
              Add Asset
            </button>
          </div>
        </form>
        {dirSuccess && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-[var(--optimal-green)] mt-4 text-xs font-bold flex items-center gap-2 bg-[var(--optimal-green)]/10 w-fit px-3 py-1 rounded-lg border border-[var(--optimal-green)]/20"
          >
            <CheckCircle2 className="w-4 h-4" /> Added Successfully
          </motion.div>
        )}
      </div>

      {/* List */}
      <div className="glass-card border border-white/5 overflow-hidden shadow-2xl transition-all duration-500 hover:border-[var(--soft-gold)]/10">
        {loading && directory.length === 0 ? (
          <div className="p-24 text-center">
            <Loader2 className="w-10 h-10 animate-spin text-[var(--soft-gold)] mx-auto opacity-50" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-white/[0.02] text-[var(--text-muted)] font-black text-[10px] uppercase tracking-[0.2em] border-b border-white/5">
                <tr>
                  <th className="p-5">Asset Descriptor</th>
                  <th className="p-5">Market Context</th>
                  <th className="p-5">Cluster Identification</th>
                  <th className="p-5 text-right">Operations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {directory.map((d) => (
                  <tr
                    key={d.id}
                    className="hover:bg-white/[0.02] transition-colors group"
                  >
                    <td className="p-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white group-hover:border-[var(--soft-gold)]/30 group-hover:bg-[var(--soft-gold)]/5 transition-all">
                          <Building2 className="w-5 h-5 opacity-40 group-hover:opacity-100 group-hover:text-[var(--soft-gold)] transition-all" />
                        </div>
                        <span className="text-white font-bold tracking-tight text-base group-hover:text-[var(--soft-gold)] transition-colors">
                          {d.name}
                        </span>
                      </div>
                    </td>
                    <td className="p-5 text-[var(--text-secondary)] font-medium text-sm italic opacity-70 group-hover:opacity-100 transition-opacity">
                      {d.location}
                    </td>
                    <td className="p-5">
                      <span className="font-mono text-[11px] bg-black/30 text-[var(--text-muted)] px-3 py-1.5 rounded-lg border border-white/5 group-hover:text-white transition-colors">
                        {d.serp_api_id || "NOT_CLUSTERED"}
                      </span>
                    </td>
                    <td className="p-5 text-right">
                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => setEntryToEdit(d)}
                          className="p-2.5 bg-white/5 hover:bg-[var(--soft-gold)]/10 rounded-xl text-[var(--soft-gold)] border border-white/5 hover:border-[var(--soft-gold)]/30 transition-all active:scale-95"
                          title="Refresh / Sync"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteDirectory(d.id)}
                          className="p-2.5 bg-white/5 hover:bg-red-500/10 rounded-xl text-red-400 border border-white/5 hover:border-red-500/30 transition-all active:scale-95"
                          title="Purge"
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

      {/* Edit Modal */}
      {entryToEdit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card p-6 border border-white/10 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Edit Entry</h3>
              <button
                onClick={() => setEntryToEdit(null)}
                className="text-[var(--text-muted)] hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <input
                placeholder="Name"
                value={editForm.name}
                onChange={(e) =>
                  setEditForm({ ...editForm, name: e.target.value })
                }
                className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white"
              />
              <input
                placeholder="Location"
                value={editForm.location}
                onChange={(e) =>
                  setEditForm({ ...editForm, location: e.target.value })
                }
                className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white"
              />
              <input
                placeholder="SerpApi ID"
                value={editForm.serp_api_id}
                onChange={(e) =>
                  setEditForm({ ...editForm, serp_api_id: e.target.value })
                }
                className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setEntryToEdit(null)}
                  className="flex-1 py-2 bg-white/5 rounded text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateDirectory}
                  className="flex-1 py-2 bg-[var(--soft-gold)] text-black font-bold rounded"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DirectoryPanel;

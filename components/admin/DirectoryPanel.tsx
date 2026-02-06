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

  const handleDeleteDirectory = async (id: number) => {
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
        {loading && directory.length === 0 ? (
          <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--soft-gold)] mx-auto" />
          </div>
        ) : (
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
                  <td className="p-4 font-mono text-xs text-[var(--text-muted)]">
                    {d.serp_api_id || "-"}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setEntryToEdit(d)}
                        className="p-2 hover:bg-white/10 rounded text-[var(--soft-gold)] transition-colors"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteDirectory(d.id)}
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

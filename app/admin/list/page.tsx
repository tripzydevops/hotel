"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import {
  X,
  Save,
  TrendingUp,
  TrendingDown,
  Activity,
  Terminal,
  Database,
  RefreshCw,
  Loader2,
  AlertCircle,
  Search,
  Edit2,
  Trash2,
  Building2,
  MapPin,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface HotelEntry {
  id: string;
  name: string;
  location: string;
  user_id: string;
  user_display?: string;
  serp_api_id?: string;
  is_target_hotel: boolean;
  preferred_currency?: string;
  last_price?: number;
  last_currency?: string;
  last_scanned?: string;
  created_at: string;
}

export default function AdminMasterListPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hotels, setHotels] = useState<HotelEntry[]>([]);

  // Filters
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"created" | "name" | "price">("created");
  const [showTargetOnly, setShowTargetOnly] = useState(false);

  // Edit modal state
  const [editingHotel, setEditingHotel] = useState<HotelEntry | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    location: "",
    serp_api_id: "",
    is_target_hotel: false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadHotels();
  }, []);

  const loadHotels = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.getAdminHotels(200);
      setHotels(data);
    } catch (err: any) {
      setError(err.message || "Could not load hotels.");
      setHotels([]);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (hotel: HotelEntry) => {
    setEditingHotel(hotel);
    setEditForm({
      name: hotel.name,
      location: hotel.location || "",
      serp_api_id: hotel.serp_api_id || "",
      is_target_hotel: hotel.is_target_hotel,
    });
  };

  const handleSave = async () => {
    if (!editingHotel) return;
    setSaving(true);
    try {
      await api.updateAdminHotel(editingHotel.id, editForm);
      setEditingHotel(null);
      loadHotels(); // Refresh
    } catch (err: any) {
      alert("Failed to update hotel: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (hotelId: string, hotelName: string) => {
    if (
      !confirm(
        `Delete "${hotelName}"? This will also delete all price logs and alerts for this hotel.`,
      )
    )
      return;
    try {
      await api.deleteAdminHotel(hotelId);
      loadHotels(); // Refresh
    } catch (err: any) {
      alert("Failed to delete hotel: " + err.message);
    }
  };

  // Filter and sort logic
  const filteredHotels = hotels
    .filter((h) => {
      const matchesSearch =
        !search ||
        h.name.toLowerCase().includes(search.toLowerCase()) ||
        (h.location || "").toLowerCase().includes(search.toLowerCase()) ||
        (h.user_display || "").toLowerCase().includes(search.toLowerCase());
      const matchesTarget = !showTargetOnly || h.is_target_hotel;
      return matchesSearch && matchesTarget;
    })
    .sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "price") return (b.last_price || 0) - (a.last_price || 0);
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });

  const getCurrencySymbol = (currency?: string) => {
    switch (currency) {
      case "TRY":
        return "₺";
      case "EUR":
        return "€";
      case "GBP":
        return "£";
      default:
        return "$";
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-4">
      {/* Header */}
      <div className="flex flex-col mb-10 border-b border-red-500/10 pb-6">
        <div className="flex items-center gap-3 mb-3">
          <Terminal className="w-4 h-4 text-red-500" />
          <span className="text-[10px] font-mono font-bold uppercase tracking-[0.4em] text-red-500/60">
            Hotel_Prop_Management :: v2.0
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-white flex items-center gap-4 tracking-tighter">
              MASTER DATASET
              <span className="flex items-center gap-2 px-2 py-1 rounded bg-red-500/5 border border-red-500/20 text-[10px] font-mono text-red-400">
                <Database className="w-3 h-3" />
                QUERY_COUNT: {hotels.length}
              </span>
            </h1>
            <p className="text-slate-500 mt-2 text-sm font-medium">
              Direct kernel access to all tracked property entities.
            </p>
          </div>
          <button
            onClick={loadHotels}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/5 border border-red-500/20 hover:bg-red-500/10 text-red-500 text-xs font-bold transition-all rounded-sm"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            SYNCHRONIZE_KERNEL
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/5 border border-red-500/20 p-4 rounded-sm flex items-center gap-3 text-red-200 mb-6">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <p className="text-xs font-mono">{error}</p>
        </div>
      )}

      {/* Filters */}
      <div className="panel p-4 border-[var(--panel-border)] mb-6 bg-black/10">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-64 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Query Name, Location, or SID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-black/20 border border-white/5 rounded-sm pl-10 pr-4 py-2 text-xs text-white placeholder:text-[var(--text-muted)] focus:border-[var(--soft-gold)] transition-colors"
            />
          </div>

          <div className="flex items-center gap-3">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-black/20 border border-white/5 rounded-sm px-4 py-2 text-xs text-white font-mono"
            >
              <option value="created">SORT: TIMESTAMP</option>
              <option value="name">SORT: ALPHABETIC</option>
              <option value="price">SORT: YIELD_INDEX</option>
            </select>

            <button
              onClick={() => setShowTargetOnly(!showTargetOnly)}
              className={`flex items-center gap-2 px-4 py-2 rounded-sm text-[10px] font-bold tracking-widest transition-colors border ${
                showTargetOnly
                  ? "bg-[var(--soft-gold)] border-[var(--soft-gold)] text-black"
                  : "bg-white/5 border-white/10 text-[var(--text-muted)] hover:text-white"
              }`}
            >
              <Building2 className="w-3 h-3" />
              TARGET_ONLY
            </button>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Fleet Size", value: hotels.length, color: "text-white" },
          {
            label: "Active Targets",
            value: hotels.filter((h) => h.is_target_hotel).length,
            color: "text-[var(--soft-gold)]",
          },
          {
            label: "User Entities",
            value: new Set(hotels.map((h) => h.user_id)).size,
            color: "text-white",
          },
          {
            label: "Live Nodes",
            value: hotels.filter((h) => h.last_price).length,
            color: "text-[var(--success)]",
          },
        ].map((stat, i) => (
          <div
            key={i}
            className="panel p-4 border-[var(--panel-border)] bg-[#0d2547]"
          >
            <div className="text-[9px] uppercase tracking-[0.2em] text-[var(--text-muted)] font-bold mb-1">
              {stat.label}
            </div>
            <div className={`text-2xl font-bold data-value ${stat.color}`}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Hotels Table */}
      <div className="panel border-[var(--panel-border)] overflow-hidden bg-[#0d2547]">
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--soft-gold)] mx-auto mb-4" />
            <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)]">
              Initializing Table Connection...
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="bg-black/20 text-[var(--text-muted)] font-bold uppercase tracking-widest">
              <tr className="border-b border-[var(--panel-border)]">
                <th className="p-4">Entity Identity</th>
                <th className="p-4">Owner Ref</th>
                <th className="p-4">Latest Yield</th>
                <th className="p-4">Last Sync</th>
                <th className="p-4">Class</th>
                <th className="p-4 text-right">Ops</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredHotels.map((hotel) => (
                <tr
                  key={hotel.id}
                  className="hover:bg-white/5 transition-colors group"
                >
                  <td className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-sm bg-black/20 border border-white/5 flex items-center justify-center shrink-0">
                        <Building2 className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--soft-gold)] transition-colors" />
                      </div>
                      <div>
                        <div className="font-bold text-white flex items-center gap-2">
                          {hotel.name}
                          {hotel.serp_api_id && (
                            <span className="text-[8px] bg-blue-500/10 border border-blue-500/20 text-blue-400 px-1 py-0.5 rounded-sm font-mono">
                              SID
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-[var(--text-muted)] text-[10px] mt-0.5 font-medium">
                          {hotel.location || "UNKNOWN_LOC"}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="text-[var(--text-muted)] font-mono text-[10px] uppercase truncate max-w-[120px]">
                      {hotel.user_display || hotel.user_id.slice(0, 8)}
                    </div>
                  </td>
                  <td className="p-4">
                    {hotel.last_price ? (
                      <span className="text-white font-bold data-value">
                        {getCurrencySymbol(hotel.last_currency)}
                        {hotel.last_price.toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-[var(--text-muted)] font-mono">
                        ---
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-[var(--text-muted)] font-mono text-[10px] uppercase">
                    {hotel.last_scanned
                      ? formatDistanceToNow(new Date(hotel.last_scanned), {
                          addSuffix: true,
                        })
                      : "STALE"}
                  </td>
                  <td className="p-4">
                    {hotel.is_target_hotel ? (
                      <span className="px-1.5 py-0.5 border border-[var(--soft-gold)]/30 bg-[var(--soft-gold)]/10 text-[var(--soft-gold)] rounded-sm text-[8px] font-black uppercase tracking-widest">
                        TARGET
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 border border-white/10 bg-white/5 text-[var(--text-muted)] rounded-sm text-[8px] font-bold uppercase tracking-widest">
                        COMPETITOR
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleEdit(hotel)}
                        className="p-1.5 hover:bg-white/10 rounded-sm text-[var(--text-muted)] hover:text-white transition-colors"
                        title="Modify"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(hotel.id, hotel.name)}
                        className="p-1.5 hover:bg-red-500/20 rounded-sm text-red-400/50 hover:text-red-400 transition-colors"
                        title="Purge"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
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
      {editingHotel && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="panel p-6 border-[var(--panel-border)] w-full max-w-md mx-4 bg-[#0b1f3b]">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
              <h3 className="text-sm font-bold text-white uppercase tracking-widest">
                Modify Entity ID: {editingHotel.id.slice(0, 8)}
              </h3>
              <button
                onClick={() => setEditingHotel(null)}
                className="text-[var(--text-muted)] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold mb-1.5 block">
                  Hotel Name
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, name: e.target.value }))
                  }
                  className="w-full bg-black/40 border border-white/10 rounded-sm px-4 py-2 text-xs text-white focus:border-[var(--soft-gold)] transition-colors"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold mb-1.5 block">
                  Location Identity
                </label>
                <input
                  type="text"
                  value={editForm.location}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, location: e.target.value }))
                  }
                  className="w-full bg-black/40 border border-white/10 rounded-sm px-4 py-2 text-xs text-white focus:border-[var(--soft-gold)] transition-colors"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-bold mb-1.5 block">
                  System ID (SerpApi)
                </label>
                <input
                  type="text"
                  value={editForm.serp_api_id}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, serp_api_id: e.target.value }))
                  }
                  className="w-full bg-black/40 border border-white/10 rounded-sm px-4 py-2 text-xs text-white font-mono"
                  placeholder="AUTO_GENERATE"
                />
              </div>
              <div className="flex items-center gap-3 py-2">
                <input
                  type="checkbox"
                  id="is_target"
                  checked={editForm.is_target_hotel}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      is_target_hotel: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 rounded-sm bg-black border-white/20 text-[var(--soft-gold)] focus:ring-0"
                />
                <label
                  htmlFor="is_target"
                  className="text-[10px] font-bold uppercase tracking-widest text-white cursor-pointer"
                >
                  Set as Primary Fleet Target
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setEditingHotel(null)}
                className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 text-[10px] font-bold uppercase tracking-widest text-white rounded-sm transition-colors border border-white/5"
              >
                Abort
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-[var(--soft-gold)] text-black font-black text-[10px] uppercase tracking-[0.2em] rounded-sm hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Save className="w-3 h-3" />
                )}
                Commit Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

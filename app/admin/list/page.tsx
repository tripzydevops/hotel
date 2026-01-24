"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { 
  List, Building2, MapPin, RefreshCw, Loader2, AlertCircle, 
  Search, Edit2, Trash2, X, Save, TrendingUp, TrendingDown
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
  const [editForm, setEditForm] = useState({ name: "", location: "", serp_api_id: "", is_target_hotel: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadHotels();
  }, []);

  const loadHotels = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.getAdminHotels(100);
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
      is_target_hotel: hotel.is_target_hotel
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
    if (!confirm(`Delete "${hotelName}"? This will also delete all price logs and alerts for this hotel.`)) return;
    try {
      await api.deleteAdminHotel(hotelId);
      loadHotels(); // Refresh
    } catch (err: any) {
      alert("Failed to delete hotel: " + err.message);
    }
  };

  // Filter and sort logic
  const filteredHotels = hotels
    .filter(h => {
      const matchesSearch = !search || 
        h.name.toLowerCase().includes(search.toLowerCase()) ||
        (h.location || "").toLowerCase().includes(search.toLowerCase()) ||
        (h.user_display || "").toLowerCase().includes(search.toLowerCase());
      const matchesTarget = !showTargetOnly || h.is_target_hotel;
      return matchesSearch && matchesTarget;
    })
    .sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "price") return (b.last_price || 0) - (a.last_price || 0);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const getCurrencySymbol = (currency?: string) => {
    switch(currency) {
      case 'TRY': return '₺';
      case 'EUR': return '€';
      case 'GBP': return '£';
      default: return '$';
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[var(--soft-gold)]/20 flex items-center justify-center">
            <List className="w-6 h-6 text-[var(--soft-gold)]" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Master Hotel List</h1>
            <p className="text-[var(--text-muted)] mt-1">All monitored hotels across all users</p>
          </div>
        </div>
        
        <button
          onClick={loadHotels}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/50 p-4 rounded-lg flex items-center gap-3 text-red-200 mb-6">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <div>
            <p className="font-medium">Error</p>
            <p className="text-sm opacity-80">{error}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="glass-card p-4 border border-white/10 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-64 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input 
              type="text"
              placeholder="Search hotels, locations, or users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white placeholder:text-[var(--text-muted)]"
            />
          </div>
          
          <div className="flex items-center gap-3">
            <select 
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
            >
              <option value="created">Sort by Date</option>
              <option value="name">Sort by Name</option>
              <option value="price">Sort by Price</option>
            </select>
            
            <button
              onClick={() => setShowTargetOnly(!showTargetOnly)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                showTargetOnly 
                  ? 'bg-[var(--soft-gold)] text-black font-medium' 
                  : 'bg-white/5 text-[var(--text-muted)] hover:text-white'
              }`}
            >
              <Building2 className="w-4 h-4" />
              Target Hotels Only
            </button>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="glass-card p-4 border border-white/10">
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">Total Hotels</div>
          <div className="text-2xl font-bold text-white">{hotels.length}</div>
        </div>
        <div className="glass-card p-4 border border-white/10">
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">Target Hotels</div>
          <div className="text-2xl font-bold text-[var(--soft-gold)]">{hotels.filter(h => h.is_target_hotel).length}</div>
        </div>
        <div className="glass-card p-4 border border-white/10">
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">Unique Users</div>
          <div className="text-2xl font-bold text-white">{new Set(hotels.map(h => h.user_id)).size}</div>
        </div>
        <div className="glass-card p-4 border border-white/10">
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">With Prices</div>
          <div className="text-2xl font-bold text-white">{hotels.filter(h => h.last_price).length}</div>
        </div>
      </div>

      {/* Hotels Table */}
      <div className="glass-card border border-white/10 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--soft-gold)] mx-auto mb-4" />
            <p className="text-[var(--text-muted)]">Loading hotels...</p>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-[var(--text-muted)] font-medium">
              <tr>
                <th className="p-4">Hotel</th>
                <th className="p-4">User</th>
                <th className="p-4">Last Price</th>
                <th className="p-4">Last Scanned</th>
                <th className="p-4">Type</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredHotels.map((hotel) => (
                <tr key={hotel.id} className="hover:bg-white/5">
                  <td className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[var(--soft-gold)]/10 flex items-center justify-center shrink-0">
                        <Building2 className="w-5 h-5 text-[var(--soft-gold)]" />
                      </div>
                      <div>
                        <div className="font-medium text-white flex items-center gap-2">
                          {hotel.name}
                          {hotel.serp_api_id && (
                            <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">
                              SerpApi
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-[var(--text-muted)] text-xs mt-0.5">
                          <MapPin className="w-3 h-3" />
                          {hotel.location || "Unknown"}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="text-white text-xs">{hotel.user_display || hotel.user_id.slice(0, 8) + '...'}</div>
                  </td>
                  <td className="p-4">
                    {hotel.last_price ? (
                      <span className="text-white font-medium">
                        {getCurrencySymbol(hotel.last_currency)}
                        {hotel.last_price.toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-[var(--text-muted)]">-</span>
                    )}
                  </td>
                  <td className="p-4 text-[var(--text-muted)] text-xs">
                    {hotel.last_scanned 
                      ? formatDistanceToNow(new Date(hotel.last_scanned), { addSuffix: true })
                      : 'Never'
                    }
                  </td>
                  <td className="p-4">
                    {hotel.is_target_hotel ? (
                      <span className="px-2 py-1 bg-[var(--soft-gold)]/20 text-[var(--soft-gold)] rounded text-xs font-medium">
                        TARGET
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-white/10 text-[var(--text-muted)] rounded text-xs">
                        Competitor
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => handleEdit(hotel)}
                        className="p-2 hover:bg-white/10 rounded text-[var(--soft-gold)] hover:text-white transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(hotel.id, hotel.name)}
                        className="p-2 hover:bg-red-500/20 rounded text-red-400 hover:text-red-200 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredHotels.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-[var(--text-muted)]">
                    {search ? 'No hotels match your search.' : 'No hotels found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit Modal */}
      {editingHotel && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="glass-card p-6 border border-white/10 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Edit Hotel</h3>
              <button onClick={() => setEditingHotel(null)} className="text-[var(--text-muted)] hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-1 block">Hotel Name</label>
                <input 
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-1 block">Location</label>
                <input 
                  type="text"
                  value={editForm.location}
                  onChange={(e) => setEditForm(f => ({ ...f, location: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-1 block">SerpApi ID</label>
                <input 
                  type="text"
                  value={editForm.serp_api_id}
                  onChange={(e) => setEditForm(f => ({ ...f, serp_api_id: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white font-mono text-xs"
                  placeholder="Optional"
                />
              </div>
              <div className="flex items-center gap-3">
                <input 
                  type="checkbox"
                  id="is_target"
                  checked={editForm.is_target_hotel}
                  onChange={(e) => setEditForm(f => ({ ...f, is_target_hotel: e.target.checked }))}
                  className="w-4 h-4"
                />
                <label htmlFor="is_target" className="text-white">This is a target hotel (not competitor)</label>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button 
                onClick={() => setEditingHotel(null)}
                className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-[var(--soft-gold)] text-black font-bold rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

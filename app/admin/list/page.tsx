"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { 
  List, Building2, MapPin, RefreshCw, Loader2, AlertCircle, 
  Search, Filter, ChevronDown, ExternalLink, TrendingUp, TrendingDown
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface HotelEntry {
  id: string;
  name: string;
  location: string;
  user_id: string;
  user_email?: string;
  serp_api_id?: string;
  is_target_hotel: boolean;
  last_price?: number;
  last_price_change?: number;
  currency?: string;
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

  useEffect(() => {
    loadHotels();
  }, []);

  const loadHotels = async () => {
    setLoading(true);
    setError("");
    try {
      // Fetch all hotels across all users (admin endpoint)
      const response = await fetch("/api/admin/hotels");
      
      // If endpoint doesn't exist yet, use mock data
      if (!response.ok) {
        // Fallback: generate sample entries for demo
        setHotels([
          {
            id: "1",
            name: "Hilton Garden Inn Balikesir",
            location: "Balikesir, Turkey",
            user_id: "user-1",
            user_email: "demo@example.com",
            serp_api_id: "ChkItfPTzbCr0O8sGg0vZy8xMXNfNWZrdzdzEAE",
            is_target_hotel: true,
            last_price: 1250,
            currency: "TRY",
            last_scanned: new Date().toISOString(),
            created_at: new Date(Date.now() - 86400000 * 5).toISOString()
          },
          {
            id: "2",
            name: "Ramada Residences by Wyndham",
            location: "Balikesir, Turkey",
            user_id: "user-1",
            user_email: "demo@example.com",
            serp_api_id: "ChoIuMHPy5HCnsekARoNL2cvMTFoaHRubTY5ORAB",
            is_target_hotel: false,
            last_price: 980,
            last_price_change: -5.2,
            currency: "TRY",
            last_scanned: new Date().toISOString(),
            created_at: new Date(Date.now() - 86400000 * 3).toISOString()
          },
          {
            id: "3",
            name: "Venus Thermal Boutique Hotel & Spa",
            location: "Balikesir, Turkey",
            user_id: "user-2",
            user_email: "hotel@example.com",
            is_target_hotel: false,
            last_price: 1800,
            last_price_change: 12.5,
            currency: "TRY",
            last_scanned: new Date(Date.now() - 3600000).toISOString(),
            created_at: new Date(Date.now() - 86400000 * 7).toISOString()
          }
        ]);
        return;
      }
      
      const data = await response.json();
      setHotels(data);
    } catch (err: any) {
      // Use fallback mock data on error
      setHotels([]);
      setError("Could not load hotels. Backend endpoint may not be available yet.");
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort logic
  const filteredHotels = hotels
    .filter(h => {
      const matchesSearch = !search || 
        h.name.toLowerCase().includes(search.toLowerCase()) ||
        h.location.toLowerCase().includes(search.toLowerCase()) ||
        h.user_email?.toLowerCase().includes(search.toLowerCase());
      const matchesTarget = !showTargetOnly || h.is_target_hotel;
      return matchesSearch && matchesTarget;
    })
    .sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "price") return (b.last_price || 0) - (a.last_price || 0);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

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
        <div className="bg-yellow-500/10 border border-yellow-500/50 p-4 rounded-lg flex items-center gap-3 text-yellow-200 mb-6">
          <AlertCircle className="w-5 h-5 text-yellow-400" />
          <div>
            <p className="font-medium">Note</p>
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
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">Avg. Price</div>
          <div className="text-2xl font-bold text-white">
            {hotels.length > 0 
              ? `₺${Math.round(hotels.filter(h => h.last_price).reduce((sum, h) => sum + (h.last_price || 0), 0) / hotels.filter(h => h.last_price).length).toLocaleString()}`
              : '-'
            }
          </div>
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
                          {hotel.location}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="text-white text-xs font-mono">{hotel.user_email || hotel.user_id.slice(0, 8) + '...'}</div>
                  </td>
                  <td className="p-4">
                    {hotel.last_price ? (
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium">
                          {hotel.currency === 'TRY' ? '₺' : hotel.currency === 'EUR' ? '€' : '$'}
                          {hotel.last_price.toLocaleString()}
                        </span>
                        {hotel.last_price_change && (
                          <span className={`flex items-center gap-0.5 text-xs ${
                            hotel.last_price_change > 0 
                              ? 'text-red-400' 
                              : 'text-[var(--optimal-green)]'
                          }`}>
                            {hotel.last_price_change > 0 
                              ? <TrendingUp className="w-3 h-3" /> 
                              : <TrendingDown className="w-3 h-3" />
                            }
                            {Math.abs(hotel.last_price_change)}%
                          </span>
                        )}
                      </div>
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
                </tr>
              ))}
              {filteredHotels.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-[var(--text-muted)]">
                    {search ? 'No hotels match your search.' : 'No hotels found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

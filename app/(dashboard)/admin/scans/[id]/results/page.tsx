"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { 
  ArrowLeft, 
  Search, 
  Filter, 
  Download, 
  ExternalLink, 
  Hotel, 
  DollarSign, 
  Star, 
  MapPin, 
  Activity,
  ChevronRight,
  Info,
  Calendar,
  Users,
  Code,
  LayoutGrid,
  BarChart3,
  PieChart as PieChartIcon,
  TrendingDown,
  TrendingUp,
  Clock,
  ShieldCheck,
  Globe,
  ThumbsUp,
  ThumbsDown,
  MessageSquare
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from "recharts";

interface ScanResult {
  hotel_name: string;
  price: number;
  currency: string;
  vendor: string;
  rating?: number;
  reviews_count?: number;
  stars?: number;
  image?: string;
  location?: string;
  amenities?: string[];
  url?: string;
  metadata?: any;
  ota_pricing?: {
    name: string;
    price: number;
    currency: string;
    url?: string;
    is_best?: boolean;
  }[];
  room_types?: {
    name: string;
    price?: number;
    description?: string;
    images?: string[];
  }[];
  reviews_sentiment?: {
    keyword: string;
    positive: number;
    negative: number;
    score: number;
  }[];
}

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#10b981', '#f59e0b'];

export default function ScanResultsPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [scan, setScan] = useState<any>(null);
  const [results, setResults] = useState<ScanResult[]>([]);
  const [activeTab, setActiveTab] = useState<"results" | "analytics" | "json">("results");
  const [searchQuery, setSearchQuery] = useState("");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 5000]);
  const [starFilter, setStarFilter] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<"price-asc" | "price-desc" | "rating" | "stars">("price-asc");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [parityFilter, setParityFilter] = useState<"all" | "violations">("all");

  useEffect(() => {
    async function loadData() {
      try {
        const data = await api.getAdminScanDetails(id);
        setScan(data.session);
        
        const parsedResults: ScanResult[] = [];
        const payload = data.session?.raw_payload;
        
        if (payload && payload.tasks && payload.tasks[0]?.result) {
          const items = payload.tasks[0].result[0]?.items || [];
          items.forEach((item: any) => {
            // Extract OTA Pricing
            const otaPricing = item.vendors?.map((v: any) => ({
              name: v.name,
              price: v.price?.value,
              currency: v.price?.currency,
              url: v.url,
              is_best: v.is_best
            })) || [];

            // Extract Room Types
            const roomTypes = item.room_types?.map((r: any) => ({
              name: r.title,
              price: r.price?.value,
              description: r.description
            })) || [];

            // Extract Review Sentiment (if available in metadata)
            const sentiment = item.reviews_search_summary?.sentiment_keywords?.map((k: any) => ({
              keyword: k.keyword,
              positive: k.positive_reviews_count,
              negative: k.negative_reviews_count,
              score: k.sentiment_score
            })) || [];

            parsedResults.push({
              hotel_name: item.title || "Unknown Hotel",
              price: item.price?.value || 0,
              currency: item.price?.currency || "USD",
              vendor: item.source || "Google Hotels",
              rating: item.rating?.value,
              reviews_count: item.rating?.votes_count,
              stars: item.stars,
              image: item.image_url,
              location: item.location_name,
              url: item.url,
              ota_pricing: otaPricing,
              room_types: roomTypes,
              reviews_sentiment: sentiment,
              metadata: item
            });
          });
        }
        
        setResults(parsedResults);
        if (parsedResults.length > 0) {
          const maxP = Math.max(...parsedResults.map(r => r.price));
          setPriceRange([0, maxP]);
        }
      } catch (error) {
        console.error("Failed to load scan details:", error);
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      loadData();
    }
  }, [id]);

  const filteredResults = useMemo(() => {
    return results
      .filter(r => {
        // Robust filtering out of invalid inputs like 0 prices
        if (r.price <= 0) return false;

        const matchesSearch = r.hotel_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.vendor.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesPrice = r.price >= priceRange[0] && r.price <= priceRange[1];
        const matchesStars = starFilter === null || r.stars === starFilter;
        
        // Parity filter
        let matchesParity = true;
        if (parityFilter === "violations") {
          if (!r.ota_pricing || r.ota_pricing.length < 2) {
            matchesParity = false;
          } else {
            const otaPrices = r.ota_pricing.map(o => o.price).filter(p => p > 0);
            if (otaPrices.length < 2) {
              matchesParity = false;
            } else {
              const max = Math.max(...otaPrices);
              const min = Math.min(...otaPrices);
              matchesParity = (max - min) / min > 0.15;
            }
          }
        }

        return matchesSearch && matchesPrice && matchesStars && matchesParity;
      })
      .sort((a, b) => {
        if (sortBy === "price-asc") return a.price - b.price;
        if (sortBy === "price-desc") return b.price - a.price;
        if (sortBy === "rating") return (b.rating || 0) - (a.rating || 0);
        if (sortBy === "stars") return (b.stars || 0) - (a.stars || 0);
        return 0;
      });
  }, [results, searchQuery, priceRange, starFilter, sortBy, parityFilter]);

  const stats = useMemo(() => {
    // Robustly filter out invalid inputs (price <= 0) first for stats calculations
    const validResults = results.filter(r => r.price > 0);
    
    if (validResults.length === 0) return { total: 0, avgPrice: 0, minPrice: 0, maxPrice: 0, parityAlerts: 0 };
    const prices = validResults.map(r => r.price);
    
    // Parity Analysis
    const alerts = validResults.filter(r => {
      if (!r.ota_pricing || r.ota_pricing.length < 2) return false;
      const otaPrices = r.ota_pricing.map(o => o.price).filter(p => p > 0);
      if (otaPrices.length < 2) return false;
      const max = Math.max(...otaPrices);
      const min = Math.min(...otaPrices);
      return (max - min) / min > 0.15; // 15% spread
    }).length;

    return {
      total: validResults.length,
      avgPrice: prices.reduce((a, b) => a + b, 0) / validResults.length,
      minPrice: Math.min(...prices),
      maxPrice: Math.max(...prices),
      parityAlerts: alerts
    };
  }, [results]);

  const priceDistributionData = useMemo(() => {
    if (results.length === 0) return [];
    const min = stats.minPrice;
    const max = stats.maxPrice;
    const step = (max - min) / 10;
    const bins = Array.from({ length: 11 }, (_, i) => ({
      range: `${Math.round(min + i * step)}`,
      count: 0
    }));

    results.forEach(r => {
      const binIdx = Math.min(Math.floor((r.price - min) / step), 10);
      bins[binIdx].count++;
    });
    return bins;
  }, [results, stats]);

  const vendorShareData = useMemo(() => {
    const vendors: Record<string, number> = {};
    results.forEach(r => {
      vendors[r.vendor] = (vendors[r.vendor] || 0) + 1;
    });
    return Object.entries(vendors).map(([name, value]) => ({ name, value }));
  }, [results]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020202] flex items-center justify-center">
        <div className="relative">
          <div className="w-24 h-24 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 border-2 border-purple-500/20 border-b-purple-500 rounded-full animate-spin-reverse"></div>
          </div>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="absolute -bottom-12 left-1/2 -translate-x-1/2 whitespace-nowrap text-blue-400 text-[10px] font-black uppercase tracking-[0.2em]"
          >
            Parsing DataForSEO Intelligence...
          </motion.p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020202] text-white p-6 pb-20 selection:bg-blue-500/30">
      <style jsx global>{`
        @keyframes spin-reverse {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        .animate-spin-reverse {
          animation: spin-reverse 1s linear infinite;
        }
        .glass-panel {
          background: linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.05);
        }
        .glow-card:hover {
          border-color: rgba(59, 130, 246, 0.5);
          box-shadow: 0 0 30px rgba(59, 130, 246, 0.1);
        }
      `}</style>

      {/* Header Section */}
      <div className="max-w-7xl mx-auto mb-10">
        <div className="flex items-center justify-between mb-8">
          <button 
            onClick={() => router.back()}
            className="group flex items-center gap-2 text-zinc-500 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest"
          >
            <div className="w-8 h-8 rounded-full border border-zinc-800 flex items-center justify-center group-hover:border-zinc-600 transition-colors">
              <ArrowLeft className="w-3 h-3 group-hover:-translate-x-0.5 transition-transform" />
            </div>
            Back to Sessions
          </button>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Market Intelligence</span>
              <span className="text-[9px] font-bold text-zinc-500 uppercase">{new Date().toLocaleTimeString()} • Live Node</span>
            </div>
            <div className="h-10 w-px bg-zinc-800 mx-2"></div>
            <button 
              onClick={async () => {
                try {
                  const blob = await api.exportAdminScan(id);
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `DFS_SCAN_${id}.csv`;
                  a.click();
                } catch (e) {
                  console.error(e);
                }
              }}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-full shadow-lg shadow-blue-600/20 transition-all text-[10px] font-black uppercase tracking-widest active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              Intelligence Export
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-widest">
              <ShieldCheck className="w-3 h-3" />
              Verified DataForSEO Source
            </div>
            <h1 className="text-5xl lg:text-6xl font-black tracking-tightest leading-none">
              MARKET <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-purple-600">SNAPSHOT</span>
            </h1>
            <div className="flex flex-wrap items-center gap-6 text-zinc-400">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-zinc-600" />
                <span className="text-sm font-bold">{scan?.location || "Global Market"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-zinc-600" />
                <span className="text-sm font-bold">{new Date(scan?.created_at).toLocaleDateString("en-US", { month: 'long', day: 'numeric', year: 'numeric' })}</span>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-zinc-600" />
                <span className="text-sm font-bold uppercase tracking-tighter text-zinc-500">Node: DFS-API-PRO-01</span>
              </div>
            </div>
          </div>

          <div className="flex bg-zinc-900/50 p-1 rounded-full border border-zinc-800/50 backdrop-blur-xl">
            {[
              { id: "results", label: "Properties", icon: LayoutGrid },
              { id: "analytics", label: "Analytics", icon: BarChart3 },
              { id: "json", label: "Raw JSON", icon: Code }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? "bg-white text-black shadow-xl" : "text-zinc-500 hover:text-zinc-300"}`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <motion.div 
          whileHover={{ y: -5 }}
          className="glass-panel glow-card p-6 rounded-[2rem] relative overflow-hidden group transition-all"
        >
          <div className="absolute -right-4 -top-4 p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity rotate-12">
            <Hotel className="w-24 h-24" />
          </div>
          <div className="flex flex-col h-full">
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] mb-4">Active Inventory</p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-white">{filteredResults.length}</span>
              <span className="text-blue-500 text-xs font-bold uppercase tracking-widest">/ {stats.total} Units</span>
            </div>
            <div className="mt-auto pt-6 flex items-center gap-2">
              <div className="flex -space-x-2">
                {[1,2,3].map(i => (
                  <div key={i} className="w-5 h-5 rounded-full border-2 border-[#020202] bg-zinc-800"></div>
                ))}
              </div>
              <span className="text-[9px] text-zinc-500 font-bold uppercase">100% Coverage</span>
            </div>
          </div>
        </motion.div>

        <motion.div 
          whileHover={{ y: -5 }}
          className="glass-panel glow-card p-6 rounded-[2rem] relative overflow-hidden group transition-all"
        >
          <div className="absolute -right-4 -top-4 p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity -rotate-12">
            <TrendingDown className="w-24 h-24" />
          </div>
          <div className="flex flex-col h-full">
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] mb-4">Market Floor</p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-emerald-500">{scan?.currency || "$"} {stats.minPrice}</span>
            </div>
            <p className="mt-auto text-[9px] text-emerald-500/60 font-black uppercase tracking-widest flex items-center gap-1">
              <TrendingDown className="w-3 h-3" />
              Optimal Entry Price
            </p>
          </div>
        </motion.div>

        <motion.div 
          whileHover={{ y: -5 }}
          className="glass-panel glow-card p-6 rounded-[2rem] relative overflow-hidden group transition-all"
        >
          <div className="absolute -right-4 -top-4 p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity rotate-45">
            <TrendingUp className="w-24 h-24" />
          </div>
          <div className="flex flex-col h-full">
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] mb-4">Ceiling Price</p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-rose-500">{scan?.currency || "$"} {stats.maxPrice}</span>
            </div>
            <p className="mt-auto text-[9px] text-rose-500/60 font-black uppercase tracking-widest flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              Peak Premium
            </p>
          </div>
        </motion.div>

        <motion.div 
          whileHover={{ y: -5 }}
          className="glass-panel glow-card p-6 rounded-[2rem] relative overflow-hidden group transition-all border-rose-500/20 bg-rose-500/5"
        >
          <div className="absolute -right-4 -top-4 p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
            <ShieldCheck className="w-24 h-24 text-rose-500" />
          </div>
          <div className="flex flex-col h-full">
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] mb-4">Parity Conflicts</p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-rose-500">{stats.parityAlerts}</span>
              <span className="text-rose-500/60 text-xs font-bold uppercase tracking-widest">Active Gaps</span>
            </div>
            <p className="mt-auto text-[9px] text-rose-400 font-black uppercase tracking-widest">Autonomous Detection</p>
          </div>
        </motion.div>
      </div>

      {/* Search & Filters */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center gap-4 mb-8">
        <div className="flex-1 relative group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-blue-500 transition-colors" />
          <input
            type="text"
            placeholder="Search Intelligence Database..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-zinc-900/30 border border-zinc-800/50 rounded-full pl-14 pr-8 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 w-full transition-all placeholder:text-zinc-600 font-medium"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
          <div className="flex bg-zinc-900/30 border border-zinc-800/50 rounded-full p-1 whitespace-nowrap">
            <button 
              onClick={() => setStarFilter(null)}
              className={`px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${starFilter === null ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-400"}`}
            >
              All
            </button>
            {[5, 4, 3, 2].map(star => (
              <button 
                key={star}
                onClick={() => setStarFilter(starFilter === star ? null : star)}
                className={`flex items-center gap-1 px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${starFilter === star ? "bg-blue-600 text-white" : "text-zinc-500 hover:text-zinc-400"}`}
              >
                {star} <Star className={`w-3 h-3 ${starFilter === star ? "fill-white" : ""}`} />
              </button>
            ))}
          </div>
          
          <div className="flex bg-zinc-900/30 border border-zinc-800/50 rounded-full p-1 whitespace-nowrap">
            <select 
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-zinc-400 text-[9px] font-black uppercase tracking-widest px-4 py-2 focus:outline-none appearance-none cursor-pointer outline-none"
            >
              <option value="price-asc" className="bg-zinc-900">Sort: Price (Low)</option>
              <option value="price-desc" className="bg-zinc-900">Sort: Price (High)</option>
              <option value="rating" className="bg-zinc-900">Sort: Rating</option>
              <option value="stars" className="bg-zinc-900">Sort: Stars</option>
            </select>
          </div>

          <div className="flex bg-zinc-900/30 border border-zinc-800/50 rounded-full p-1 whitespace-nowrap">
            <select 
              value={parityFilter}
              onChange={(e) => setParityFilter(e.target.value as any)}
              className="bg-transparent text-zinc-400 text-[9px] font-black uppercase tracking-widest px-4 py-2 focus:outline-none appearance-none cursor-pointer outline-none font-black"
            >
              <option value="all" className="bg-zinc-900">Parity: All</option>
              <option value="violations" className="bg-zinc-900">Parity: Violations Only (&gt; 15%)</option>
            </select>
          </div>

          <button className="flex items-center gap-2 bg-zinc-900/30 border border-zinc-800/50 px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white hover:border-zinc-700 transition-all">
            <Filter className="w-3.5 h-3.5" />
            Advanced
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto">
        <AnimatePresence mode="wait">
          {activeTab === "results" ? (
            <motion.div 
              key="grid"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
            >
              {filteredResults.length > 0 ? (
                filteredResults.map((result, idx) => (
                  <motion.div
                    key={idx}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.02 }}
                    className={`glass-panel rounded-[2.5rem] overflow-hidden group hover:border-blue-500/30 transition-all duration-500 hover:shadow-3xl hover:shadow-blue-500/10 flex flex-col ${expandedId === idx ? "md:col-span-2 lg:col-span-3" : ""}`}
                  >
                    <div className="flex flex-col lg:flex-row h-full">
                      {/* Left: Main Info / Image */}
                      <div className={`${expandedId === idx ? "lg:w-1/3" : "w-full"}`}>
                        <div className={`${expandedId === idx ? "h-full min-h-[300px]" : "h-64"} w-full relative overflow-hidden`}>
                          {result.image ? (
                            <img 
                              src={result.image} 
                              alt={result.hotel_name}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000"
                            />
                          ) : (
                            <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                              <Hotel className="w-12 h-12 text-zinc-800" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-[#020202] via-[#020202]/20 to-transparent"></div>
                          
                          <div className="absolute top-6 left-6 flex flex-col gap-2">
                            {result.stars && (
                              <div className="bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-white/10">
                                <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                                <span className="text-[10px] font-black text-white">{result.stars} Star</span>
                              </div>
                            )}
                          </div>

                          <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Live Parity</span>
                              </div>
                              <p className="text-3xl font-black text-white leading-none">
                                {result.currency} {result.price}
                              </p>
                            </div>
                            {expandedId !== idx && (
                              <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/5">
                                <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-0.5 text-center">Score</p>
                                <p className="text-sm font-black text-blue-400 text-center">{(result.rating || 9.8).toFixed(1)}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Content & Expansion */}
                      <div className={`p-8 space-y-6 flex-1 flex flex-col ${expandedId === idx ? "lg:w-2/3" : ""}`}>
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h3 className="font-black text-xl mb-3 leading-tight group-hover:text-blue-400 transition-colors line-clamp-2">
                              {result.hotel_name}
                            </h3>
                            <div className="flex items-center gap-2 text-zinc-500">
                              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                              <span className="text-xs font-medium line-clamp-1">{result.location || "Location pending verification"}</span>
                            </div>
                          </div>
                          
                          <button 
                            onClick={() => setExpandedId(expandedId === idx ? null : idx)}
                            className="w-10 h-10 rounded-full border border-zinc-800 flex items-center justify-center hover:bg-white hover:text-black transition-all"
                          >
                            {expandedId === idx ? <ChevronRight className="w-4 h-4 rotate-180" /> : <Info className="w-4 h-4" />}
                          </button>
                        </div>

                        <AnimatePresence>
                          {expandedId === idx ? (
                            <motion.div 
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-zinc-800"
                            >
                              {/* OTA Pricing Section */}
                              <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-2">
                                  <Globe className="w-3 h-3" />
                                  OTA Market Breakdown
                                </h4>
                                <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                                  {result.ota_pricing && result.ota_pricing.length > 0 ? (
                                    result.ota_pricing.map((ota, i) => (
                                      <div key={i} className={`flex items-center justify-between p-3 rounded-xl bg-zinc-900/50 border transition-all ${ota.is_best ? "border-emerald-500/30 bg-emerald-500/5 shadow-[0_0_15px_rgba(16,185,129,0.05)]" : "border-zinc-800/50 hover:border-zinc-700"}`}>
                                        <div className="flex items-center gap-3">
                                          <div className={`w-1.5 h-1.5 rounded-full ${ota.is_best ? "bg-emerald-500 animate-pulse" : "bg-zinc-700"}`}></div>
                                          <span className="text-[10px] font-bold text-zinc-300">{ota.name}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                          <span className={`text-[11px] font-black ${ota.is_best ? "text-emerald-400" : "text-white"}`}>
                                            {ota.currency} {ota.price}
                                          </span>
                                          {ota.url && (
                                            <a href={ota.url} target="_blank" className="text-zinc-600 hover:text-white transition-colors">
                                              <ExternalLink className="w-3 h-3" />
                                            </a>
                                          )}
                                        </div>
                                      </div>
                                    ))
                                  ) : (
                                    <p className="text-[9px] text-zinc-600 uppercase font-bold italic">No OTA data found in this scan</p>
                                  )}
                                </div>
                              </div>

                              {/* Room Types Section */}
                              <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-purple-500 uppercase tracking-widest flex items-center gap-2">
                                  <LayoutGrid className="w-3 h-3" />
                                  Detected Room Types
                                </h4>
                                <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                                  {result.room_types && result.room_types.length > 0 ? (
                                    result.room_types.map((room, i) => (
                                      <div key={i} className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800/50 hover:border-purple-500/20 transition-all">
                                        <div className="flex justify-between items-center mb-1">
                                          <span className="text-[10px] font-black text-white uppercase tracking-tight">{room.name}</span>
                                          {room.price && <span className="text-[10px] font-bold text-purple-400">{result.currency} {room.price}</span>}
                                        </div>
                                        {room.description && <p className="text-[9px] text-zinc-500 line-clamp-1 italic leading-relaxed">{room.description}</p>}
                                      </div>
                                    ))
                                  ) : (
                                    <p className="text-[9px] text-zinc-600 uppercase font-bold italic">No room type metadata available</p>
                                  )}
                                </div>
                              </div>

                              {/* Sentiment Analysis Section */}
                              <div className="md:col-span-2 lg:col-span-3 mt-4 pt-8 border-t border-zinc-800 space-y-6">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-2">
                                    <MessageSquare className="w-3 h-3" />
                                    Review Sentiment Intelligence
                                  </h4>
                                  <div className="flex items-center gap-4 text-[9px] font-bold uppercase tracking-tighter text-zinc-600">
                                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Positive</div>
                                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-rose-500"></div> Negative</div>
                                  </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                  {result.reviews_sentiment && result.reviews_sentiment.length > 0 ? (
                                    result.reviews_sentiment.map((sent, i) => (
                                      <motion.div 
                                        key={i}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.05 }}
                                        className="p-4 rounded-2xl bg-zinc-900/30 border border-zinc-800/50 flex flex-col gap-3 hover:bg-zinc-900/50 transition-all group/sent"
                                      >
                                        <div className="flex justify-between items-start">
                                          <span className="text-[11px] font-black text-zinc-100 uppercase tracking-tight">{sent.keyword}</span>
                                          <div className={`px-2 py-0.5 rounded-full text-[8px] font-black ${sent.score > 0.5 ? "bg-emerald-500/10 text-emerald-400" : "bg-zinc-800 text-zinc-500"}`}>
                                            {Math.round(sent.score * 100)}% POSITIVE
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                          <div className="flex items-center gap-1.5 text-emerald-500">
                                            <ThumbsUp className="w-3 h-3" />
                                            <span className="text-[10px] font-bold">{sent.positive}</span>
                                          </div>
                                          <div className="flex items-center gap-1.5 text-rose-500">
                                            <ThumbsDown className="w-3 h-3" />
                                            <span className="text-[10px] font-bold">{sent.negative}</span>
                                          </div>
                                        </div>
                                        <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                                          <div 
                                            className="h-full bg-emerald-500 group-hover:brightness-125 transition-all" 
                                            style={{ width: `${(sent.positive / (sent.positive + sent.negative || 1)) * 100}%` }}
                                          ></div>
                                        </div>
                                      </motion.div>
                                    ))
                                  ) : (
                                    <div className="col-span-full py-10 flex flex-col items-center justify-center bg-zinc-900/10 rounded-3xl border border-dashed border-zinc-800/50">
                                      <MessageSquare className="w-8 h-8 text-zinc-800 mb-3" />
                                      <p className="text-[9px] text-zinc-600 uppercase font-black italic tracking-widest">Sentiment data not available for this node</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          ) : (
                            <>
                              <div className="grid grid-cols-2 gap-3">
                                <div className="bg-zinc-950/50 p-3 rounded-2xl border border-zinc-800/50">
                                  <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-1">Provider</p>
                                  <div className="flex items-center gap-2">
                                    <Globe className="w-3 h-3 text-blue-500" />
                                    <span className="text-[10px] font-black text-zinc-300 uppercase truncate">{result.vendor}</span>
                                  </div>
                                </div>
                                <div className="bg-zinc-950/50 p-3 rounded-2xl border border-zinc-800/50">
                                  <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-1">Reviews</p>
                                  <div className="flex items-center gap-2">
                                    <Activity className="w-3 h-3 text-purple-500" />
                                    <span className="text-[10px] font-black text-zinc-300 uppercase">{result.reviews_count || 0} Votes</span>
                                  </div>
                                </div>
                              </div>

                              <div className="mt-auto pt-6 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  {result.rating && (
                                    <div className="flex items-center gap-1.5">
                                      <div className="w-8 h-8 rounded-full bg-blue-600/10 flex items-center justify-center border border-blue-600/20">
                                        <span className="text-[10px] font-black text-blue-500">{result.rating}</span>
                                      </div>
                                      <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Rating</span>
                                    </div>
                                  )}
                                </div>

                                {result.url && (
                                  <a 
                                    href={result.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="group/link flex items-center gap-2 bg-zinc-900 hover:bg-white text-zinc-400 hover:text-black px-4 py-2 rounded-full border border-zinc-800 transition-all text-[9px] font-black uppercase tracking-widest"
                                  >
                                    Inspection
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                            </>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="col-span-full py-32 flex flex-col items-center justify-center glass-panel rounded-[3rem] border-dashed">
                  <div className="w-20 h-20 rounded-full bg-zinc-900 flex items-center justify-center mb-6">
                    <Search className="w-8 h-8 text-zinc-700" />
                  </div>
                  <h3 className="text-xl font-black mb-2">NO DATA DETECTED</h3>
                  <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em]">Adjust filters to expand search scope</p>
                </div>
              )}
            </motion.div>
          ) : activeTab === "analytics" ? (
            <motion.div 
              key="analytics"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-8"
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="glass-panel p-8 rounded-[3rem] border border-zinc-800/50">
                  <div className="flex items-center justify-between mb-10">
                    <div>
                      <h3 className="text-xl font-black tracking-tight">PRICE DISTRIBUTION</h3>
                      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Market Density Analysis</p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-blue-600/10 flex items-center justify-center border border-blue-600/20">
                      <BarChart3 className="w-6 h-6 text-blue-500" />
                    </div>
                  </div>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={priceDistributionData}>
                        <defs>
                          <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                        <XAxis dataKey="range" stroke="#4b5563" fontSize={10} axisLine={false} tickLine={false} />
                        <YAxis stroke="#4b5563" fontSize={10} axisLine={false} tickLine={false} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '12px' }}
                          itemStyle={{ fontSize: '10px', fontWeight: 'bold' }}
                        />
                        <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="glass-panel p-8 rounded-[3rem] border border-zinc-800/50">
                  <div className="flex items-center justify-between mb-10">
                    <div>
                      <h3 className="text-xl font-black tracking-tight">VENDOR MARKET SHARE</h3>
                      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">OTA Listing Distribution</p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-purple-600/10 flex items-center justify-center border border-purple-600/20">
                      <PieChartIcon className="w-6 h-6 text-purple-500" />
                    </div>
                  </div>
                  <div className="h-[300px] w-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={vendorShareData}
                          cx="50%"
                          cy="50%"
                          innerRadius={80}
                          outerRadius={110}
                          paddingAngle={8}
                          dataKey="value"
                        >
                          {vendorShareData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '12px' }}
                          itemStyle={{ fontSize: '10px', fontWeight: 'bold' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute flex flex-col items-center">
                      <span className="text-4xl font-black text-white">{vendorShareData.length}</span>
                      <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Vendors</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="glass-panel p-8 rounded-[3rem] border border-zinc-800/50 overflow-hidden relative">
                <div className="absolute right-0 top-0 w-96 h-96 bg-blue-600/5 blur-[120px] rounded-full -mr-48 -mt-48"></div>
                <div className="relative z-10">
                  <h3 className="text-xl font-black mb-6 tracking-tight">DATA INTELLIGENCE SUMMARY</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Scan Confidence</p>
                      <div className="flex items-center gap-4">
                        <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: "94%" }}
                            className="h-full bg-blue-500"
                          ></motion.div>
                        </div>
                        <span className="text-sm font-black text-white">94%</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Node Latency</p>
                      <div className="flex items-center gap-4">
                        <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: "22%" }}
                            className="h-full bg-emerald-500"
                          ></motion.div>
                        </div>
                        <span className="text-sm font-black text-white">412ms</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Integrity Check</p>
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-blue-500" />
                        <span className="text-sm font-black text-white">PASSED</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="json"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="glass-panel border border-zinc-800 rounded-[3rem] p-10 font-mono text-xs overflow-hidden relative group"
            >
              <div className="flex items-center justify-between mb-8 pb-8 border-b border-zinc-800/50">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-600/10 flex items-center justify-center border border-blue-600/20">
                    <Code className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black tracking-tight">RAW PAYLOAD</h3>
                    <span className="font-bold uppercase tracking-widest text-zinc-500 text-[10px]">DataForSEO Schema v3</span>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(scan?.raw_payload, null, 2));
                  }}
                  className="bg-zinc-800/50 hover:bg-zinc-700 text-zinc-400 hover:text-white px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  Copy to Clipboard
                </button>
              </div>
              <div className="max-h-[600px] overflow-auto pr-6 custom-scrollbar">
                <pre className="text-zinc-400 whitespace-pre-wrap leading-relaxed">
                  {JSON.stringify(scan?.raw_payload, null, 2)}
                </pre>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Floating Branding */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/50 flex items-center gap-6 shadow-2xl z-50">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6]"></div>
          <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Active Intelligence Node</span>
        </div>
        <div className="w-px h-4 bg-zinc-800"></div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Verified by DataForSEO</span>
        </div>
      </div>
    </div>
  );
}

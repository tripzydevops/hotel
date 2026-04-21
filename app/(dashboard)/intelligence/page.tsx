"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useAnalysisStream } from "@/hooks/useAnalysisStream";
import IntelligenceHUD from "@/components/intelligence/IntelligenceHUD";
import StreamingNarrative from "@/components/intelligence/StreamingNarrative";
import MarketDensityChart from "@/components/intelligence/MarketDensityChart";
import { 
  Zap, 
  RefreshCw, 
  LayoutGrid, 
  Terminal, 
  ShieldCheck,
  Search,
  Sparkles,
  Command
} from "lucide-react";

export default function MarketIntelligencePage() {
  const { userId } = useAuth();
  const [roomType, setRoomType] = useState("Standard");
  const { data, narrative, isStreaming, error, refetch } = useAnalysisStream(userId, roomType);

  // Room Types for selection
  const roomTypes = ["Standard", "Deluxe", "Suite", "Villa"];

  return (
    <div className="min-h-screen bg-[var(--deep-ocean)] text-white p-4 md:p-8 pt-24">
      {/* Background Cinematic Accents */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-[var(--soft-gold)]/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10 space-y-6">
        {/* Top Navigation & Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 rounded-lg bg-[var(--soft-gold)]/10">
                <Command className="w-5 h-5 text-[var(--soft-gold)]" />
              </div>
              <h1 className="text-2xl font-black tracking-tight uppercase">Intelligence Hub</h1>
            </div>
            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-[0.3em] ml-12">
              Autonomous Market Surveillance System
            </p>
          </div>

          <div className="flex items-center gap-3">
             <div className="flex bg-white/5 rounded-xl p-1 border border-white/10">
               {roomTypes.map((type) => (
                 <button
                   key={type}
                   onClick={() => setRoomType(type)}
                   disabled={isStreaming}
                   className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                     roomType === type 
                       ? "bg-[var(--soft-gold)] text-[var(--deep-ocean)] shadow-lg" 
                       : "text-[var(--text-muted)] hover:text-white"
                   }`}
                 >
                   {type}
                 </button>
               ))}
             </div>
             
             <button 
               onClick={refetch}
               disabled={isStreaming}
               className="p-3 rounded-xl bg-white/5 border border-white/10 text-[var(--soft-gold)] hover:bg-white/10 transition-all group"
             >
               <RefreshCw className={`w-5 h-5 ${isStreaming ? "animate-spin" : "group-hover:rotate-180 transition-transform duration-700"}`} />
             </button>
          </div>
        </div>

        {/* Error State */}
        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-bold flex items-center gap-3"
            >
              <Zap className="w-4 h-4" />
              {error}. Re-initializing vector link...
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 gap-6">
          {/* Top HUD */}
          <IntelligenceHUD data={data} isStreaming={isStreaming} />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Autonomous Narrative - Left */}
            <div className="lg:col-span-7">
               <StreamingNarrative text={narrative} isStreaming={isStreaming} />
            </div>

            {/* Visual Analytics - Right */}
            <div className="lg:col-span-5 flex flex-col gap-6">
               <MarketDensityChart 
                 data={data?.competitor_clusters} 
                 targetHotel={{ price: data?.ari_value, sent: data?.sent_index }} 
               />
               
               {/* Quick Field Status Shard */}
               <div className="command-card p-6 flex flex-col gap-4">
                 <div className="flex items-center gap-2">
                   <ShieldCheck className="w-4 h-4 text-[var(--optimal-green)]" />
                   <span className="text-[10px] font-black text-white uppercase tracking-widest">System Integrity</span>
                 </div>
                 <div className="space-y-3">
                   <div className="flex justify-between items-center">
                     <span className="text-[10px] text-[var(--text-muted)] uppercase font-bold">Vector Persistence</span>
                     <span className="text-[10px] font-black text-[var(--optimal-green)]">99.9%</span>
                   </div>
                   <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                     <motion.div 
                       className="h-full bg-[var(--optimal-green)]"
                       initial={{ width: 0 }}
                       animate={{ width: "99.9%" }}
                       transition={{ duration: 2 }}
                     />
                   </div>
                 </div>
                 <div className="flex items-center justify-between mt-2 pt-4 border-t border-white/5">
                    <div className="flex items-center gap-2">
                       <Terminal className="w-3 h-3 text-white/40" />
                       <span className="text-[9px] text-white/40 font-mono">NODE_AGENT_PROXIMA_4</span>
                    </div>
                    <div className="flex items-center gap-1">
                       <Sparkles className="w-3 h-3 text-[var(--soft-gold)]" />
                       <span className="text-[9px] font-black text-[var(--soft-gold)] uppercase tracking-wider">AI ENHANCED</span>
                    </div>
                 </div>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* Futuristic Scanline Effect */}
      <div className="fixed inset-0 pointer-events-none z-50 opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,1,0.06))] bg-[length:100%_4px,3px_100%]" />
    </div>
  );
}

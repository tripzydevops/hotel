"use client";

import { useState } from "react";
import { Search, Sparkles, Command } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function SemanticSearchBar({
  onSearch,
}: {
  onSearch: (query: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query);
    }
  };

  return (
    <div className="relative w-full max-w-2xl mx-auto mb-8">
      <form onSubmit={handleSubmit} className="relative group">
        <div
          className={`absolute inset-0 bg-gradient-to-r from-[var(--optimal-green)] via-[var(--soft-gold)] to-[var(--alert-red)] rounded-2xl opacity-20 blur-xl transition-opacity duration-500 ${isFocused ? "opacity-40" : "opacity-0"}`}
        />

        <div
          className={`relative flex items-center bg-[#0a0a14]/90 border transition-all duration-300 rounded-2xl overflow-hidden ${isFocused ? "border-[var(--soft-gold)] shadow-[0_0_30px_rgba(255,215,0,0.1)]" : "border-white/10"}`}
        >
          <div className="pl-4 text-[var(--text-muted)] group-focus-within:text-[var(--soft-gold)] transition-colors">
            <Sparkles className="w-5 h-5" />
          </div>

          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Ask the engine (e.g., 'Find luxury spa hotels with ocean view under $200')..."
            className="w-full bg-transparent px-4 py-4 text-white placeholder:text-white/20 focus:outline-none font-medium"
          />

          <div className="pr-4 flex items-center gap-2">
            {query && (
              <button
                type="submit"
                className="p-1.5 rounded-lg bg-[var(--soft-gold)] text-[var(--deep-ocean)] hover:bg-white transition-colors"
              >
                <Search className="w-4 h-4" />
              </button>
            )}
            {!query && (
              <div className="hidden md:flex items-center gap-1 px-2 py-1 rounded bg-white/5 border border-white/5 text-[10px] text-[var(--text-muted)] font-black uppercase tracking-wider">
                <Command className="w-3 h-3" />
                <span>K</span>
              </div>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}

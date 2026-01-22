"use client";

import { useState, useEffect, useRef } from "react";
import { X, Building2, MapPin, Search, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

interface AddHotelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (name: string, location: string, isTarget: boolean, currency: string) => Promise<void>;
}

export default function AddHotelModal({
  isOpen,
  onClose,
  onAdd,
}: AddHotelModalProps) {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [isTarget, setIsTarget] = useState(false);
  const [loading, setLoading] = useState(false);

  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionRef = useRef<HTMLDivElement>(null);

  // Search logic
  useEffect(() => {
    const searchHotels = async () => {
      if (name.length < 2) {
        setSuggestions([]);
        return;
      }

      setIsSearching(true);
      try {
        const results = await api.searchDirectory(name);
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
      } catch (error) {
        console.error("Search failed:", error);
      } finally {
        setIsSearching(false);
      }
    };

    const timeoutId = setTimeout(searchHotels, 500);
    return () => clearTimeout(timeoutId);
  }, [name]);

  // Close suggestions on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionRef.current &&
        !suggestionRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectSuggestion = (suggestion: any) => {
    setName(suggestion.name);
    setLocation(suggestion.location);
    setShowSuggestions(false);
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onAdd(name, location, isTarget, currency);
      onClose();
      // Reset form
      setName("");
      setLocation("");
      setCurrency("USD");
      setIsTarget(false);
    } catch (error) {
      console.error("Error adding hotel:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-[var(--deep-ocean-card)] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[var(--soft-gold)]" />
            Add New Hotel
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-[var(--text-muted)] hover:text-white" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              Hotel Name
            </label>
            <div className="relative" ref={suggestionRef}>
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() =>
                  name.length >= 2 &&
                  setSuggestions((prev) => (prev.length > 0 ? prev : [])) &&
                  setShowSuggestions(true)
                }
                onKeyDown={(e) => {
                  if (e.key === "Escape") setShowSuggestions(false);
                }}
                className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 pl-10 pr-10 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[var(--soft-gold)]/50"
                placeholder="e.g. Grand Plaza Hotel"
              />
              {name.length > 0 && !isSearching && (
                <button
                  type="button"
                  onClick={() => {
                    setName("");
                    setSuggestions([]);
                    setShowSuggestions(false);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                </button>
              )}
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--soft-gold)] animate-spin" />
              )}

              {/* Suggestions Dropdown */}
              {showSuggestions && name.length >= 2 && !isSearching && (
                <div className="absolute z-[60] left-0 right-0 mt-1 bg-[var(--deep-ocean-card)] border border-white/10 rounded-lg shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="max-h-48 overflow-y-auto">
                    {suggestions.length > 0 ? (
                      suggestions.map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectSuggestion(item)}
                          className="w-full px-4 py-3 text-left hover:bg-white/5 flex flex-col transition-colors border-b border-white/5 last:border-none"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-white font-medium text-sm">
                              {item.name}
                            </span>
                            {item.source === "serpapi" && (
                              <span className="text-[10px] bg-white/10 text-[var(--text-muted)] py-0.5 px-1.5 rounded uppercase tracking-widest font-bold">Global</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-[var(--text-muted)]" />
                            <span className="text-[var(--text-muted)] text-xs">
                              {item.location}
                            </span>
                          </div>
                        </button>
                      ))
                    ) : name.length >= 2 && !isSearching ? (
                      <div className="px-4 py-6 text-center">
                        <Search className="w-8 h-8 text-white/10 mx-auto mb-2" />
                        <p className="text-sm text-[var(--text-secondary)]">No direct matches found</p>
                        <p className="text-xs text-[var(--text-muted)] mt-1">Continue typing to add manually</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Location
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type="text"
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  onFocus={() => setShowSuggestions(false)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[var(--soft-gold)]/50 transition-all font-medium"
                  placeholder="e.g. Miami, FL"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 px-3 text-white focus:outline-none focus:ring-2 focus:ring-[var(--soft-gold)]/50 text-sm [&>option]:bg-[var(--deep-ocean-card)]"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="TRY">TRY (₺)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 py-2">
            <input
              type="checkbox"
              id="isTarget"
              checked={isTarget}
              onChange={(e) => setIsTarget(e.target.checked)}
              className="w-4 h-4 rounded border-white/10 bg-white/5 text-[var(--soft-gold)] focus:ring-[var(--soft-gold)]/50 focus:ring-offset-0"
            />
            <label
              htmlFor="isTarget"
              className="text-sm text-[var(--text-secondary)] cursor-pointer select-none"
            >
              This is my hotel (Target Hotel)
            </label>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full btn-gold py-3 flex items-center justify-center gap-2 group"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-[var(--deep-ocean)] border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Add Hotel Monitor</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Helper icon
function Plus({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 4v16m8-8H4"
      />
    </svg>
  );
}

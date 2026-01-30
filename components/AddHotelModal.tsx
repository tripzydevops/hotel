"use client";

import { useState, useEffect, useRef } from "react";
import { X, Building2, MapPin, Loader2, Plus } from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

interface AddHotelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (
    name: string,
    location: string,
    isTarget: boolean,
    currency: string,
    serpApiId?: string,
  ) => Promise<void>;
  initialName?: string;
  initialLocation?: string;
  currentHotelCount?: number;
}

export default function AddHotelModal({
  isOpen,
  onClose,
  onAdd,
  initialName = "",
  initialLocation = "",
  currentHotelCount = 0,
}: AddHotelModalProps) {
  const { t } = useI18n();
  const [name, setName] = useState(initialName);
  const [location, setLocation] = useState(initialLocation);
  const [currency, setCurrency] = useState("TRY");
  const [isTarget, setIsTarget] = useState(false);
  const [serpApiId, setSerpApiId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  const isLimitReached = currentHotelCount >= 5;

  // Update state if initial values change
  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setLocation(initialLocation);
    }
  }, [isOpen, initialName, initialLocation]);

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
    setSerpApiId(suggestion.serp_api_id);
    setShowSuggestions(false);
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLimitReached) return;

    setLoading(true);
    try {
      await onAdd(name, location, isTarget, currency, serpApiId);
      onClose();
      // Reset form
      setName("");
      setLocation("");
      setCurrency("TRY");
      setIsTarget(false);
      setSerpApiId(undefined);
    } catch (error) {
      console.error("Error adding hotel:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-[var(--deep-ocean-card)] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-xl relative overflow-hidden">
        {/* Limit Warning Banner */}
        {isLimitReached && (
          <div className="absolute top-0 left-0 right-0 bg-red-500/10 border-b border-red-500/20 px-6 py-2 flex items-center gap-2 justify-center">
            <span className="text-xs font-bold text-red-400 uppercase tracking-wider">
              {t("addHotel.limitReached")}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between mb-6 mt-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[var(--soft-gold)]" />
            {t("addHotel.title")}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-[var(--text-muted)] hover:text-white" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Form Disabled Overlay if Limit Reached */}
          {isLimitReached && (
            <div className="absolute inset-0 z-10 bg-[var(--deep-ocean-card)]/50 backdrop-blur-[1px] flex items-center justify-center top-[80px]">
              <div className="bg-black/80 px-4 py-3 rounded-lg border border-white/10 text-center shadow-2xl">
                <p className="text-white font-bold mb-1">
                  {t("addHotel.limitReached")}
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  {t("addHotel.limitDesc")}
                </p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              {t("addHotel.nameLabel")}
            </label>
            <div className="relative z-50" ref={suggestionRef}>
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <input
                type="text"
                required
                value={name}
                disabled={isLimitReached}
                onChange={(e) => {
                  setName(e.target.value);
                  setSerpApiId(undefined); // Reset ID if user types manually
                  setShowSuggestions(true);
                }}
                onFocus={() =>
                  !isLimitReached &&
                  name.length >= 2 &&
                  setSuggestions((prev) => (prev.length > 0 ? prev : [])) &&
                  setShowSuggestions(true)
                }
                onKeyDown={(e) => {
                  if (e.key === "Escape") setShowSuggestions(false);
                }}
                className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 pl-10 pr-10 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[var(--soft-gold)]/50 disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder={t("addHotel.namePlaceholder")}
              />
              {name.length > 0 && !isSearching && !isLimitReached && (
                <button
                  type="button"
                  onClick={() => {
                    setName("");
                    setSuggestions([]);
                    setSerpApiId(undefined);
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
                <div className="absolute z-[100] left-0 right-0 mt-1 bg-[var(--deep-ocean-card)] border border-white/10 rounded-lg shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200 ring-1 ring-black/20">
                  <div className="max-h-40 overflow-y-auto">
                    {suggestions.length > 0 ? (
                      suggestions.map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectSuggestion(item)}
                          className="w-full px-3 py-2 text-left hover:bg-white/5 flex flex-col transition-colors border-b border-white/5 last:border-none"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-white font-medium text-xs">
                              {item.name}
                            </span>
                            {item.source === "serpapi" && (
                              <span className="text-[8px] bg-white/10 text-[var(--text-muted)] py-0.5 px-1 rounded uppercase tracking-widest font-bold">
                                {t("addHotel.globalMatch")}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <MapPin className="w-2.5 h-2.5 text-[var(--text-muted)]" />
                            <span className="text-[var(--text-muted)] text-[10px]">
                              {item.location}
                            </span>
                          </div>
                        </button>
                      ))
                    ) : name.length >= 2 && !isSearching ? (
                      <div className="px-3 py-4 text-center bg-white/[0.02]">
                        <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-bold mb-1">
                          {t("addHotel.noMatch")}
                        </p>
                        <p className="text-[9px] text-[var(--text-muted)]">
                          {t("addHotel.checkingLocation")}
                        </p>
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
                {t("addHotel.locationLabel")}
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type="text"
                  required
                  value={location}
                  disabled={isLimitReached}
                  onChange={(e) => setLocation(e.target.value)}
                  onFocus={() => setShowSuggestions(false)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[var(--soft-gold)]/50 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder={t("addHotel.locationPlaceholder")}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                {t("addHotel.currencyLabel")}
              </label>
              <select
                value={currency}
                disabled={isLimitReached}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 px-3 text-white focus:outline-none focus:ring-2 focus:ring-[var(--soft-gold)]/50 text-sm [&>option]:bg-[var(--deep-ocean-card)] disabled:opacity-50 disabled:cursor-not-allowed"
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
              disabled={isLimitReached}
              onChange={(e) => setIsTarget(e.target.checked)}
              className="w-4 h-4 rounded border-white/10 bg-white/5 text-[var(--soft-gold)] focus:ring-[var(--soft-gold)]/50 focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <label
              htmlFor="isTarget"
              className="text-sm text-[var(--text-secondary)] cursor-pointer select-none disabled:opacity-50"
            >
              {t("addHotel.targetLabel")}
            </label>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || isLimitReached}
              className="w-full btn-gold py-3 flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-[var(--deep-ocean)] border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>
                    {isLimitReached
                      ? t("addHotel.limitReached")
                      : t("addHotel.submitButton")}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

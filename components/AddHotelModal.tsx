"use client";

import { useState, useEffect, useRef } from "react";
import {
  X,
  Building2,
  MapPin,
  Loader2,
  Plus,
  Zap,
  ShieldAlert,
  Search,
  ChevronDown,
  Target,
  Sparkles,
  Globe,
  Database,
  ArrowRight,
} from "lucide-react";
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
  const [locationsRegistry, setLocationsRegistry] = useState<any[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [country, setCountry] = useState("Turkey");
  const [city, setCity] = useState("");
  const [isManualEntry, setIsManualEntry] = useState(false);
  const [name, setName] = useState(initialName);
  const [currency, setCurrency] = useState("TRY");
  const [isTarget, setIsTarget] = useState(false);
  const [serpApiId, setSerpApiId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  const isLimitReached = currentHotelCount >= 5;

  // Update state if initial values change
  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      if (initialLocation) {
        const parts = initialLocation.split(",").map((p) => p.trim());
        setCity(parts[0]);
        if (parts[1]) setCountry(parts[1]);
      }

      // Load locations
      api
        .getLocations()
        .then((data) => {
          setLocationsRegistry(data);
          const INVALID_COUNTRIES = [
            "USD",
            "EUR",
            "GBP",
            "TRY",
            "AUD",
            "CAD",
            "JPY",
          ];
          const uniqueCountries = Array.from(
            new Set(data.map((l: any) => l.country)),
          ).filter((c) => !INVALID_COUNTRIES.includes(c as string));

          if (!uniqueCountries.includes("Turkey"))
            uniqueCountries.push("Turkey");
          setCountries(uniqueCountries.sort());
        })
        .catch((err) => console.error("Failed to load locations:", err));
    }
  }, [isOpen, initialName, initialLocation]);

  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionRef = useRef<HTMLDivElement>(null);

  // Filter cities based on selected country
  const filteredCities = Array.from(
    new Set(
      locationsRegistry.filter((l) => l.country === country).map((l) => l.city),
    ),
  ).sort();

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
    if (suggestion.location) {
      const parts = suggestion.location.split(",").map((p: string) => p.trim());
      setCity(parts[0]);
      if (parts[1]) {
        setCountry(parts[1]);
        if (!countries.includes(parts[1])) {
          setCountries((prev) => [...prev, parts[1]].sort());
        }
      }
    }
    setSerpApiId(suggestion.serp_api_id);
    setShowSuggestions(false);
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLimitReached) return;

    setLoading(true);
    try {
      // Standardize location: City, Country
      const formattedLocation = city ? `${city}, ${country}` : country;

      await onAdd(name, formattedLocation, isTarget, currency, serpApiId);
      onClose();
      // Reset form
      setName("");
      setCity("");
      setCountry("Turkey");
      setCurrency("TRY");
      setIsTarget(false);
      setIsManualEntry(false);
      setSerpApiId(undefined);
    } catch (error) {
      console.error("Error adding hotel:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl transition-all duration-500">
      <div className="premium-card w-full max-w-lg p-10 shadow-2xl relative overflow-hidden bg-black/40 border-[var(--gold-primary)]/10">
        {/* Silk Glow Effect */}
        <div className="absolute -top-32 -left-32 w-64 h-64 bg-[var(--gold-glow)] opacity-15 blur-[100px] pointer-events-none" />

        {/* Limit Warning Protocol */}
        {isLimitReached && (
          <div className="absolute top-0 left-0 right-0 bg-red-500/10 border-b border-red-500/20 px-8 py-3 flex items-center gap-3 justify-center z-20">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[9px] font-black text-red-500 uppercase tracking-[0.4em]">
              Security_Lock: {t("addHotel.limitReached")}
            </span>
          </div>
        )}

        {/* Header Section */}
        <div
          className={`flex items-center justify-between mb-10 relative z-20 ${isLimitReached ? "mt-8" : ""}`}
        >
          <div className="flex items-center gap-6">
            <div className="relative group">
              <div className="absolute inset-0 bg-[var(--gold-primary)]/20 blur-xl rounded-2xl group-hover:blur-2xl transition-all" />
              <div className="relative p-4 rounded-2xl bg-black border border-[var(--gold-primary)]/40 text-[var(--gold-primary)] shadow-2xl">
                <Building2 className="w-6 h-6" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-black text-white tracking-tighter uppercase italic leading-none">
                {t("addHotel.title")}
              </h2>
              <div className="flex items-center gap-2 mt-2">
                <div className="w-1 h-1 rounded-full bg-[var(--gold-primary)] animate-ping" />
                <p className="text-[9px] font-black text-[var(--gold-primary)] uppercase tracking-[0.4em] opacity-80">
                  Node_Initialization
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-3 hover:bg-white/5 rounded-2xl transition-all border border-white/5 text-[var(--text-muted)] hover:text-white"
          >
            <X className="w-6 h-6 group-hover:rotate-90 transition-transform" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8 relative z-20">
          {/* Limit Reached Shield */}
          {isLimitReached && (
            <div className="absolute inset-x-[-40px] bottom-[-40px] top-[10px] z-50 bg-black/60 backdrop-blur-xl flex items-center justify-center p-12">
              <div className="max-w-xs text-center animate-in fade-in zoom-in duration-700">
                <div className="relative mb-8">
                  <div className="absolute inset-0 bg-red-500/20 blur-3xl rounded-full scale-150" />
                  <div className="relative w-20 h-20 bg-black border border-red-500/40 rounded-[2.5rem] flex items-center justify-center mx-auto text-red-500 shadow-[0_0_50px_rgba(239,68,68,0.2)]">
                    <ShieldAlert className="w-10 h-10" />
                  </div>
                </div>
                <h3 className="text-2xl font-black text-white mb-4 tracking-tighter uppercase italic">
                  {t("addHotel.limitReached")}
                </h3>
                <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest leading-relaxed font-bold mb-8">
                  {t("addHotel.limitDesc")}
                </p>
                <button
                  type="button"
                  className="btn-premium w-full py-5 text-black font-black uppercase tracking-[0.3em] relative overflow-hidden group/upgrade"
                >
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/upgrade:translate-y-0 transition-transform duration-500" />
                  <span className="relative z-10 flex items-center justify-center gap-3">
                    <Zap className="w-4 h-4 fill-current" />
                    Expand_Neural_Capacity
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Hotel Name Selection */}
          <div className="space-y-3">
            <label className="text-[10px] font-black text-[var(--gold-primary)] uppercase tracking-[0.3em] ml-1 opacity-80">
              {t("addHotel.nameLabel")}
            </label>
            <div className="relative z-50 group" ref={suggestionRef}>
              <div className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-white/5 border border-white/5 group-focus-within:border-[var(--gold-primary)]/40 transition-colors">
                <Search className="w-4 h-4 text-[var(--text-muted)] group-focus-within:text-[var(--gold-primary)]" />
              </div>
              <input
                type="text"
                required
                value={name}
                disabled={isLimitReached}
                onChange={(e) => {
                  setName(e.target.value);
                  setSerpApiId(undefined);
                  setShowSuggestions(true);
                }}
                onFocus={() =>
                  !isLimitReached &&
                  name.length >= 2 &&
                  setShowSuggestions(true)
                }
                className="w-full bg-black/40 border border-white/5 rounded-2xl py-4 pl-16 pr-12 text-sm text-white font-bold focus:outline-none focus:border-[var(--gold-primary)]/50 transition-all shadow-inner placeholder:text-white/10"
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
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2 hover:bg-white/5 rounded-xl transition-all"
                >
                  <X className="w-4 h-4 text-[var(--text-muted)]" />
                </button>
              )}
              {isSearching && (
                <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--gold-primary)] animate-spin" />
              )}

              {/* Suggestions Intelligence Feed */}
              {showSuggestions && name.length >= 2 && !isSearching && (
                <div className="absolute z-[100] left-0 right-0 mt-4 bg-[var(--bg-deep)]/95 border border-white/5 rounded-[2rem] shadow-[0_30px_60px_rgba(0,0,0,0.8)] backdrop-blur-3xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500">
                  <div className="max-h-64 overflow-y-auto custom-scrollbar p-2">
                    {suggestions.length > 0 ? (
                      suggestions.map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectSuggestion(item)}
                          className="w-full p-6 text-left hover:bg-white/[0.03] flex flex-col transition-all border-b border-white/5 last:border-none group/item rounded-2xl mb-1 last:mb-0"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-white font-black text-sm uppercase tracking-tight group-hover/item:text-[var(--gold-primary)] transition-colors">
                              {item.name}
                            </span>
                            {item.source === "serpapi" && (
                              <div className="flex items-center gap-1.5 px-3 py-1 bg-[var(--gold-primary)]/10 border border-[var(--gold-primary)]/20 rounded-full">
                                <Sparkles className="w-2.5 h-2.5 text-[var(--gold-primary)]" />
                                <span className="text-[8px] text-[var(--gold-primary)] uppercase tracking-widest font-black">
                                  Neural_Match
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2.5 mt-2.5 opacity-40 group-hover:opacity-100 transition-opacity">
                            <MapPin className="w-3.5 h-3.5 text-[var(--gold-primary)]" />
                            <span className="text-[var(--text-muted)] text-[9px] font-black tracking-widest uppercase">
                              {item.location}
                            </span>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="p-12 text-center bg-black/20 rounded-[1.5rem]">
                        <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-white/5">
                          <Database className="w-8 h-8 text-white/10" />
                        </div>
                        <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-[0.4em] font-black italic">
                          {t("addHotel.noMatch")}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-[var(--gold-primary)] uppercase tracking-[0.3em] ml-1 opacity-80">
                  {t("addHotel.countryLabel")}
                </label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-white/5">
                    <Globe className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  </div>
                  <select
                    value={country}
                    disabled={isLimitReached || isManualEntry}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full bg-black/40 border border-white/5 rounded-2xl py-4 pl-14 pr-6 text-[11px] text-white font-black uppercase tracking-widest focus:outline-none focus:border-[var(--gold-primary)]/50 transition-all appearance-none cursor-pointer disabled:opacity-20 shadow-inner"
                  >
                    {countries.map((c) => (
                      <option key={c} value={c} className="bg-[var(--bg-deep)]">
                        {c.toUpperCase()}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                    <ChevronDown
                      size={14}
                      className="text-[var(--gold-primary)]"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-[var(--gold-primary)] uppercase tracking-[0.3em] ml-1 opacity-80">
                  {t("addHotel.cityLabel")}
                </label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-white/5">
                    <MapPin className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  </div>
                  {isManualEntry ? (
                    <input
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder={t("addHotel.locationPlaceholder")}
                      className="w-full bg-black/40 border border-[var(--gold-primary)]/40 rounded-2xl py-4 pl-14 pr-4 text-[11px] text-white font-black uppercase tracking-widest focus:outline-none transition-all shadow-inner"
                    />
                  ) : (
                    <>
                      <select
                        value={city}
                        required
                        onChange={(e) => {
                          if (e.target.value === "__NEW__") {
                            setIsManualEntry(true);
                            setCity("");
                          } else {
                            setCity(e.target.value);
                          }
                        }}
                        className="w-full bg-black/40 border border-white/5 rounded-2xl py-4 pl-14 pr-10 text-[11px] text-white font-black uppercase tracking-widest focus:outline-none focus:border-[var(--gold-primary)]/50 transition-all appearance-none cursor-pointer shadow-inner"
                      >
                        <option
                          value=""
                          className="bg-[var(--bg-deep)] opacity-40"
                        >
                          {t("addHotel.selectCity").toUpperCase()}
                        </option>
                        {filteredCities.map((c) => (
                          <option
                            key={c}
                            value={c}
                            className="bg-[var(--bg-deep)]"
                          >
                            {c.toUpperCase()}
                          </option>
                        ))}
                        <option
                          value="__NEW__"
                          className="bg-[var(--bg-deep)] text-[var(--gold-primary)] font-black"
                        >
                          + {t("addHotel.addNewLocation").toUpperCase()}
                        </option>
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                        <ChevronDown
                          size={14}
                          className="text-[var(--gold-primary)]"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-white/5 pt-6">
              <button
                type="button"
                onClick={() => setIsManualEntry(!isManualEntry)}
                className="text-[9px] text-[var(--gold-primary)] hover:text-white flex items-center gap-3 font-black uppercase tracking-[0.3em] transition-all group"
              >
                <div className="p-2 rounded-lg bg-[var(--gold-primary)]/10 group-hover:bg-[var(--gold-primary)] transition-all">
                  <ArrowRight
                    className={`w-3 h-3 text-[var(--gold-primary)] group-hover:text-black transition-transform ${isManualEntry ? "rotate-180" : ""}`}
                  />
                </div>
                {isManualEntry
                  ? "Revert_to_Selection"
                  : "Manual_Override_Protocol"}
              </button>

              <div className="flex items-center gap-4">
                <span className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest opacity-60">
                  {t("addHotel.currencyLabel")}
                </span>
                <select
                  value={currency}
                  disabled={isLimitReached}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="bg-black border border-white/10 rounded-xl px-4 py-1.5 text-[10px] font-black text-[var(--gold-primary)] focus:outline-none focus:border-[var(--gold-primary)] shadow-2xl appearance-none cursor-pointer hover:bg-white/5 transition-colors"
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="TRY">TRY</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
            </div>
          </div>

          <div
            className="bg-black/40 p-6 rounded-3xl border border-white/5 flex items-center justify-between group cursor-pointer hover:bg-white/[0.03] transition-all relative overflow-hidden"
            onClick={() => !isLimitReached && setIsTarget(!isTarget)}
          >
            {/* Active Glow for Switch */}
            {isTarget && (
              <div className="absolute inset-0 bg-[var(--gold-primary)]/5 animate-pulse" />
            )}

            <div className="flex items-center gap-6 relative z-10">
              <div
                className={`p-3 rounded-2xl border transition-all duration-500 ${isTarget ? "bg-[var(--gold-primary)]/20 border-[var(--gold-primary)]/40 text-[var(--gold-primary)] shadow-[0_0_20px_rgba(212,175,55,0.2)]" : "bg-white/5 border-white/5 text-white/20"}`}
              >
                <Target className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span
                  className={`text-[11px] font-black uppercase tracking-tight transition-colors ${isTarget ? "text-white" : "text-white/40"}`}
                >
                  Benchmark_Identity
                </span>
                <span className="text-[8px] text-[var(--text-muted)] uppercase tracking-widest font-black opacity-40">
                  Designate as baseline node
                </span>
              </div>
            </div>
            <div
              className={`w-12 h-7 rounded-full p-1.5 transition-all duration-500 relative z-10 ${isTarget ? "bg-[var(--gold-gradient)] shadow-[0_0_20px_rgba(212,175,55,0.4)]" : "bg-white/5 border border-white/5"}`}
            >
              <div
                className={`w-4 h-4 rounded-full shadow-2xl transform transition-transform duration-500 ${isTarget ? "translate-x-5 bg-black" : "translate-x-0 bg-white/20"}`}
              />
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={loading || isLimitReached || (!city && !isManualEntry)}
              className="btn-premium w-full py-5 flex items-center justify-center gap-6 group/btn relative overflow-hidden transition-all active:scale-[0.98] disabled:opacity-20 disabled:grayscale"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-500" />
              {loading ? (
                <div className="w-6 h-6 border-4 border-black/40 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Zap className="w-5 h-5 text-black fill-current animate-pulse relative z-10" />
                  <span className="font-black uppercase tracking-[0.4em] text-sm text-black relative z-10">
                    {isLimitReached
                      ? "CAPACITY_BREACHED"
                      : "Initialize_Signal_Link"}
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

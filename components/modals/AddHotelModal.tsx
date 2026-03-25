"use client";

import { useState, useEffect, useRef } from "react";
import { X, Building2, MapPin, Loader2, Plus } from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/components/ui/ToastContext";

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
  userPlan?: string;
}

import { PLAN_LIMITS } from "@/lib/constants";

export default function AddHotelModal({
  isOpen,
  onClose,
  onAdd,
  initialName = "",
  initialLocation = "",
  currentHotelCount = 0,
  userPlan = "trial",
}: AddHotelModalProps) {
  const { t } = useI18n();
  const { toast } = useToast();
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

  const limit = PLAN_LIMITS[userPlan] || 999;
  const isLimitReached = currentHotelCount >= limit;
  // NOTE: The backend also enforces limits in create_hotel with admin bypass.
  // We show a warning but do NOT disable the form — backend is the source of truth.

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
        // EXPLANATION: City-Aware Search
        // We pass the selected 'city' to the API to filter suggestions.
        // This ensures users see relevant local hotels first when a city is picked.
        const results = await api.searchDirectory(name, city);
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
  }, [name, city]);

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
    if (isLimitReached) {
      toast.error(
        t("dashboard.limitReached") || "Hotel limit reached. Please upgrade.",
      );
      return;
    }

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
    } catch (error: any) {
      console.error("Error adding hotel:", error);
      toast.error(error.message || "Failed to add hotel");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-[var(--deep-ocean-card)] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-xl relative overflow-hidden">
        {/* Limit info removed - backend enforces limits in create_hotel */}

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
          {/* Form overlay removed - backend enforces limits */}

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
                onChange={(e) => {
                  setName(e.target.value);
                  setSerpApiId(undefined); // Reset ID if user types manually
                  setSuggestions([]); // Clear suggestions while typing
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
                className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 pl-10 pr-10 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[var(--soft-gold)]/50 disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder={t("addHotel.namePlaceholder")}
              />
              {name.length > 0 && !isSearching && (
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
                <div className="absolute z-[100] left-0 right-0 mt-1 bg-slate-900 border border-white/20 rounded-lg shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200 ring-1 ring-black/50">
                  <div className="max-h-40 overflow-y-auto">
                    {suggestions.length > 0 ? (
                      suggestions.map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectSuggestion(item)}
                          className="w-full px-3 py-2 text-left hover:bg-white/10 flex flex-col transition-colors border-b border-white/5 last:border-none"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-white font-medium text-xs">
                              {item.name}
                            </span>
                            {item.source === "serpapi" && (
                              <span className="text-[8px] bg-blue-500/20 text-blue-300 py-0.5 px-1 rounded uppercase tracking-widest font-bold">
                                {t("addHotel.globalMatch")}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <MapPin className="w-2.5 h-2.5 text-gray-400" />
                            <span className="text-gray-400 text-[10px]">
                              {item.location}
                            </span>
                          </div>
                        </button>
                      ))
                    ) : name.length >= 2 && !isSearching ? (
                      <div className="px-3 py-4 text-center bg-white/[0.02]">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-1">
                          {t("addHotel.noMatch")}
                        </p>
                        <p className="text-[9px] text-gray-500">
                          {t("addHotel.checkingLocation")}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  {t("addHotel.countryLabel")}
                </label>
                <div className="relative">
                  <select
                    value={country}
                    disabled={isManualEntry}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full bg-slate-900/50 border border-white/10 rounded-lg py-2.5 px-3 text-white focus:outline-none focus:ring-2 focus:ring-[var(--soft-gold)]/50 text-sm [&>option]:bg-slate-900 disabled:opacity-50 transition-all"
                  >
                    {countries.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  {isManualEntry
                    ? t("addHotel.cityLabel")
                    : t("addHotel.cityLabel")}
                </label>
                <div className="relative">
                  {isManualEntry ? (
                    <input
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder={t("addHotel.locationPlaceholder")}
                      className="w-full bg-slate-900/50 border border-[var(--soft-gold)]/50 rounded-lg py-2.5 px-3 text-white focus:outline-none focus:ring-2 focus:ring-[var(--soft-gold)]/50 text-sm"
                    />
                  ) : (
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
                      className="w-full bg-slate-900/50 border border-white/10 rounded-lg py-2.5 px-3 text-white focus:outline-none focus:ring-2 focus:ring-[var(--soft-gold)]/50 text-sm [&>option]:bg-slate-900 transition-all"
                    >
                      <option value="">{t("addHotel.selectCity")}</option>
                      {filteredCities.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                      <option
                        value="__NEW__"
                        className="text-[var(--soft-gold)] font-bold bg-slate-900"
                      >
                        + {t("addHotel.addNewLocation")}
                      </option>
                    </select>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsManualEntry(!isManualEntry)}
                  className="text-[10px] text-[var(--soft-gold)] hover:underline flex items-center gap-1"
                >
                  <MapPin className="w-3 h-3" />
                  {isManualEntry
                    ? t("addHotel.selectCity")
                    : t("addHotel.manualEntry")}
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  {t("addHotel.currencyLabel")}
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full bg-slate-900/50 border border-white/10 rounded-lg py-2.5 px-3 text-white focus:outline-none focus:ring-2 focus:ring-[var(--soft-gold)]/50 text-sm [&>option]:bg-slate-900 disabled:opacity-50"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="TRY">TRY (₺)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 py-2">
            <input
              type="checkbox"
              id="isTarget"
              checked={isTarget}
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
              disabled={loading || (!city && !isManualEntry)}
              className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-extrabold text-sm py-3.5 rounded-xl shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 transform hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              ) : (
                <>
                  <Plus className="w-4 h-4 text-black stroke-[3px]" />
                  <span>{t("addHotel.submitButton")}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

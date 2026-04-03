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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="glass-modal w-full max-w-md max-h-[min(90vh,700px)] shadow-2xl border border-[var(--soft-gold)]/20">
        {/* Tactical Header */}
        <div className="p-6 border-b border-[var(--glass-border)] flex items-center justify-between shrink-0 bg-[var(--soft-gold)]/5">
          <div className="flex flex-col">
            <h2 className="text-xl font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-2">
              <Plus className="w-5 h-5 text-[var(--soft-gold)]" />
              {t("addHotel.title")}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-2 h-2 rounded-full bg-[var(--soft-gold)] animate-pulse shadow-[0_0_8px_var(--soft-gold)]" />
              <p className="text-[9px] uppercase tracking-[0.25em] text-[var(--soft-gold)] font-black">
                READY FOR DEPLOYMENT
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--glass-bg-accent)] rounded-xl transition-all hover:rotate-90 group border border-transparent hover:border-[var(--glass-border)]"
          >
            <X className="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--text-primary)]" />
          </button>
        </div>

        {/* Scrollable Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
            {/* Hotel Name Field */}
            <div className="space-y-2">
              <label className="tactical-label ml-1">
                {t("addHotel.nameLabel")}
              </label>
              <div className="relative z-50" ref={suggestionRef}>
                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--soft-gold)] opacity-50" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setSerpApiId(undefined);
                    setSuggestions([]);
                    setShowSuggestions(true);
                  }}
                  className="w-full bg-[var(--glass-bg-accent)] border border-[var(--glass-border)] rounded-xl py-3.5 pl-12 pr-12 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--soft-gold)] transition-all font-medium"
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
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 hover:bg-[var(--glass-bg-accent)] rounded-full transition-colors"
                  >
                    <X className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  </button>
                )}
                {isSearching && (
                  <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--soft-gold)] animate-spin" />
                )}

                {/* Suggestions Dropdown */}
                {showSuggestions && name.length >= 2 && !isSearching && (
                  <div className="absolute left-0 right-0 mt-2 bg-[var(--deep-ocean-lighter)] border border-[var(--glass-border)] rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 z-[100]">
                    <div className="max-h-60 overflow-y-auto custom-scrollbar">
                      {suggestions.length > 0 ? (
                        suggestions.map((item, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleSelectSuggestion(item)}
                            className="w-full px-4 py-3.5 text-left hover:bg-[var(--soft-gold)]/10 flex flex-col transition-all border-b border-[var(--glass-border)] last:border-none group/item hover:pl-6"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[var(--text-primary)] font-bold text-sm group-hover/item:text-[var(--soft-gold)] transition-colors">
                                {item.name}
                              </span>
                              {item.source === "serpapi" && (
                                <span className="text-[8px] bg-[var(--soft-gold)]/10 border border-[var(--soft-gold)]/30 text-[var(--soft-gold)] py-0.5 px-2 rounded-full uppercase tracking-widest font-black">
                                  {t("addHotel.globalMatch")}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1.5 opacity-60">
                              <MapPin className="w-3 h-3 text-[var(--soft-gold)]" />
                              <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-tight">
                                {item.location}
                              </span>
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-6 text-center">
                          <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-[0.2em] font-black">
                            {t("addHotel.noMatch")}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Location Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="tactical-label ml-1">
                  {t("addHotel.countryLabel")}
                </label>
                <select
                  value={country}
                  disabled={isManualEntry}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full bg-[var(--glass-bg-accent)] border border-[var(--glass-border)] rounded-xl py-3 px-4 text-[var(--text-primary)] focus:outline-none focus:border-[var(--soft-gold)] text-sm disabled:opacity-30 transition-all font-bold"
                >
                  {countries.map((c) => (
                    <option key={c} value={c} className="bg-[var(--deep-ocean-lighter)]">
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="tactical-label ml-1">
                  {t("addHotel.cityLabel")}
                </label>
                {isManualEntry ? (
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="ENTER CITY"
                    className="w-full bg-[var(--glass-bg-accent)] border border-[var(--soft-gold)]/30 rounded-xl py-3 px-4 text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--soft-gold)]/30 text-sm font-bold"
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
                    className="w-full bg-[var(--glass-bg-accent)] border border-[var(--glass-border)] rounded-xl py-3 px-4 text-[var(--text-primary)] focus:outline-none focus:border-[var(--soft-gold)] text-sm transition-all font-bold"
                  >
                    <option value="" className="bg-[var(--deep-ocean-lighter)]">{t("addHotel.selectCity")}</option>
                    {filteredCities.map((c) => (
                      <option key={c} value={c} className="bg-[var(--deep-ocean-lighter)]">
                        {c}
                      </option>
                    ))}
                    <option
                      value="__NEW__"
                      className="text-[var(--soft-gold)] font-black bg-[var(--deep-ocean-lighter)]"
                    >
                      + {t("addHotel.addNewLocation")}
                    </option>
                  </select>
                )}
              </div>
            </div>

            {/* Target & Currency Section */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between p-4 bg-[var(--glass-bg-accent)] border border-[var(--glass-border)] rounded-xl">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                    {t("addHotel.targetLabel")}
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)] font-medium">
                    Mark as primary tracking subject
                  </span>
                </div>
                <div className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    id="isTarget"
                    checked={isTarget}
                    onChange={(e) => setIsTarget(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-[var(--glass-border)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--soft-gold)]"></div>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-[var(--glass-bg-accent)] border border-[var(--glass-border)] rounded-xl">
                <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                  Report Currency
                </span>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="bg-transparent text-[var(--soft-gold)] text-xs font-black uppercase tracking-widest outline-none"
                >
                  <option value="USD" className="bg-[var(--deep-ocean-lighter)]">USD ($)</option>
                  <option value="EUR" className="bg-[var(--deep-ocean-lighter)]">EUR (€)</option>
                  <option value="TRY" className="bg-[var(--deep-ocean-lighter)]">TRY (₺)</option>
                  <option value="GBP" className="bg-[var(--deep-ocean-lighter)]">GBP (£)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-[var(--glass-border)] bg-[var(--glass-bg-accent)] shrink-0">
            <button
              type="submit"
              disabled={loading || (!city && !isManualEntry)}
              className="btn-premium w-full py-4 shadow-[0_10px_30px_rgba(212,175,55,0.1)] active:scale-95"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Plus className="w-5 h-5" />
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

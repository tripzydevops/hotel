"use client";

import { useState, useEffect, useRef } from "react";
import { X, Building2, MapPin, Loader2, Save, Globe } from "lucide-react";
import { api } from "@/lib/api";
import { Hotel } from "@/types";
import { useI18n } from "@/lib/i18n";

interface EditHotelModalProps {
  isOpen: boolean;
  onClose: () => void;
  hotel: Hotel;
  onUpdate: () => Promise<void>;
}

export default function EditHotelModal({
  isOpen,
  onClose,
  hotel,
  onUpdate,
}: EditHotelModalProps) {
  const { t } = useI18n();
  const [name, setName] = useState(hotel.name);
  const [location, setLocation] = useState(hotel.location || "");
  const [currency, setCurrency] = useState(hotel.preferred_currency || "TRY");
  const [isTarget, setIsTarget] = useState(hotel.is_target_hotel || false);
  const [serpApiId, setSerpApiId] = useState<string | undefined>(
    hotel.serp_api_id || undefined,
  );
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [fixedCheckIn, setFixedCheckIn] = useState(hotel.fixed_check_in || "");
  const [fixedCheckOut, setFixedCheckOut] = useState(
    hotel.fixed_check_out || "",
  );
  const [defaultAdults, setDefaultAdults] = useState(hotel.default_adults || 2);

  const suggestionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && hotel) {
      setName(hotel.name);
      setLocation(hotel.location || "");
      setCurrency(hotel.preferred_currency || "TRY");
      setIsTarget(hotel.is_target_hotel || false);
      setSerpApiId(hotel.serp_api_id);
      setFixedCheckIn(hotel.fixed_check_in || "");
      setFixedCheckOut(hotel.fixed_check_out || "");
      setDefaultAdults(hotel.default_adults || 2);
    }
  }, [isOpen, hotel]);

  useEffect(() => {
    const searchHotels = async () => {
      if (name.length < 2 || name === hotel.name) {
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
  }, [name, hotel.name]);

  const handleSelectSuggestion = (suggestion: any) => {
    setName(suggestion.name);
    setLocation(suggestion.location);
    setSerpApiId(suggestion.serp_api_id);
    setShowSuggestions(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.updateHotel(hotel.id, {
        name,
        location,
        preferred_currency: currency,
        is_target_hotel: isTarget,
        serp_api_id: serpApiId,
        fixed_check_in: fixedCheckIn || null,
        fixed_check_out: fixedCheckOut || null,
        default_adults: defaultAdults,
      });
      await onUpdate();
      onClose();
    } catch (error) {
      console.error("Error updating hotel:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-[var(--deep-ocean-card)] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[var(--soft-gold)]" />
            {t("editHotel.title")}
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
              {t("editHotel.nameLabel")}
            </label>
            <div className="relative z-50" ref={suggestionRef}>
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (e.target.value !== hotel.name) setSerpApiId(undefined);
                  setShowSuggestions(true);
                }}
                className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 pl-10 pr-10 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[var(--soft-gold)]/50"
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-[100] left-0 right-0 mt-1 bg-[var(--deep-ocean-card)] border border-white/10 rounded-lg shadow-2xl overflow-hidden">
                  {suggestions.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectSuggestion(item)}
                      className="w-full px-3 py-2 text-left hover:bg-white/5 border-b border-white/5"
                    >
                      <span className="text-white text-xs block">
                        {item.name}
                      </span>
                      <span className="text-[var(--text-muted)] text-[10px] block">
                        {item.location}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {serpApiId && (
              <p className="text-[10px] text-[var(--optimal-green)] mt-1 flex items-center gap-1">
                <Globe className="w-3 h-3" /> {t("editHotel.linkedToGoogle")}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                {t("editHotel.locationLabel")}
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type="text"
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[var(--soft-gold)]/50"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                {t("editHotel.currencyLabel")}
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

          <div className="h-px bg-white/5 my-2" />

          <div className="space-y-3">
            <p className="text-xs font-semibold text-[var(--soft-gold)] uppercase tracking-wider">
              {t("editHotel.defaultScanSettings")}
            </p>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1">
                <label className="block text-xs text-[var(--text-secondary)] mb-1">
                  {t("editHotel.adults")}
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={defaultAdults}
                  onChange={(e) => setDefaultAdults(parseInt(e.target.value))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-[var(--soft-gold)]/50 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">
                  {t("editHotel.fixedCheckIn")}
                </label>
                <input
                  type="date"
                  value={fixedCheckIn}
                  onChange={(e) => setFixedCheckIn(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-[var(--soft-gold)]/50 text-sm [color-scheme:dark]"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">
                  {t("editHotel.fixedCheckOut")}
                </label>
                <input
                  type="date"
                  value={fixedCheckOut}
                  onChange={(e) => setFixedCheckOut(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-[var(--soft-gold)]/50 text-sm [color-scheme:dark]"
                />
              </div>
            </div>
          </div>

          <div className="h-px bg-white/5 my-2" />

          <div className="flex items-center gap-2 py-2">
            <input
              type="checkbox"
              id="isTargetEdit"
              checked={isTarget}
              onChange={(e) => setIsTarget(e.target.checked)}
              className="w-4 h-4 rounded border-white/10 bg-white/5 text-[var(--soft-gold)] focus:ring-[var(--soft-gold)]/50 focus:ring-offset-0"
            />
            <label
              htmlFor="isTargetEdit"
              className="text-sm text-[var(--text-secondary)] cursor-pointer select-none"
            >
              {t("editHotel.targetLabel")}
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
                  <Save className="w-4 h-4" />
                  <span>{t("editHotel.submitButton")}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

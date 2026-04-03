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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="glass-modal w-full max-w-md max-h-[90vh] shadow-2xl border border-[var(--soft-gold)]/20 overflow-y-auto custom-scrollbar">
        {/* Tactical Header */}
        <div className="p-6 border-b border-[var(--glass-border)] flex items-center justify-between shrink-0 bg-[var(--soft-gold)]/5 sticky top-0 z-50 backdrop-blur-md">
          <div className="flex flex-col">
            <h2 className="text-xl font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[var(--soft-gold)]" />
              {t("editHotel.title")}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-2 h-2 rounded-full bg-[var(--optimal-green)] animate-pulse shadow-[0_0_8px_var(--optimal-green)]" />
              <p className="text-[9px] uppercase tracking-[0.25em] text-[var(--text-muted)] font-black">
                RECONFIGURATION INTERFACE
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

        <div className="p-6">

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="tactical-label ml-1 block mb-2">
              {t("editHotel.nameLabel")}
            </label>
            <div className="relative z-50" ref={suggestionRef}>
              <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--soft-gold)]/50" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (e.target.value !== hotel.name) setSerpApiId(undefined);
                  setShowSuggestions(true);
                }}
                className="w-full bg-[var(--glass-bg-accent)] border border-[var(--glass-border)] rounded-xl py-4 pl-12 pr-12 text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/50 focus:outline-none focus:border-[var(--soft-gold)] focus:ring-1 focus:ring-[var(--soft-gold)]/20 transition-all font-semibold"
              />
              {name.length > 0 && name !== hotel.name && !isSearching && (
                  <button
                    type="button"
                    onClick={() => {
                      setName(hotel.name);
                      setSerpApiId(hotel.serp_api_id);
                      setShowSuggestions(false);
                    }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 hover:bg-[var(--glass-bg-accent)] rounded-lg transition-colors"
                  >
                    <X className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  </button>
                )}
                {isSearching && (
                  <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--soft-gold)] animate-spin" />
                )}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-[100] left-0 right-0 mt-2 bg-[var(--deep-ocean-lighter)] border border-[var(--glass-border)] rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="max-h-60 overflow-y-auto custom-scrollbar">
                    {suggestions.map((item, idx) => (
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
                        </div>
                        <div className="flex items-center gap-1.5 mt-1.5 opacity-60">
                          <MapPin className="w-3 h-3 text-[var(--soft-gold)]" />
                          <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-tight">
                            {item.location}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
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
              <label className="tactical-label ml-1 block mb-2">
                {t("editHotel.locationLabel")}
              </label>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--soft-gold)]/50" />
                <input
                  type="text"
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full bg-[var(--glass-bg-accent)] border border-[var(--glass-border)] rounded-xl py-4 pl-12 pr-4 text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/50 focus:outline-none focus:border-[var(--soft-gold)] focus:ring-1 focus:ring-[var(--soft-gold)]/20 transition-all font-semibold"
                />
              </div>
            </div>

            <div>
              <label className="tactical-label ml-1 block mb-2">
                {t("editHotel.currencyLabel")}
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full bg-[var(--glass-bg-accent)] border border-[var(--glass-border)] rounded-xl py-4 px-4 text-[var(--text-primary)] focus:outline-none focus:border-[var(--soft-gold)] focus:ring-1 focus:ring-[var(--soft-gold)]/20 transition-all font-semibold text-sm [&>option]:bg-[var(--deep-ocean-card)]"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="TRY">TRY (₺)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </div>
          </div>

          <div className="h-px bg-[var(--glass-border)] my-2" />

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
                  className="w-full bg-[var(--deep-ocean-accent)]/10 border border-[var(--glass-border)] rounded-lg py-2 px-3 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--soft-gold)]/50 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="tactical-label ml-1 block mb-2 lowercase capitalize">
                  {t("editHotel.fixedCheckIn")}
                </label>
                <input
                  type="date"
                  value={fixedCheckIn}
                  onChange={(e) => setFixedCheckIn(e.target.value)}
                  className="w-full bg-[var(--glass-bg-accent)] border border-[var(--glass-border)] rounded-xl py-3 px-4 text-[var(--text-primary)] focus:outline-none focus:border-[var(--soft-gold)] focus:ring-1 focus:ring-[var(--soft-gold)]/20 transition-all font-semibold text-sm [color-scheme:dark]"
                />
              </div>
              <div>
                <label className="tactical-label ml-1 block mb-2 lowercase capitalize">
                  {t("editHotel.fixedCheckOut")}
                </label>
                <input
                  type="date"
                  value={fixedCheckOut}
                  onChange={(e) => setFixedCheckOut(e.target.value)}
                  className="w-full bg-[var(--glass-bg-accent)] border border-[var(--glass-border)] rounded-xl py-3 px-4 text-[var(--text-primary)] focus:outline-none focus:border-[var(--soft-gold)] focus:ring-1 focus:ring-[var(--soft-gold)]/20 transition-all font-semibold text-sm [color-scheme:dark]"
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
              className="w-4 h-4 rounded border-[var(--glass-border)] bg-[var(--deep-ocean-accent)]/10 text-[var(--soft-gold)] focus:ring-[var(--soft-gold)]/50 focus:ring-offset-0"
            />
            <label
              htmlFor="isTargetEdit"
              className="text-sm text-[var(--text-secondary)] cursor-pointer select-none"
            >
              {t("editHotel.targetLabel")}
            </label>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full btn-premium py-4"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  <span>{t("editHotel.submitButton")}</span>
                </>
              )}
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
}

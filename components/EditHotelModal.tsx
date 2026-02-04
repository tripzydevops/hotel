"use client";

import { useState, useEffect, useRef } from "react";
import {
  X,
  Building2,
  MapPin,
  Loader2,
  Save,
  Globe,
  Zap,
  Search,
  Calendar,
  Users as UsersIcon,
} from "lucide-react";
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl">
      <div className="premium-card w-full max-w-md p-8 shadow-2xl relative overflow-hidden bg-black/40 border-[var(--gold-primary)]/10">
        {/* Silk Glow Aura */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-[var(--gold-glow)] opacity-20 blur-[100px] pointer-events-none" />

        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-black text-white flex items-center gap-3 tracking-tighter">
              <Building2 className="w-6 h-6 text-[var(--gold-primary)]" />
              {t("editHotel.title")}
            </h2>
            <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-[0.4em] mt-1 ml-9">
              Protocol_Update
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 hover:bg-white/5 rounded-xl transition-all group"
          >
            <X className="w-5 h-5 text-[var(--text-muted)] group-hover:text-white transition-colors" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.3em] mb-2.5 ml-1">
              {t("editHotel.nameLabel")}
            </label>
            <div className="relative z-50 group" ref={suggestionRef}>
              <div className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-[var(--text-muted)] group-focus-within:text-[var(--gold-primary)] transition-colors" />
              </div>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (e.target.value !== hotel.name) setSerpApiId(undefined);
                  setShowSuggestions(true);
                }}
                className="w-full bg-black/40 border border-[var(--card-border)] rounded-2xl py-3.5 pl-12 pr-12 text-sm text-white focus:outline-none focus:border-[var(--gold-primary)]/50 focus:ring-1 focus:ring-[var(--gold-primary)]/20 transition-all font-semibold"
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-[100] left-0 right-0 mt-3 bg-[var(--bg-deep)]/95 border border-[var(--card-border)] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-3xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="max-h-56 overflow-y-auto custom-scrollbar">
                    {suggestions.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectSuggestion(item)}
                        className="w-full px-5 py-4 text-left hover:bg-white/5 flex flex-col transition-all border-b border-white/5 last:border-none group/item"
                      >
                        <span className="text-white font-bold text-sm tracking-tight group-hover/item:text-[var(--gold-primary)] transition-colors">
                          {item.name}
                        </span>
                        <div className="flex items-center gap-2 mt-1.5 opacity-60">
                          <MapPin className="w-3 h-3 text-[var(--text-muted)]" />
                          <span className="text-[var(--text-muted)] text-[10px] font-semibold tracking-wide uppercase">
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
              <p className="text-[10px] text-[var(--gold-primary)] mt-3 flex items-center gap-2 font-black uppercase tracking-widest opacity-80">
                <Globe className="w-3.5 h-3.5" />{" "}
                {t("editHotel.linkedToGoogle")}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.3em] mb-2.5 ml-1">
                {t("editHotel.locationLabel")}
              </label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-[var(--text-muted)] group-focus-within:text-[var(--gold-primary)] transition-colors" />
                </div>
                <input
                  type="text"
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full bg-black/40 border border-[var(--card-border)] rounded-2xl py-3.5 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-[var(--gold-primary)]/50 focus:ring-1 focus:ring-[var(--gold-primary)]/20 transition-all font-semibold"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.3em] mb-2.5 ml-1">
                {t("editHotel.currencyLabel")}
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full bg-black/40 border border-[var(--card-border)] rounded-2xl py-3.5 px-4 text-sm text-white focus:outline-none focus:border-[var(--gold-primary)]/50 transition-all font-semibold cursor-pointer"
              >
                <option value="USD" className="bg-[var(--bg-deep)]">
                  USD ($)
                </option>
                <option value="EUR" className="bg-[var(--bg-deep)]">
                  EUR (‎€)
                </option>
                <option value="TRY" className="bg-[var(--bg-deep)]">
                  TRY (₺)
                </option>
                <option value="GBP" className="bg-[var(--bg-deep)]">
                  GBP (£)
                </option>
              </select>
            </div>
          </div>

          <div className="bg-white/5 p-6 rounded-2xl border border-white/5 space-y-6">
            <h3 className="text-[10px] font-black text-[var(--gold-primary)] uppercase tracking-[0.3em] flex items-center gap-2">
              <Zap className="w-3.5 h-3.5" />
              {t("editHotel.defaultScanSettings")}
            </h3>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-1">
                <label className="block text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-2">
                  <UsersIcon className="w-3 h-3 inline mr-1 mb-0.5" />{" "}
                  {t("editHotel.adults")}
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={defaultAdults}
                  onChange={(e) => setDefaultAdults(parseInt(e.target.value))}
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-2 px-3 text-sm text-white focus:outline-none focus:border-[var(--gold-primary)]/50 transition-all font-bold"
                />
              </div>
              <div className="col-span-2 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-2">
                      <Calendar className="w-3 h-3 inline mr-1 mb-0.5" /> In
                    </label>
                    <input
                      type="date"
                      value={fixedCheckIn}
                      onChange={(e) => setFixedCheckIn(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl py-2 px-3 text-[10px] text-white focus:outline-none focus:border-[var(--gold-primary)]/50 transition-all font-bold [color-scheme:dark]"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-2">
                      <Calendar className="w-3 h-3 inline mr-1 mb-0.5" /> Out
                    </label>
                    <input
                      type="date"
                      value={fixedCheckOut}
                      onChange={(e) => setFixedCheckOut(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl py-2 px-3 text-[10px] text-white focus:outline-none focus:border-[var(--gold-primary)]/50 transition-all font-bold [color-scheme:dark]"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            className="bg-white/5 p-5 rounded-2xl border border-white/5 flex items-center justify-between group cursor-pointer hover:bg-white/[0.08] transition-all"
            onClick={() => setIsTarget(!isTarget)}
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-bold text-white uppercase tracking-tight">
                Market_Authority_Node
              </span>
              <span className="text-[9px] text-[var(--text-muted)] uppercase tracking-widest font-semibold opacity-60">
                Set as comparative baseline
              </span>
            </div>
            <div
              className={`w-10 h-6 rounded-full p-1 transition-all duration-300 ${isTarget ? "bg-[var(--gold-gradient)]" : "bg-white/10"}`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform duration-300 ${isTarget ? "translate-x-4" : "translate-x-0"}`}
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full btn-premium py-4 flex items-center justify-center gap-4 group disabled:opacity-30 transition-all"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-black/40 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-4 h-4 text-black group-hover:scale-125 transition-transform" />
                  <span className="font-black uppercase tracking-[0.2em] text-sm">
                    {t("editHotel.submitButton")}
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

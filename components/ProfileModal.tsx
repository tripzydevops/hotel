"use client";

import { useState, useEffect } from "react";
import {
  X,
  User,
  Building2,
  Briefcase,
  Phone,
  Globe,
  Save,
  Zap,
} from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

const TIMEZONES = [
  "UTC",
  "Europe/Istanbul",
  "Europe/London",
  "Europe/Paris",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Tokyo",
  "Asia/Dubai",
];

export default function ProfileModal({
  isOpen,
  onClose,
  userId,
}: ProfileModalProps) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    display_name: "",
    company_name: "",
    job_title: "",
    phone: "",
    timezone: "UTC",
  });

  useEffect(() => {
    if (isOpen && userId) {
      loadProfile();
    }
  }, [isOpen, userId]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const data = await api.getProfile(userId);
      setProfile({
        display_name: data.display_name || "",
        company_name: data.company_name || "",
        job_title: data.job_title || "",
        phone: data.phone || "",
        timezone: data.timezone || "UTC",
      });
    } catch (err) {
      console.error("Failed to load profile:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateProfile(userId, profile);
      onClose();
    } catch (err) {
      console.error("Failed to save profile:", err);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
      <div className="premium-card w-full max-w-md p-8 shadow-2xl relative overflow-hidden bg-black/40 border-[var(--gold-primary)]/10">
        {/* Silk Glow Aura */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-[var(--gold-glow)] opacity-20 blur-[100px] pointer-events-none" />

        <div className="flex items-center justify-between mb-10">
          <div>
            <h2 className="text-2xl font-black text-white flex items-center gap-3 tracking-tighter uppercase">
              <User className="w-6 h-6 text-[var(--gold-primary)]" />
              {t("profile.title")}
            </h2>
            <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-[0.4em] mt-1 ml-9">
              Node_Identity_Auth
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 hover:bg-white/5 rounded-xl transition-all group"
          >
            <X className="w-5 h-5 text-[var(--text-muted)] group-hover:text-white transition-colors" />
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="w-10 h-10 border-2 border-[var(--gold-primary)]/20 border-t-[var(--gold-primary)] rounded-full animate-spin" />
            <p className="text-[8px] font-black text-[var(--gold-primary)] uppercase tracking-widest animate-pulse">
              Synchronizing_Identity...
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Avatar Section */}
            <div className="flex justify-center mb-8 relative">
              <div className="relative group cursor-pointer">
                <div className="absolute inset-0 bg-[var(--gold-primary)]/20 rounded-full blur-2xl group-hover:blur-3xl transition-all duration-700" />
                <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-[var(--gold-primary)] to-[#8c6d00] p-[2px] shadow-2xl">
                  <div className="w-full h-full rounded-full bg-black flex items-center justify-center text-[var(--gold-primary)] text-3xl font-black">
                    {profile.display_name
                      ? profile.display_name.charAt(0).toUpperCase()
                      : "U"}
                  </div>
                </div>
                <div className="absolute -bottom-1 -right-1 bg-[var(--gold-gradient)] p-1.5 rounded-lg text-black shadow-lg">
                  <Zap className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>

            <div className="space-y-5">
              {/* Display Name */}
              <div>
                <label className="block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.3em] mb-2.5 ml-1">
                  {t("profile.displayName")}
                </label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center">
                    <User className="w-4 h-4 text-[var(--text-muted)] group-focus-within:text-[var(--gold-primary)] transition-colors" />
                  </div>
                  <input
                    type="text"
                    value={profile.display_name}
                    onChange={(e) =>
                      setProfile({ ...profile, display_name: e.target.value })
                    }
                    className="w-full bg-black/40 border border-[var(--card-border)] rounded-2xl py-3.5 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-[var(--gold-primary)]/50 focus:ring-1 focus:ring-[var(--gold-primary)]/20 transition-all font-semibold"
                  />
                </div>
              </div>

              {/* Company & Job */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.3em] mb-2.5 ml-1">
                    {t("profile.companyName")}
                  </label>
                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center">
                      <Building2 className="w-4 h-4 text-[var(--text-muted)] group-focus-within:text-[var(--gold-primary)] transition-colors" />
                    </div>
                    <input
                      type="text"
                      value={profile.company_name}
                      onChange={(e) =>
                        setProfile({ ...profile, company_name: e.target.value })
                      }
                      className="w-full bg-black/40 border border-[var(--card-border)] rounded-2xl py-3.5 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-[var(--gold-primary)]/50 focus:ring-1 focus:ring-[var(--gold-primary)]/20 transition-all font-semibold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.3em] mb-2.5 ml-1">
                    {t("profile.jobTitle")}
                  </label>
                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center">
                      <Briefcase className="w-4 h-4 text-[var(--text-muted)] group-focus-within:text-[var(--gold-primary)] transition-colors" />
                    </div>
                    <input
                      type="text"
                      value={profile.job_title}
                      onChange={(e) =>
                        setProfile({ ...profile, job_title: e.target.value })
                      }
                      className="w-full bg-black/40 border border-[var(--card-border)] rounded-2xl py-3.5 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-[var(--gold-primary)]/50 focus:ring-1 focus:ring-[var(--gold-primary)]/20 transition-all font-semibold"
                    />
                  </div>
                </div>
              </div>

              {/* Phone & Timezone */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.3em] mb-2.5 ml-1">
                    {t("profile.phone")}
                  </label>
                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center">
                      <Phone className="w-4 h-4 text-[var(--text-muted)] group-focus-within:text-[var(--gold-primary)] transition-colors" />
                    </div>
                    <input
                      type="tel"
                      value={profile.phone}
                      onChange={(e) =>
                        setProfile({ ...profile, phone: e.target.value })
                      }
                      className="w-full bg-black/40 border border-[var(--card-border)] rounded-2xl py-3.5 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-[var(--gold-primary)]/50 focus:ring-1 focus:ring-[var(--gold-primary)]/20 transition-all font-semibold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.3em] mb-2.5 ml-1">
                    {t("profile.timezone")}
                  </label>
                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center">
                      <Globe className="w-4 h-4 text-[var(--text-muted)] group-focus-within:text-[var(--gold-primary)] transition-colors" />
                    </div>
                    <select
                      value={profile.timezone}
                      onChange={(e) =>
                        setProfile({ ...profile, timezone: e.target.value })
                      }
                      className="w-full bg-black/40 border border-[var(--card-border)] rounded-2xl py-3.5 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-[var(--gold-primary)]/50 transition-all font-semibold appearance-none cursor-pointer"
                    >
                      {TIMEZONES.map((tz) => (
                        <option
                          key={tz}
                          value={tz}
                          className="bg-[var(--bg-deep)]"
                        >
                          {tz}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-4 pt-6">
              <button
                onClick={onClose}
                className="flex-1 py-4 rounded-2xl bg-white/5 text-[var(--text-muted)] font-black uppercase tracking-[0.2em] text-xs hover:bg-white/10 hover:text-white transition-all"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 btn-premium py-4 flex items-center justify-center gap-3 disabled:opacity-30 transition-all"
              >
                {saving ? (
                  <div className="w-5 h-5 border-2 border-black/40 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Save className="w-4 h-4 text-black" />
                    <span className="font-black uppercase tracking-[0.2em] text-xs leading-none mt-0.5">
                      {t("profile.saveProfile")}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

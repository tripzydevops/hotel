"use client";

import { useState, useEffect } from "react";
import { X, User, Building2, Briefcase, Phone, Globe } from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/components/ui/ToastContext";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  initialData?: any;
  onUpdate?: (profile: any) => void;
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
  initialData,
  onUpdate,
}: ProfileModalProps) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [loading, setLoading] = useState(!initialData);
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
      if (initialData) {
        setProfile({
          display_name: initialData.display_name || "",
          company_name: initialData.company_name || "",
          job_title: initialData.job_title || "",
          phone: initialData.phone || "",
          timezone: initialData.timezone || "UTC",
        });
        setLoading(false); 
      } else {
        setLoading(true);
      }
      loadProfile();
    }
  }, [isOpen, userId, !!initialData]);

  const loadProfile = async () => {
    try {
      const data = await api.getProfile();
      if (data) {
        setProfile({
          display_name: data.display_name || "",
          company_name: data.company_name || "",
          job_title: data.job_title || "",
          phone: data.phone || "",
          timezone: data.timezone || "UTC",
        });
      }
    } catch (err) {
      console.error("Failed to load profile:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!userId) {
      console.error("[ProfileModal] No userId provided to handleSave");
      toast.error("User ID is missing. Please refresh the page.");
      return;
    }

    setSaving(true);
    console.log("[ProfileModal] Saving profile for:", userId, profile);

    try {
      const updated = await api.updateProfile(profile);
      console.log("[ProfileModal] Profile updated successfully:", updated);

      // MERGE: Ensure enriched fields (role, plan) are preserved by merging 
      // with initialData if the server response is somehow partial.
      const fullProfile = { ...(initialData || {}), ...updated };

      if (onUpdate) onUpdate(fullProfile);
      toast.success(t("profile.saveSuccess") || "Profile updated successfully");
      onClose();
    } catch (err: any) {
      console.error("[ProfileModal] Failed to save profile:", err);
      toast.error(err.message || "Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <div className="glass-modal w-full max-w-md max-h-[min(90vh,650px)] shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-[var(--glass-border)] flex items-center justify-between shrink-0 bg-[var(--glass-bg-accent)]">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--soft-gold)] to-[#e6b800] flex items-center justify-center text-[var(--deep-ocean)] text-lg font-black shadow-lg ring-2 ring-[var(--soft-gold)]/20">
              {profile.display_name
                ? profile.display_name.charAt(0).toUpperCase()
                : "U"}
            </div>
            <div className="flex flex-col">
              <h2 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">
                {t("profile.title")}
              </h2>
              <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)] font-black mt-0.5">
                USER PROFILE CONFIGURATION
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--glass-bg-accent)] rounded-lg transition-all hover:rotate-90 group"
          >
            <X className="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--text-primary)]" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="w-10 h-10 border-2 border-[var(--soft-gold)] border-t-transparent rounded-full animate-spin" />
              <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] animate-pulse">
                {t("profile.loading")}
              </p>
            </div>
          ) : (
            <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
              {/* Display Name */}
              <div className="space-y-2">
                <label className="tactical-label ml-1">
                  {t("profile.displayName")}
                </label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--soft-gold)] opacity-50 group-focus-within:opacity-100 transition-opacity" />
                  <input
                    type="text"
                    value={profile.display_name}
                    onChange={(e) =>
                      setProfile({ ...profile, display_name: e.target.value })
                    }
                    placeholder={t("profile.namePlaceholder")}
                    className="w-full bg-[var(--glass-bg-accent)] border border-[var(--glass-border)] rounded-xl py-3.5 pl-12 pr-4 text-[var(--text-primary)] transition-all focus:outline-none focus:border-[var(--soft-gold)] font-medium"
                  />
                </div>
              </div>

              {/* Company Name */}
              <div className="space-y-2">
                <label className="tactical-label ml-1">
                  {t("profile.companyName")}
                </label>
                <div className="relative group">
                  <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--soft-gold)] opacity-50 group-focus-within:opacity-100 transition-opacity" />
                  <input
                    type="text"
                    value={profile.company_name}
                    onChange={(e) =>
                      setProfile({ ...profile, company_name: e.target.value })
                    }
                    placeholder={t("profile.companyPlaceholder")}
                    className="w-full bg-[var(--glass-bg-accent)] border border-[var(--glass-border)] rounded-xl py-3.5 pl-12 pr-4 text-[var(--text-primary)] transition-all focus:outline-none focus:border-[var(--soft-gold)] font-medium"
                  />
                </div>
              </div>

              {/* Job Title */}
              <div className="space-y-2">
                <label className="tactical-label ml-1">
                  {t("profile.jobTitle")}
                </label>
                <div className="relative group">
                  <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--soft-gold)] opacity-50 group-focus-within:opacity-100 transition-opacity" />
                  <input
                    type="text"
                    value={profile.job_title}
                    onChange={(e) =>
                      setProfile({ ...profile, job_title: e.target.value })
                    }
                    placeholder={t("profile.jobPlaceholder")}
                    className="w-full bg-[var(--glass-bg-accent)] border border-[var(--glass-border)] rounded-xl py-3.5 pl-12 pr-4 text-[var(--text-primary)] transition-all focus:outline-none focus:border-[var(--soft-gold)] font-medium"
                  />
                </div>
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <label className="tactical-label ml-1">
                  {t("profile.phone")}
                </label>
                <div className="relative group">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--soft-gold)] opacity-50 group-focus-within:opacity-100 transition-opacity" />
                  <input
                    type="tel"
                    value={profile.phone}
                    onChange={(e) =>
                      setProfile({ ...profile, phone: e.target.value })
                    }
                    placeholder={t("profile.phonePlaceholder")}
                    className="w-full bg-[var(--glass-bg-accent)] border border-[var(--glass-border)] rounded-xl py-3.5 pl-12 pr-4 text-[var(--text-primary)] transition-all focus:outline-none focus:border-[var(--soft-gold)] font-medium"
                  />
                </div>
              </div>

              {/* Timezone */}
              <div className="space-y-2">
                <label className="tactical-label ml-1">
                  {t("profile.timezone")}
                </label>
                <div className="relative group">
                  <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--soft-gold)] opacity-50 group-focus-within:opacity-100 transition-opacity" />
                  <select
                    value={profile.timezone}
                    onChange={(e) =>
                      setProfile({ ...profile, timezone: e.target.value })
                    }
                    className="w-full bg-[var(--glass-bg-accent)] border border-[var(--glass-border)] rounded-xl py-3.5 pl-12 pr-4 text-[var(--text-primary)] focus:outline-none focus:border-[var(--soft-gold)] font-bold transition-all"
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz} value={tz} className="bg-[var(--deep-ocean-lighter)]">
                        {tz}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[var(--glass-border)] bg-[var(--glass-bg-accent)] shrink-0 flex gap-4">
          <button
            onClick={onClose}
            className="flex-1 py-4 border border-[var(--glass-border)] rounded-xl text-[var(--text-primary)] font-bold hover:bg-[var(--glass-border)] transition-all active:scale-95"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex-1 py-4 btn-premium shadow-[0_10px_30px_rgba(212,175,55,0.1)] active:scale-95"
          >
            {saving ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>{t("profile.saving")}</span>
              </div>
            ) : t("profile.saveProfile")}
          </button>
        </div>
      </div>
    </div>
  );
}

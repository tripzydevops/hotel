"use client";

import { useState, useEffect } from "react";
import { X, User, Building2, Briefcase, Phone, Globe, Shield, Download, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { insforge } from "@/lib/insforge";
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
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
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
    // Reset delete confirmation state when modal opens/closes
    if (!isOpen) {
      setShowDeleteConfirm(false);
      setDeleteInput("");
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

  const handleExportData = async () => {
    setExporting(true);
    try {
      const data = await api.exportProfileData();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const timestamp = new Date().toISOString().split("T")[0];
      a.download = `hotelplus_data_export_${timestamp}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success(t("profile.exportSuccess") || "Your data export has been downloaded.");
    } catch (err: any) {
      console.error("[ProfileModal] Failed to export data:", err);
      toast.error(err.message || "Failed to export data. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteInput !== "DELETE") return;

    setDeleting(true);
    try {
      await api.purgeProfileData();
      toast.success(t("profile.deleteSuccess") || "Your account has been permanently deleted.");

      // Sign out and redirect
      try {
        await insforge.auth.signOut();
      } catch {}
      try {
        await fetch("/api/auth/session", { method: "DELETE" });
      } catch {}

      window.location.href = "/login";
    } catch (err: any) {
      console.error("[ProfileModal] Failed to delete account:", err);
      toast.error(err.message || "Failed to delete account. Please try again.");
      setDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass-card w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[var(--soft-gold)]/10 text-[var(--soft-gold)]">
              <User className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-[var(--text-primary)]">
              {t("profile.title")}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 text-[var(--text-muted)] hover:bg-white/10 hover:text-[var(--text-primary)] transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="w-8 h-8 border-2 border-[var(--soft-gold)] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium text-[var(--text-muted)] animate-pulse">
              {t("profile.loading")}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Avatar Placeholder */}
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[var(--soft-gold)] to-[#e6b800] flex items-center justify-center text-[var(--deep-ocean)] text-2xl font-bold shadow-lg">
                {profile.display_name
                  ? profile.display_name.charAt(0).toUpperCase()
                  : "U"}
              </div>
            </div>

            {/* Display Name */}
            <div>
              <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1.5">
                {t("profile.displayName")}
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={profile.display_name}
                  onChange={(e) =>
                    setProfile({ ...profile, display_name: e.target.value })
                  }
                  placeholder={t("profile.namePlaceholder")}
                  className="w-full bg-white/5 border border-[var(--overlay-border)] rounded-lg py-2.5 pl-10 pr-4 text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/30 focus:outline-none focus:ring-2 focus:ring-[var(--soft-gold)]/50"
                />
              </div>
            </div>

            {/* Company Name */}
            <div>
              <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1.5">
                {t("profile.companyName")}
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={profile.company_name}
                  onChange={(e) =>
                    setProfile({ ...profile, company_name: e.target.value })
                  }
                  placeholder={t("profile.companyPlaceholder")}
                  className="w-full bg-white/5 border border-[var(--overlay-border)] rounded-lg py-2.5 pl-10 pr-4 text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/30 focus:outline-none focus:ring-2 focus:ring-[var(--soft-gold)]/50"
                />
              </div>
            </div>

            {/* Job Title */}
            <div>
              <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1.5">
                {t("profile.jobTitle")}
              </label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={profile.job_title}
                  onChange={(e) =>
                    setProfile({ ...profile, job_title: e.target.value })
                  }
                  placeholder={t("profile.jobPlaceholder")}
                  className="w-full bg-white/5 border border-[var(--overlay-border)] rounded-lg py-2.5 pl-10 pr-4 text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/30 focus:outline-none focus:ring-2 focus:ring-[var(--soft-gold)]/50"
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1.5">
                {t("profile.phone")}
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type="tel"
                  value={profile.phone}
                  onChange={(e) =>
                    setProfile({ ...profile, phone: e.target.value })
                  }
                  placeholder={t("profile.phonePlaceholder")}
                  className="w-full bg-white/5 border border-[var(--overlay-border)] rounded-lg py-2.5 pl-10 pr-4 text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/30 focus:outline-none focus:ring-2 focus:ring-[var(--soft-gold)]/50"
                />
              </div>
            </div>

            {/* Timezone */}
            <div>
              <label className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1.5">
                {t("profile.timezone")}
              </label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <select
                  value={profile.timezone}
                  onChange={(e) =>
                    setProfile({ ...profile, timezone: e.target.value })
                  }
                  className="w-full bg-white/5 border border-[var(--overlay-border)] rounded-lg py-2.5 pl-10 pr-4 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--soft-gold)]/50 [&>option]:bg-[var(--deep-ocean-card)]"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* ── Privacy & Data Section ──────────────────────────────── */}
            <div className="border-t border-[var(--overlay-border)] pt-4 mt-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-[var(--soft-gold)]" />
                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                  {t("profile.privacyTitle") || "Privacy & Data"}
                </h3>
              </div>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed mb-4">
                {t("profile.privacyDescription") || "You have the right to export or delete your personal data at any time in accordance with GDPR and KVKK regulations."}
              </p>

              {/* Export Personal Data */}
              <div className="mb-3">
                <p className="text-[10px] text-[var(--text-muted)] mb-1.5">
                  {t("profile.exportDataDesc") || "Download a copy of all your personal data stored on our platform."}
                </p>
                <button
                  onClick={handleExportData}
                  disabled={exporting}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[var(--overlay-border)] bg-white/5 text-[var(--text-primary)] text-sm font-semibold hover:bg-white/10 transition-all disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  {exporting
                    ? (t("reports.exporting") || "Exporting...")
                    : (t("profile.exportData") || "Export Personal Data")}
                </button>
              </div>

              {/* Danger Zone — Delete Account */}
              <div className="border border-rose-500/20 rounded-xl p-3 mt-3">
                <p className="text-[10px] text-rose-400 mb-1.5">
                  {t("profile.deleteAccountDesc") || "This action is irreversible. All your personal data will be permanently removed."}
                </p>

                {!showDeleteConfirm ? (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-rose-500/10 text-rose-400 text-sm font-semibold hover:bg-rose-500/20 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                    {t("profile.deleteAccount") || "Permanently Delete Account"}
                  </button>
                ) : (
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-rose-400 uppercase tracking-widest">
                      {t("profile.deleteConfirmPrompt") || "Type DELETE to confirm"}
                    </label>
                    <input
                      type="text"
                      value={deleteInput}
                      onChange={(e) => setDeleteInput(e.target.value)}
                      placeholder="DELETE"
                      className="w-full bg-white/5 border border-rose-500/30 rounded-lg py-2 px-3 text-[var(--text-primary)] placeholder:text-rose-400/30 focus:outline-none focus:ring-2 focus:ring-rose-500/50 text-sm"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setShowDeleteConfirm(false);
                          setDeleteInput("");
                        }}
                        className="flex-1 py-2 rounded-xl bg-white/5 text-[var(--text-primary)] text-sm font-semibold hover:bg-white/10 transition-all"
                      >
                        {t("common.cancel") || "Cancel"}
                      </button>
                      <button
                        onClick={handleDeleteAccount}
                        disabled={deleteInput !== "DELETE" || deleting}
                        className="flex-1 py-2 rounded-xl bg-rose-500/10 text-rose-400 text-sm font-semibold hover:bg-rose-500/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        {deleting
                          ? (t("common.loading") || "Loading...")
                          : (t("profile.deleteConfirmButton") || "Confirm Deletion")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={onClose}
                className="flex-1 py-3 rounded-xl bg-white/5 text-[var(--text-primary)] font-bold hover:bg-white/10 transition-all"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-3 rounded-xl bg-[var(--soft-gold)] text-[var(--deep-ocean)] font-bold hover:bg-[var(--soft-gold-hover)] transition-all disabled:opacity-50"
              >
                {saving ? t("profile.saving") : t("profile.saveProfile")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

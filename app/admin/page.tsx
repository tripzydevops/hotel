"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Building2, MapPin, Database, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default function AdminPage() {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [serpApiId, setSerpApiId] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      await api.addHotelToDirectory(name, location, serpApiId || undefined);
      setSuccess(true);
      setName("");
      setLocation("");
      setSerpApiId("");
    } catch (err: any) {
      setError(err.message || "Failed to add hotel to directory");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--deep-ocean)] text-white p-6 sm:p-12">
      <div className="max-w-2xl mx-auto">
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-[var(--text-muted)] hover:text-white transition-colors mb-8 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back to Dashboard
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-[var(--soft-gold)]/20 flex items-center justify-center">
            <Database className="w-6 h-6 text-[var(--soft-gold)]" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Directory Management</h1>
            <p className="text-[var(--text-muted)] mt-1">Add hotels to the shared search directory</p>
          </div>
        </div>

        <div className="glass-card p-8 border border-white/10 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[var(--soft-gold)] to-[var(--optimal-green)] opacity-50" />
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                  Hotel Name
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[var(--soft-gold)]/50 transition-all font-medium"
                    placeholder="e.g. Hilton London Metropole"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                  Location (City, Country)
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    required
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[var(--soft-gold)]/50 transition-all font-medium"
                    placeholder="e.g. London, UK"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                  SerpApi Hotel ID (Optional)
                </label>
                <input
                  type="text"
                  value={serpApiId}
                  onChange={(e) => setSerpApiId(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg py-3 px-4 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[var(--soft-gold)]/50 transition-all font-medium"
                  placeholder="e.g. ChIJP3Sa8ziYEmsRUKgyFOm9llM"
                />
              </div>
            </div>

            {error && (
              <div className="bg-alert-red/10 border border-alert-red/20 text-alert-red p-4 rounded-lg text-sm flex items-center gap-3">
                <span className="shrink-0">⚠️</span>
                {error}
              </div>
            )}

            {success && (
              <div className="bg-[var(--optimal-green)]/10 border border-[var(--optimal-green)]/20 text-[var(--optimal-green)] p-4 rounded-lg text-sm flex items-center gap-3 animate-in fade-in zoom-in-95 duration-300">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                Hotel added to shared directory successfully!
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-[var(--soft-gold)] to-[#D4AF37] text-black font-bold py-3.5 rounded-lg shadow-[0_4px_20px_rgba(212,175,55,0.3)] hover:shadow-[0_6px_25px_rgba(212,175,55,0.4)] hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:translate-y-0 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing...
                </>
              ) : (
                "Add to Directory"
              )}
            </button>
          </form>
        </div>

        <div className="mt-12 p-6 rounded-2xl bg-white/5 border border-white/10 text-sm text-[var(--text-muted)] leading-relaxed">
          <p className="font-semibold text-[var(--text-secondary)] mb-2 uppercase tracking-wider text-xs">Admin Dashboard Note</p>
          Hotels added here will immediately be available in the auto-complete search for all users. This tool is designed to bypass the "Cold Start" problem by manually seeding verified hotel names into the shared repository.
        </div>
      </div>
    </div>
  );
}

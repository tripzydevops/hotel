"use client";

import { useState } from "react";
import { X, Building2, MapPin, Search } from "lucide-react";

interface AddHotelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (name: string, location: string, isTarget: boolean) => Promise<void>;
}

export default function AddHotelModal({
  isOpen,
  onClose,
  onAdd,
}: AddHotelModalProps) {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [isTarget, setIsTarget] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onAdd(name, location, isTarget);
      onClose();
      // Reset form
      setName("");
      setLocation("");
      setIsTarget(false);
    } catch (error) {
      console.error("Error adding hotel:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-[var(--deep-ocean-card)] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[var(--soft-gold)]" />
            Add New Hotel
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
              Hotel Name
            </label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[var(--soft-gold)]/50"
                placeholder="e.g. Grand Plaza Hotel"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
              Location
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <input
                type="text"
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[var(--soft-gold)]/50"
                placeholder="e.g. Miami Beach, FL"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 py-2">
            <input
              type="checkbox"
              id="isTarget"
              checked={isTarget}
              onChange={(e) => setIsTarget(e.target.checked)}
              className="w-4 h-4 rounded border-white/10 bg-white/5 text-[var(--soft-gold)] focus:ring-[var(--soft-gold)]/50 focus:ring-offset-0"
            />
            <label
              htmlFor="isTarget"
              className="text-sm text-[var(--text-secondary)] cursor-pointer select-none"
            >
              This is my hotel (Target Hotel)
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
                  <Plus className="w-4 h-4" />
                  <span>Add Hotel Monitor</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Helper icon
function Plus({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 4v16m8-8H4"
      />
    </svg>
  );
}

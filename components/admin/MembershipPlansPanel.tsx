"use client";

import React, { useState, useEffect } from "react";
import {
  Crown,
  Plus,
  Edit2,
  Trash2,
  X,
  Save,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { api } from "@/lib/api";

const MembershipPlansPanel = () => {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [formData, setFormData] = useState<{
    name: string;
    price_monthly: number;
    hotel_limit: number;
    scan_frequency_limit: string;
    monthly_scan_limit: number;
    features: string[];
  }>({
    name: "",
    price_monthly: 0,
    hotel_limit: 1,
    scan_frequency_limit: "daily",
    monthly_scan_limit: 100,
    features: [],
  });

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    setLoading(true);
    try {
      const data = await api.getAdminPlans();
      setPlans(data);
    } catch (err) {
      console.error("Failed to load plans", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...formData,
      features: Array.isArray(formData.features) ? formData.features : [],
    };

    try {
      if (editingPlan) {
        await api.updateAdminPlan(editingPlan.id, payload);
      } else {
        await api.createAdminPlan(payload);
      }
      setIsModalOpen(false);
      setEditingPlan(null);
      setFormData({
        name: "",
        price_monthly: 0,
        hotel_limit: 1,
        scan_frequency_limit: "daily",
        monthly_scan_limit: 100,
        features: [],
      });
      loadPlans();
    } catch (err: any) {
      alert("Failed to save: " + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this plan? Users on this plan might be affected."))
      return;
    try {
      await api.deleteAdminPlan(id);
      loadPlans();
    } catch (err: any) {
      alert("Delete failed: " + err.message);
    }
  };

  const openEdit = (plan: any) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      price_monthly: plan.price_monthly,
      hotel_limit: plan.hotel_limit,
      scan_frequency_limit: plan.scan_frequency_limit,
      monthly_scan_limit: plan.monthly_scan_limit || 100,
      features: Array.isArray(plan.features) ? plan.features : [],
    });
    setIsModalOpen(true);
  };

  if (loading && plans.length === 0) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--soft-gold)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Crown className="w-6 h-6 text-[var(--soft-gold)]" />
          <h3 className="text-xl font-bold text-white">Membership Plans</h3>
        </div>
        <button
          onClick={() => {
            setEditingPlan(null);
            setFormData({
              name: "",
              price_monthly: 0,
              hotel_limit: 1,
              scan_frequency_limit: "daily",
              monthly_scan_limit: 100,
              features: [],
            });
            setIsModalOpen(true);
          }}
          className="bg-[var(--soft-gold)] text-black font-bold px-4 py-2 rounded-lg hover:opacity-90 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add Plan
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className="glass-card p-6 border border-white/10 relative group"
          >
            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => openEdit(plan)}
                className="p-1.5 bg-white/10 hover:bg-white/20 rounded text-white"
              >
                <Edit2 className="w-3 h-3" />
              </button>
              <button
                onClick={() => handleDelete(plan.id)}
                className="p-1.5 bg-red-500/20 hover:bg-red-500/40 rounded text-red-200"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>

            <h4 className="text-lg font-bold text-white mb-1">{plan.name}</h4>
            <div className="text-2xl font-bold text-[var(--soft-gold)] mb-4">
              ${plan.price_monthly}
              <span className="text-xs text-[var(--text-muted)] font-normal">
                /mo
              </span>
            </div>

            <div className="space-y-2 text-sm text-[var(--text-muted)]">
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span>Monitors</span>
                <span className="text-white">{plan.hotel_limit} Hotels</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span>Frequency</span>
                <span className="text-white capitalize">
                  {plan.scan_frequency_limit}
                </span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1">
                <span>Monthly Limit</span>
                <span className="text-white">
                  {plan.monthly_scan_limit || 100} Scans
                </span>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {Array.isArray(plan.features) &&
                plan.features.map((f: string, i: number) => (
                  <span
                    key={i}
                    className="text-[10px] bg-white/5 px-2 py-1 rounded text-[var(--text-secondary)]"
                  >
                    {f}
                  </span>
                ))}
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card p-6 border border-white/10 w-full max-w-md">
            <h3 className="text-xl font-bold text-white mb-4">
              {editingPlan ? "Edit Plan" : "Create Plan"}
            </h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs uppercase text-[var(--text-muted)] mb-1">
                  Plan Name
                </label>
                <input
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full bg-black/30 border border-white/10 rounded px-3 py-2 text-white"
                  placeholder="e.g. Gold"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase text-[var(--text-muted)] mb-1">
                    Price ($)
                  </label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    value={formData.price_monthly}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        price_monthly: parseFloat(e.target.value),
                      })
                    }
                    className="w-full bg-black/30 border border-white/10 rounded px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase text-[var(--text-muted)] mb-1">
                    Hotel Limit
                  </label>
                  <input
                    required
                    type="number"
                    value={formData.hotel_limit}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        hotel_limit: parseInt(e.target.value),
                      })
                    }
                    className="w-full bg-black/30 border border-white/10 rounded px-3 py-2 text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase text-[var(--text-muted)] mb-1">
                    Monthly Scan Limit
                  </label>
                  <input
                    required
                    type="number"
                    value={formData.monthly_scan_limit}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        monthly_scan_limit: parseInt(e.target.value),
                      })
                    }
                    className="w-full bg-black/30 border border-white/10 rounded px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase text-[var(--text-muted)] mb-1">
                    Scan Frequency
                  </label>
                  <select
                    value={formData.scan_frequency_limit}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        scan_frequency_limit: e.target.value,
                      })
                    }
                    className="w-full bg-black/30 border border-white/10 rounded px-3 py-2 text-white [&>option]:bg-black"
                  >
                    <option value="daily">Daily</option>
                    <option value="hourly">Hourly</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs uppercase text-[var(--text-muted)] mb-1">
                  Features (Press Enter to add)
                </label>
                <div className="bg-black/30 border border-white/10 rounded px-3 py-2 min-h-[50px] flex flex-wrap gap-2">
                  {formData.features.map((feat: string, i: number) => (
                    <span
                      key={i}
                      className="bg-[var(--soft-gold)]/20 text-[var(--soft-gold)] px-2 py-1 rounded text-xs flex items-center gap-1"
                    >
                      {feat}
                      <button
                        type="button"
                        onClick={() => {
                          const newFeats = [...formData.features];
                          newFeats.splice(i, 1);
                          setFormData({
                            ...formData,
                            features: newFeats,
                          });
                        }}
                        className="hover:text-white"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <input
                    className="flex-1 bg-transparent border-none outline-none text-white text-xs"
                    placeholder="Type and enter..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const val = e.currentTarget.value.trim();
                        if (val && !formData.features.includes(val)) {
                          setFormData({
                            ...formData,
                            features: [...formData.features, val],
                          });
                          e.currentTarget.value = "";
                        }
                      }
                    }}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-[var(--soft-gold)] text-black font-bold rounded-lg hover:opacity-90"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MembershipPlansPanel;

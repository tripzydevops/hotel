"use client";

import React, { useState, useEffect } from "react";
import { 
  Save, 
  RotateCcw, 
  Layout, 
  Zap, 
  CheckCircle, 
  DollarSign, 
  MessageSquare, 
  Plus, 
  Trash2, 
  ChevronDown, 
  ChevronUp,
  Image as ImageIcon
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/ToastContext";
import { motion, AnimatePresence } from "framer-motion";

export default function LandingPageEditor() {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState("hero");
  const [activeLocale, setActiveLocale] = useState("tr");

  useEffect(() => {
    loadConfig();
  }, [activeLocale]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const data = await api.getAdminLandingConfig(activeLocale);
      setConfigs(data);
      if (data.length > 0 && !activeSection) {
        setActiveSection(data[0].key);
      }
    } catch (err) {
      toast.error("Failed to load landing config");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateContent = (key: string, newContent: any) => {
    setConfigs(prev => prev.map(c => c.key === key ? { ...c, content: newContent } : c));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateLandingConfig(configs, activeLocale);
      toast.success(`Landing page configuration (${activeLocale.toUpperCase()}) updated!`);
    } catch (err) {
      toast.error("Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-20 text-center">
        <div className="w-10 h-10 border-2 border-[var(--soft-gold)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-xs font-black text-[var(--text-muted)] uppercase tracking-widest">Synchronizing CMS...</p>
      </div>
    );
  }

  const currentConfig = configs.find(c => c.key === activeSection);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight">Landing Page CMS</h2>
          <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest mt-1">Kaizen Content Management</p>
        </div>
        <div className="flex gap-3 items-center">
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 mr-2">
            <button
              onClick={() => setActiveLocale("tr")}
              className={`px-3 py-1 rounded-lg text-[10px] font-black transition-all ${
                activeLocale === "tr" ? "bg-[var(--soft-gold)] text-[var(--deep-ocean)]" : "text-slate-400 hover:text-white"
              }`}
            >
              TR
            </button>
            <button
              onClick={() => setActiveLocale("en")}
              className={`px-3 py-1 rounded-lg text-[10px] font-black transition-all ${
                activeLocale === "en" ? "bg-[var(--soft-gold)] text-[var(--deep-ocean)]" : "text-slate-400 hover:text-white"
              }`}
            >
              EN
            </button>
          </div>
          <button 
            onClick={loadConfig}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 text-slate-300 hover:text-white transition-all font-bold text-xs border border-white/5"
          >
            <RotateCcw className="w-4 h-4" />
            Reload
          </button>
          <button 
            onClick={handleSave}
            disabled={saving}
            className="btn-gold flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-black"
          >
            {saving ? <div className="w-4 h-4 border-2 border-[var(--deep-ocean)] border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
            Save {activeLocale.toUpperCase()}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Navigation Sidebar */}
        <div className="lg:col-span-1 space-y-2">
          {configs.map(config => (
            <button
              key={config.key}
              onClick={() => setActiveSection(config.key)}
              className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-300 flex items-center gap-3 border ${
                activeSection === config.key 
                  ? "bg-[var(--soft-gold)]/10 border-[var(--soft-gold)]/30 text-[var(--soft-gold)]" 
                  : "bg-white/5 border-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Layout className="w-4 h-4" />
              <span className="text-xs font-black uppercase tracking-widest">{config.key.replace('_', ' ')}</span>
            </button>
          ))}
        </div>

        {/* Editor Area */}
        <div className="lg:col-span-3">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="command-card p-8"
            >
              {activeSection === "hero" && (
                <HeroEditor content={currentConfig?.content} onChange={(val: any) => handleUpdateContent("hero", val)} />
              )}
              {activeSection === "stats" && (
                <StatsEditor content={currentConfig?.content} onChange={(val: any) => handleUpdateContent("stats", val)} />
              )}
              {activeSection === "features" && (
                <FeaturesEditor content={currentConfig?.content} onChange={(val: any) => handleUpdateContent("features", val)} />
              )}
              {activeSection === "pricing" && (
                <PricingEditor content={currentConfig?.content} onChange={(val: any) => handleUpdateContent("pricing", val)} />
              )}
              {activeSection === "faq" && (
                <FAQEditor content={currentConfig?.content} onChange={(val: any) => handleUpdateContent("faq", val)} />
              )}
              {activeSection === "footer_cta" && (
                <FooterCTAEditor content={currentConfig?.content} onChange={(val: any) => handleUpdateContent("footer_cta", val)} />
              )}
              {activeSection === "testimonials" && (
                <TestimonialsEditor content={currentConfig?.content} onChange={(val: any) => handleUpdateContent("testimonials", val)} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/* --- SECTION EDITORS --- */

function HeroEditor({ content, onChange }: any) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <Input label="Top Label" value={content.top_label} onChange={(v: string) => onChange({...content, top_label: v})} />
        <Input label="Title Main" value={content.title_main} onChange={(v: string) => onChange({...content, title_main: v})} />
      </div>
      <div className="grid grid-cols-2 gap-6">
        <Input label="Title Highlight" value={content.title_highlight} onChange={(v: string) => onChange({...content, title_highlight: v})} />
        <Input label="Title Suffix" value={content.title_suffix} onChange={(v: string) => onChange({...content, title_suffix: v})} />
      </div>
      <TextArea label="Description" value={content.description} onChange={(v: string) => onChange({...content, description: v})} />
      <div className="grid grid-cols-2 gap-6">
        <Input label="Primary CTA" value={content.cta_primary} onChange={(v: string) => onChange({...content, cta_primary: v})} />
        <Input label="Secondary CTA" value={content.cta_secondary} onChange={(v: string) => onChange({...content, cta_secondary: v})} />
      </div>
    </div>
  );
}

function StatsEditor({ content, onChange }: any) {
  return (
    <div className="space-y-6">
      {content.map((item: any, i: number) => (
        <div key={i} className="flex gap-4 items-end bg-white/5 p-4 rounded-xl border border-white/5">
          <Input className="flex-1" label="Value" value={item.value} onChange={(v: string) => {
            const next = [...content];
            next[i].value = Number(v);
            onChange(next);
          }} />
          <Input className="w-24" label="Suffix" value={item.suffix} onChange={(v: string) => {
            const next = [...content];
            next[i].suffix = v;
            onChange(next);
          }} />
          <Input className="flex-1" label="Label" value={item.label} onChange={(v: string) => {
            const next = [...content];
            next[i].label = v;
            onChange(next);
          }} />
        </div>
      ))}
    </div>
  );
}

function FeaturesEditor({ content, onChange }: any) {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-6 border-b border-white/5 pb-8 mb-8">
        <Input label="Section Subtitle" value={content.subtitle} onChange={(v: string) => onChange({...content, subtitle: v})} />
        <Input label="Section Title" value={content.title} onChange={(v: string) => onChange({...content, title: v})} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {content.items.map((item: any, i: number) => (
          <div key={i} className="bg-white/5 p-6 rounded-xl border border-white/5 space-y-4">
            <Input label="Title" value={item.title} onChange={(v: string) => {
              const next = {...content};
              next.items[i].title = v;
              onChange(next);
            }} />
            <TextArea label="Description" value={item.description} onChange={(v: string) => {
              const next = {...content};
              next.items[i].description = v;
              onChange(next);
            }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function PricingEditor({ content, onChange }: any) {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-6 border-b border-white/5 pb-8 mb-8">
        <Input label="Section Subtitle" value={content.subtitle} onChange={(v: string) => onChange({...content, subtitle: v})} />
        <Input label="Section Title" value={content.title} onChange={(v: string) => onChange({...content, title: v})} />
      </div>
      <div className="space-y-6">
        {content.plans.map((plan: any, i: number) => (
          <div key={i} className="bg-white/5 p-6 rounded-xl border border-white/5 space-y-4 relative">
            <div className="flex gap-4">
              <Input className="flex-1" label="Plan Name" value={plan.name} onChange={(v: string) => {
                const next = {...content};
                next.plans[i].name = v;
                onChange(next);
              }} />
              <Input className="w-32" label="Price" value={plan.price} onChange={(v: string) => {
                const next = {...content};
                next.plans[i].price = v;
                onChange(next);
              }} />
              <Input className="w-24" label="Period" value={plan.period} onChange={(v: string) => {
                const next = {...content};
                next.plans[i].period = v;
                onChange(next);
              }} />
            </div>
            <Input label="Description" value={plan.description} onChange={(v: string) => {
              const next = {...content};
              next.plans[i].description = v;
              onChange(next);
            }} />
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Features (Comma separated)</label>
              <textarea 
                className="w-full bg-[var(--deep-ocean)] border border-white/10 rounded-xl px-4 py-3 text-xs font-bold text-white focus:outline-none focus:border-[var(--soft-gold)]/50 transition-all min-h-[80px]"
                value={plan.features.join(", ")}
                onChange={e => {
                  const next = {...content};
                  next.plans[i].features = e.target.value.split(",").map(f => f.trim());
                  onChange(next);
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FAQEditor({ content, onChange }: any) {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-6 border-b border-white/5 pb-8 mb-8">
        <Input label="Section Title" value={content.title} onChange={(v: string) => onChange({...content, title: v})} />
        <Input label="Section Subtitle" value={content.subtitle} onChange={(v: string) => onChange({...content, subtitle: v})} />
      </div>
      <div className="space-y-4">
        {content.items.map((item: any, i: number) => (
          <div key={i} className="bg-white/5 p-6 rounded-xl border border-white/5 space-y-4">
            <Input label="Question" value={item.q} onChange={(v: string) => {
              const next = {...content};
              next.items[i].q = v;
              onChange(next);
            }} />
            <TextArea label="Answer" value={item.a} onChange={(v: string) => {
              const next = {...content};
              next.items[i].a = v;
              onChange(next);
            }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function TestimonialsEditor({ content, onChange }: any) {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-6 border-b border-white/5 pb-8 mb-8">
        <Input label="Section Title" value={content.title} onChange={(v: string) => onChange({...content, title: v})} />
        <Input label="Section Subtitle" value={content.subtitle} onChange={(v: string) => onChange({...content, subtitle: v})} />
      </div>
      <div className="space-y-4">
        {content.items.map((item: any, i: number) => (
          <div key={i} className="bg-white/5 p-6 rounded-xl border border-white/5 space-y-4">
            <TextArea label="Quote" value={item.quote} onChange={(v: string) => {
              const next = {...content};
              next.items[i].quote = v;
              onChange(next);
            }} />
           <div className="grid grid-cols-3 gap-4">
              <Input label="Author" value={item.author} onChange={(v: string) => {
                const next = {...content};
                next.items[i].author = v;
                onChange(next);
              }} />
              <Input label="Role" value={item.role} onChange={(v: string) => {
                const next = {...content};
                next.items[i].role = v;
                onChange(next);
              }} />
              <Input label="Initials" value={item.initials} onChange={(v: string) => {
                const next = {...content};
                next.items[i].initials = v;
                onChange(next);
              }} />
           </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FooterCTAEditor({ content, onChange }: any) {
  return (
    <div className="space-y-6">
      <Input label="Title" value={content.title} onChange={(v: string) => onChange({...content, title: v})} />
      <Input label="Title Highlight" value={content.title_highlight} onChange={(v: string) => onChange({...content, title_highlight: v})} />
      <TextArea label="Description" value={content.description} onChange={(v: string) => onChange({...content, description: v})} />
      <div className="grid grid-cols-2 gap-6">
        <Input label="Primary CTA" value={content.cta_primary} onChange={(v: string) => onChange({...content, cta_primary: v})} />
        <Input label="Secondary CTA" value={content.cta_secondary} onChange={(v: string) => onChange({...content, cta_secondary: v})} />
      </div>
    </div>
  );
}


/* --- UI UTILS --- */

function Input({ label, value, onChange, className = "" }: any) {
  return (
    <div className={`space-y-2 ${className}`}>
      <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] ml-1">{label}</label>
      <input 
        type="text" 
        className="w-full bg-[var(--deep-ocean)] border border-white/10 rounded-xl px-4 py-3 text-xs font-bold text-white focus:outline-none focus:border-[var(--soft-gold)]/50 transition-all"
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}

function TextArea({ label, value, onChange, className = "" }: any) {
  return (
    <div className={`space-y-2 ${className}`}>
      <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] ml-1">{label}</label>
      <textarea 
        className="w-full bg-[var(--deep-ocean)] border border-white/10 rounded-xl px-4 py-3 text-xs font-bold text-white focus:outline-none focus:border-[var(--soft-gold)]/50 transition-all min-h-[100px]"
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}

"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare, Plus, Trash2, Sparkles, Loader2,
  AlertTriangle, CheckCircle2, HelpCircle, Tag
} from "lucide-react";
import { api } from "@/lib/api";

interface Annotation {
  id: string;
  note: string;
  annotation_type: string;
  created_at: string;
  user_profiles?: { display_name: string; avatar_url?: string };
}

interface MeetingPrep {
  brief: string;
  action_items: string[];
  risks: string[];
  decisions_needed?: string[];
}

const TYPE_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  general: { icon: MessageSquare, color: "text-blue-400", label: "Note" },
  decision: { icon: CheckCircle2, color: "text-emerald-400", label: "Decision" },
  question: { icon: HelpCircle, color: "text-yellow-400", label: "Question" },
  risk: { icon: AlertTriangle, color: "text-rose-400", label: "Risk" },
};

export default function AnnotationsPanel({ hotelId }: { hotelId: string }) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [note, setNote] = useState("");
  const [type, setType] = useState("general");
  const [submitting, setSubmitting] = useState(false);
  const [meetingPrep, setMeetingPrep] = useState<MeetingPrep | null>(null);
  const [prepLoading, setPrepLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const load = async () => {
    try {
      const data = await api.getAnnotations(hotelId);
      setAnnotations(data || []);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { if (hotelId) load(); }, [hotelId]);

  const submit = async () => {
    if (!note.trim() || note.trim().length < 3) return;
    setSubmitting(true);
    try {
      const created = await api.addAnnotation(hotelId, note.trim(), type);
      setAnnotations((prev) => [created, ...prev]);
      setNote("");
      textareaRef.current?.focus();
    } catch {}
    finally { setSubmitting(false); }
  };

  const deleteAnnotation = async (id: string) => {
    try {
      await api.deleteAnnotation(hotelId, id);
      setAnnotations((prev) => prev.filter((a) => a.id !== id));
    } catch {}
  };

  const generateMeetingPrep = async () => {
    setPrepLoading(true);
    setMeetingPrep(null);
    try {
      const result = await api.generateMeetingPrep(hotelId);
      setMeetingPrep(result);
    } catch {}
    finally { setPrepLoading(false); }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("en-GB", {
        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
      });
    } catch { return iso; }
  };

  return (
    <div className="glass-card p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-black text-[var(--overlay-text)]">Team Annotations</h4>
            <p className="text-[9px] uppercase tracking-widest text-[var(--text-muted)] font-bold">
              Collaborative Intelligence
            </p>
          </div>
        </div>
        <button
          onClick={generateMeetingPrep}
          disabled={prepLoading || annotations.length === 0}
          className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20 transition-colors disabled:opacity-40"
        >
          {prepLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
          Meeting Prep
        </button>
      </div>

      {/* Meeting Prep Result */}
      <AnimatePresence>
        {meetingPrep && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/20 space-y-3"
          >
            <div className="text-[9px] text-indigo-400 uppercase font-black tracking-widest flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> AI Meeting Brief
            </div>
            <p className="text-xs text-[var(--overlay-text)] leading-relaxed">{meetingPrep.brief}</p>
            {meetingPrep.action_items.length > 0 && (
              <div>
                <div className="text-[8px] text-[var(--text-muted)] uppercase font-black tracking-widest mb-1">Action Items</div>
                {meetingPrep.action_items.map((item, i) => (
                  <div key={i} className="text-[10px] text-[var(--text-secondary)] flex items-start gap-1.5 mb-0.5">
                    <span className="text-indigo-400 mt-0.5">•</span> {item}
                  </div>
                ))}
              </div>
            )}
            {meetingPrep.risks.length > 0 && (
              <div>
                <div className="text-[8px] text-rose-400 uppercase font-black tracking-widest mb-1">Risks</div>
                {meetingPrep.risks.map((r, i) => (
                  <div key={i} className="text-[10px] text-rose-400/70 flex items-start gap-1.5 mb-0.5">
                    <AlertTriangle className="w-2.5 h-2.5 flex-shrink-0 mt-0.5" /> {r}
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Annotation */}
      <div className="space-y-2">
        {/* Type selector */}
        <div className="flex gap-1.5 flex-wrap">
          {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => setType(key)}
              className={`flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full border transition-colors ${
                type === key
                  ? `${cfg.color} bg-white/10 border-current`
                  : "text-[var(--text-muted)] border-[var(--overlay-border)] hover:border-white/20"
              }`}
            >
              <cfg.icon className="w-2.5 h-2.5" />
              {cfg.label}
            </button>
          ))}
        </div>

        <textarea
          ref={textareaRef}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a team note, decision, risk, or question..."
          rows={2}
          className="w-full bg-[var(--deep-ocean-accent)]/40 border border-[var(--overlay-border)] rounded-lg p-3 text-xs text-[var(--overlay-text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-indigo-500/50 resize-none transition-colors"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          }}
        />

        <button
          onClick={submit}
          disabled={submitting || note.trim().length < 3}
          className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg bg-indigo-500 text-white hover:bg-indigo-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
          Add Note
        </button>
      </div>

      {/* Annotations List */}
      <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin">
        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-12 bg-white/5 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : annotations.length === 0 ? (
          <div className="text-center py-6 text-[var(--text-muted)] text-xs">
            No annotations yet. Be the first to add a team note.
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {annotations.map((a) => {
              const cfg = TYPE_CONFIG[a.annotation_type] || TYPE_CONFIG.general;
              return (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="flex items-start gap-2.5 p-3 rounded-lg bg-[var(--deep-ocean-accent)]/20 border border-[var(--overlay-border)] group/ann"
                >
                  <cfg.icon className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${cfg.color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{a.note}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[8px] text-[var(--text-muted)]">
                        {a.user_profiles?.display_name || "Team"} · {formatDate(a.created_at)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteAnnotation(a.id)}
                    className="opacity-0 group-hover/ann:opacity-100 transition-opacity p-1 text-[var(--text-muted)] hover:text-rose-400"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

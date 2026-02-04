import { Lock, Crown, Zap, ShieldAlert, Sparkles, Mail } from "lucide-react";

interface PaywallOverlayProps {
  reason?: string;
}

export function PaywallOverlay({
  reason = "Your trial epoch has concluded.",
}: PaywallOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 animate-in fade-in duration-700 overflow-hidden">
      {/* Background Signal Interference */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-red-500/10 blur-[150px] rounded-full animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-[var(--gold-primary)]/10 blur-[150px] rounded-full animate-pulse" />
      </div>

      <div className="premium-card max-w-lg w-full p-12 text-center border-t border-[var(--gold-primary)]/20 shadow-[0_50px_100px_rgba(0,0,0,0.8)] relative overflow-hidden group">
        {/* Silk Glow Aura */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-[var(--gold-glow)] opacity-20 blur-[100px] pointer-events-none" />

        <div className="relative mb-10">
          <div className="absolute inset-0 bg-red-500/20 blur-2xl rounded-full scale-150 group-hover:scale-110 transition-transform duration-1000" />
          <div className="mx-auto w-24 h-24 bg-black border-2 border-red-500/40 rounded-[2.5rem] flex items-center justify-center relative shadow-[0_0_50px_rgba(239,68,68,0.2)]">
            <Lock className="w-10 h-10 text-red-500 group-hover:scale-110 transition-transform" />
          </div>
        </div>

        <div className="space-y-4 mb-10">
          <h2 className="text-4xl font-black text-white tracking-tighter uppercase italic leading-none">
            PROTOCOL_RESTRICTED
          </h2>
          <div className="flex items-center justify-center gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
            <span className="text-[10px] font-black text-red-500 uppercase tracking-[0.4em] opacity-80">
              Security_Lock_Engaged
            </span>
          </div>
        </div>

        <p className="text-[var(--text-muted)] mb-12 text-lg font-bold leading-relaxed uppercase tracking-tight opacity-80 border-l-2 border-red-500/20 pl-6 text-left mx-auto max-w-xs">
          {reason} <br />
          <span className="text-white">
            Active monitoring suspended. Restore neural signal link to continue.
          </span>
        </p>

        <div className="flex flex-col gap-6">
          <button
            className="btn-premium w-full flex items-center justify-center gap-4 py-6 group/btn relative overflow-hidden transition-all active:scale-95"
            onClick={() =>
              window.open(
                "mailto:sales@tripzy.travel?subject=Upgrade Request",
                "_blank",
              )
            }
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-500" />
            <Crown className="w-5 h-5 text-black relative z-10 animate-bounce" />
            <span className="font-black uppercase tracking-[0.3em] text-black relative z-10 text-base">
              Authorize_Full_Access
            </span>
          </button>

          <div className="flex items-center justify-center gap-4 opacity-40 hover:opacity-100 transition-opacity cursor-pointer group/support">
            <Mail size={14} className="text-[var(--gold-primary)]" />
            <span className="text-[10px] font-black text-white uppercase tracking-[0.4em] group-hover:text-[var(--gold-primary)] transition-colors">
              Contact_Intelligence_Support
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

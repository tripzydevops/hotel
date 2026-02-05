
import { Lock } from "lucide-react";

interface PaywallOverlayProps {
  reason?: string;
}

export function PaywallOverlay({ reason = "Your trial has ended." }: PaywallOverlayProps) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-500">
      <div className="glass-card max-w-md w-full p-8 text-center border border-white/10 shadow-2xl relative overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-[var(--soft-gold)]/20 blur-[50px] rounded-full -z-10" />
        
        <div className="mx-auto w-16 h-16 bg-[var(--soft-gold)]/10 rounded-full flex items-center justify-center mb-6 border border-[var(--soft-gold)]/20">
          <Lock className="w-8 h-8 text-[var(--soft-gold)]" />
        </div>
        
        <h2 className="text-2xl font-bold text-white mb-2">Access Locked</h2>
        <p className="text-[var(--text-muted)] mb-8">
          {reason} <br/>
          To continue monitoring rates, please upgrade your plan.
        </p>
        
        <div className="flex flex-col gap-3">
          <button 
            className="btn-gold w-full flex items-center justify-center gap-2 py-3"
            onClick={() => window.open('mailto:sales@tripzy.travel?subject=Upgrade Request', '_blank')}
          >
            Upgrade Now
          </button>
          <p className="text-xs text-[var(--text-muted)] mt-2">
            Contact support to restore access.
          </p>
        </div>
      </div>
    </div>
  );
}

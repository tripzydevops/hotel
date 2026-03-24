import React from "react";
import Link from "next/link";
import { ChevronLeft, HelpCircle } from "lucide-react";

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-[#050B18] text-white p-8">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-8">
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Grid</span>
        </Link>
        
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-blue-600/20 flex items-center justify-center text-blue-500">
            <HelpCircle className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-black">Help Center</h1>
            <p className="text-slate-400">Documentation and Support</p>
          </div>
        </div>
        
        <div className="grid gap-6">
          <div className="bg-white/5 border border-white/5 rounded-2xl p-8">
            <h2 className="text-xl font-bold mb-4">Quick Start Guide</h2>
            <p className="text-slate-400 leading-relaxed mb-4">
              Welcome to Hotel Plus Enterprise Core. This platform provides real-time market intelligence 
              and parity monitoring for your hotel property.
            </p>
            <ul className="space-y-3 text-slate-300">
              <li className="flex items-start gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0" />
                <span>Use the <strong>Market Price Search</strong> to see current rates vs competitors.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0" />
                <span>Check <strong>Market Analysis</strong> for sentiment and historical trends.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0" />
                <span>Configure <strong>Alerts</strong> to be notified of significant price drops.</span>
              </li>
            </ul>
          </div>
          
          <div className="bg-white/5 border border-white/5 rounded-2xl p-8">
            <h2 className="text-xl font-bold mb-4">Support</h2>
            <p className="text-slate-400">
              Need technical assistance? Contact our engineering team at support@tripzy.com 
              or reach out via the Administrator panel.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

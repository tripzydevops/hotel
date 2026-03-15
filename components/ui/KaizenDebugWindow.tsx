"use client";

import React, { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { X, Terminal, RefreshCcw, ShieldCheck, Database, Hotel } from 'lucide-react';

export const KaizenDebugWindow: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.shiftKey && e.key === 'K') {
                setIsOpen(!isOpen);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const data = await api.getKaizenLogs();
            setLogs(data.logs);
        } catch (error) {
            setLogs(["Error fetching logs: " + error]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchLogs();
            const interval = setInterval(fetchLogs, 5000);
            return () => clearInterval(interval);
        }
    }, [isOpen]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-y-0 right-0 w-[500px] z-[9999] bg-[#0a0a0c] border-l border-white/10 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/40 backdrop-blur-md">
                <div className="flex items-center gap-2">
                    <Terminal className="w-5 h-5 text-emerald-400" />
                    <span className="font-bold text-white tracking-tight">KAIZEN<span className="text-emerald-400">DEBUG</span></span>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={fetchLogs} 
                        className={`p-1.5 hover:bg-white/5 rounded-md transition-colors ${loading ? 'animate-spin' : ''}`}
                    >
                        <RefreshCcw className="w-4 h-4 text-white/60" />
                    </button>
                    <button 
                        onClick={() => setIsOpen(false)} 
                        className="p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded-md transition-all text-white/60"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Quick Stats Area */}
            <div className="p-4 grid grid-cols-2 gap-3 bg-white/5 border-b border-white/10">
                <div className="flex items-center gap-2 text-xs text-white/70">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <span>Admin Mode: <span className="text-emerald-400 font-mono">ACTIVE</span></span>
                </div>
                <div className="flex items-center gap-2 text-xs text-white/70">
                    <Hotel className="w-4 h-4 text-blue-400" />
                    <span>Target Set: <span className="text-blue-400 font-mono">YES</span></span>
                </div>
            </div>

            {/* Log Panel */}
            <div 
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 font-mono text-[11px] leading-relaxed scrollbar-thin scrollbar-thumb-white/10"
            >
                {logs.length === 0 ? (
                    <div className="text-white/30 italic text-center py-10">No logs captured yet...</div>
                ) : (
                    logs.map((log, i) => (
                        <div key={i} className={`mb-1 break-words ${
                            log.toLowerCase().includes('error') ? 'text-red-400 bg-red-400/5 px-1 py-0.5 rounded' : 
                            log.toLowerCase().includes('warn') ? 'text-amber-300' :
                            log.toLowerCase().includes('success') ? 'text-emerald-400' :
                            'text-white/80'
                        }`}>
                            <span className="opacity-30 mr-2">{i + 1}</span>
                            {log}
                        </div>
                    ))
                )}
            </div>

            <div className="p-3 bg-black/60 border-t border-white/10 text-[10px] text-white/40 flex justify-between items-center italic">
                <span>Polling Kaizen.log every 5s</span>
                <span>Press Shift + K to toggle</span>
            </div>
        </div>
    );
};

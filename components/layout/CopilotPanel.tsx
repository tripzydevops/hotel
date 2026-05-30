'use client';

import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  X,
  Send,
  Trash2,
  Bot,
  User,
  Wrench,
} from 'lucide-react';
import { api } from '@/lib/api';


// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ToolCall {
  name: string;
  label: string;
}

interface Message {
  id?: string;
  role: string;
  content: string;
  toolCalls?: ToolCall[];
  timestamp?: string;
}

export interface CopilotPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  messages: Message[];
  isLoading: boolean;
  onSendMessage: (msg: string) => void;
  onClear: () => void;
}

// ---------------------------------------------------------------------------
// Tool-call emoji map
// ---------------------------------------------------------------------------

const TOOL_EMOJI: Record<string, string> = {
  fetch_rate_history: '📊',
  check_parity:      '🔍',
  analyze_rates:     '📈',
  get_competitors:   '🏨',
  forecast:          '🔮',
  sentiment:         '💬',
  default:           '⚙️',
};

function toolEmoji(name: string): string {
  return TOOL_EMOJI[name] || TOOL_EMOJI.default;
}

// ---------------------------------------------------------------------------
// Link Parsing Helpers
// ---------------------------------------------------------------------------

async function handleApiLinkClick(e: React.MouseEvent<HTMLAnchorElement>, href: string) {
  if (href.startsWith('/api/') || href.includes('/api/reports/')) {
    e.preventDefault();
    try {
      const token = await api.getAccessToken();
      const url = new URL(href, window.location.origin);
      if (token) {
        url.searchParams.set('token', token);
      }
      window.open(url.toString(), '_blank');
    } catch (err) {
      console.error('Failed to resolve authenticated download link:', err);
      window.open(href, '_blank');
    }
  }
}

function parseRawLinks(text: string): React.ReactNode[] {
  const urlRegex = /(https?:\/\/[^\s)]+|\/api\/[^\s)]+)/g;
  const rawParts = text.split(urlRegex);
  
  return rawParts.map((part, index) => {
    if (urlRegex.test(part)) {
      return (
        <a
          key={`raw-${index}`}
          href={part}
          onClick={(e) => handleApiLinkClick(e, part)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--soft-gold)] hover:underline font-bold break-all transition-colors cursor-pointer"
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

function renderMessageContent(content: string): React.ReactNode {
  if (!content) return null;

  const mdLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  mdLinkRegex.lastIndex = 0;

  while ((match = mdLinkRegex.exec(content)) !== null) {
    const matchIndex = match.index;
    const textBefore = content.substring(lastIndex, matchIndex);
    
    if (textBefore) {
      parts.push(...parseRawLinks(textBefore));
    }

    const linkText = match[1];
    const linkUrl = match[2];
    
    parts.push(
      <a
        key={`md-${matchIndex}`}
        href={linkUrl}
        onClick={(e) => handleApiLinkClick(e, linkUrl)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[var(--soft-gold)] hover:underline font-bold transition-colors cursor-pointer"
      >
        {linkText}
      </a>
    );

    lastIndex = mdLinkRegex.lastIndex;
  }

  const remainingText = content.substring(lastIndex);
  if (remainingText) {
    parts.push(...parseRawLinks(remainingText));
  }

  return <>{parts}</>;
}

// ---------------------------------------------------------------------------
// Typing Indicator
// ---------------------------------------------------------------------------

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-3">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-2 h-2 rounded-full bg-[var(--soft-gold)]"
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            delay: i * 0.2,
            ease: 'easeInOut',
          }}
        />
      ))}
      <span className="ml-2 text-[11px] text-[var(--text-muted)] font-semibold tracking-wide">
        Thinking…
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Message Bubble
// ---------------------------------------------------------------------------

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}
    >
      <div className={`flex gap-2.5 max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Avatar */}
        <div
          className={`flex-shrink-0 w-7 h-7 rounded-xl flex items-center justify-center mt-1
            ${isUser
              ? 'bg-gradient-to-br from-[var(--soft-gold)] to-[var(--soft-gold-dim)] shadow-[0_2px_10px_var(--soft-gold-glow)]'
              : 'bg-[var(--glass-bg-accent)] border border-[var(--glass-border)]'
            }`}
        >
          {isUser ? (
            <User className="w-3.5 h-3.5 text-white" />
          ) : (
            <Bot className="w-3.5 h-3.5 text-[var(--soft-gold)]" />
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          {/* Tool-call badges (above assistant reply) */}
          {!isUser && message.toolCalls && message.toolCalls.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-1">
              {message.toolCalls.map((tc, idx) => (
                <motion.span
                  key={idx}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.08 }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wide uppercase
                    bg-[var(--soft-gold-glow)] text-[var(--soft-gold)] border border-[var(--soft-gold)]/20"
                >
                  <Wrench className="w-2.5 h-2.5" />
                  <span>{toolEmoji(tc.name)} {tc.label}</span>
                </motion.span>
              ))}
            </div>
          )}

          {/* Bubble */}
          <div
            className={`px-4 py-3 text-[13px] leading-relaxed whitespace-pre-wrap break-words
              ${isUser
                ? 'rounded-2xl rounded-tr-md bg-gradient-to-br from-[var(--soft-gold)]/20 to-[var(--soft-gold)]/10 border border-[var(--soft-gold)]/25 text-[var(--text-primary)]'
                : 'rounded-2xl rounded-tl-md bg-[var(--glass-bg-accent)] border border-[var(--glass-border)] text-[var(--text-primary)]'
              }`}
          >
            {renderMessageContent(message.content)}
          </div>

          {/* Timestamp */}
          {message.timestamp && (
            <span className={`text-[9px] text-[var(--text-muted)] font-medium ${isUser ? 'text-right' : 'text-left'}`}>
              {new Date(message.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// CopilotPanel
// ---------------------------------------------------------------------------

export default function CopilotPanel({
  isOpen,
  onToggle,
  messages,
  isLoading,
  onSendMessage,
  onClear,
}: CopilotPanelProps) {
  const [input, setInput] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    onSendMessage(trimmed);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <>
      {/* ===== Floating Action Button ===== */}
      <motion.button
        id="copilot-fab"
        onClick={onToggle}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-2xl flex items-center justify-center
          bg-gradient-to-br from-[var(--soft-gold)] to-[var(--soft-gold-dim)]
          shadow-[0_8px_32px_var(--soft-gold-glow)]
          hover:shadow-[0_12px_40px_var(--soft-gold-glow)]
          active:scale-95 transition-all duration-200 group"
        whileHover={{ scale: 1.08, rotate: 5 }}
        whileTap={{ scale: 0.92 }}
        aria-label="Toggle Revenue Copilot"
      >
        <Sparkles
          className="w-6 h-6 text-white drop-shadow-lg group-hover:animate-pulse"
        />

        {/* Pulsing ring */}
        <motion.span
          className="absolute inset-0 rounded-2xl border-2 border-[var(--soft-gold)]"
          animate={{ scale: [1, 1.25, 1], opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.button>

      {/* ===== Chat Panel ===== */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="copilot-panel"
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-24 right-6 z-50 w-[420px] flex flex-col
              glass-modal rounded-3xl border border-[var(--glass-border)]
              shadow-[0_32px_80px_-12px_rgba(0,0,0,0.6)]
              overflow-hidden"
            style={{ height: '600px', maxHeight: 'calc(100vh - 140px)' }}
          >
            {/* ---- Header ---- */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--glass-border)]
              bg-gradient-to-r from-[var(--soft-gold)]/10 to-transparent">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--soft-gold)] to-[var(--soft-gold-dim)]
                  flex items-center justify-center shadow-[0_4px_16px_var(--soft-gold-glow)]">
                  <Sparkles className="w-4.5 h-4.5 text-white" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-black text-[var(--text-primary)] tracking-tight">
                    Revenue Copilot
                  </span>
                  <span className="text-[10px] font-bold text-[var(--soft-gold)] uppercase tracking-[0.15em]">
                    AI Assistant
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <motion.button
                  onClick={onClear}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="w-8 h-8 rounded-xl flex items-center justify-center
                    text-[var(--text-muted)] hover:text-[var(--alert-red)] hover:bg-[var(--alert-red-soft)]
                    transition-all"
                  aria-label="Clear chat history"
                  title="Clear history"
                >
                  <Trash2 className="w-4 h-4" />
                </motion.button>
                <motion.button
                  onClick={onToggle}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="w-8 h-8 rounded-xl flex items-center justify-center
                    text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--glass-bg-accent)]
                    transition-all"
                  aria-label="Close Copilot"
                >
                  <X className="w-4 h-4" />
                </motion.button>
              </div>
            </div>

            {/* ---- Messages ---- */}
            <div className="flex-1 overflow-y-auto px-4 py-4 custom-scrollbar">
              {messages.length === 0 && !isLoading && (
                <div className="flex flex-col items-center justify-center h-full text-center px-6 gap-4">
                  <motion.div
                    className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--soft-gold)]/15 to-[var(--soft-gold)]/5
                      border border-[var(--soft-gold)]/20 flex items-center justify-center"
                    animate={{ rotate: [0, 5, -5, 0] }}
                    transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <Sparkles className="w-7 h-7 text-[var(--soft-gold)]" />
                  </motion.div>
                  <div>
                    <p className="text-sm font-bold text-[var(--text-primary)] mb-1">
                      Hi! I&apos;m your Revenue Copilot
                    </p>
                    <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                      Ask me about rates, parity issues, competitor analysis, or market trends.
                      I can see what page you&apos;re on and provide contextual insights.
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2 mt-2">
                    {[
                      'How are my rates vs competitors?',
                      'Any parity issues today?',
                      'Summarize market trends',
                    ].map((suggestion) => (
                      <motion.button
                        key={suggestion}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => onSendMessage(suggestion)}
                        className="px-3 py-1.5 rounded-xl text-[11px] font-semibold
                          bg-[var(--glass-bg-accent)] border border-[var(--glass-border)]
                          text-[var(--text-secondary)] hover:text-[var(--soft-gold)]
                          hover:border-[var(--soft-gold)]/30 transition-all"
                      >
                        {suggestion}
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg) => (
                <MessageBubble key={msg.id || msg.timestamp} message={msg} />
              ))}

              {isLoading && <TypingIndicator />}

              <div ref={messagesEndRef} />
            </div>

            {/* ---- Input ---- */}
            <form
              onSubmit={handleSubmit}
              className="px-4 pb-4 pt-2"
            >
              <div
                className={`flex items-center gap-2 rounded-2xl px-4 py-2.5
                  bg-[var(--glass-bg-accent)] border transition-all duration-300
                  ${isFocused
                    ? 'border-[var(--soft-gold)]/60 shadow-[0_0_20px_var(--soft-gold-glow)]'
                    : 'border-[var(--glass-border)]'
                  }`}
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about rates, parity, trends…"
                  disabled={isLoading}
                  className="flex-1 bg-transparent text-sm text-[var(--text-primary)]
                    placeholder:text-[var(--text-muted)] outline-none disabled:opacity-50"
                  id="copilot-input"
                  autoComplete="off"
                />
                <motion.button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="w-8 h-8 rounded-xl flex items-center justify-center
                    bg-gradient-to-br from-[var(--soft-gold)] to-[var(--soft-gold-dim)]
                    text-white shadow-[0_2px_10px_var(--soft-gold-glow)]
                    disabled:opacity-30 disabled:cursor-not-allowed
                    transition-all duration-200"
                  aria-label="Send message"
                >
                  <Send className="w-3.5 h-3.5" />
                </motion.button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';
import { api } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: CopilotToolCall[];
  timestamp: string;
}

export interface CopilotToolCall {
  name: string;
  label: string;
}

export interface CopilotScreenContext {
  page: string;
  active_hotel_id?: string | null;
  active_hotel_name?: string | null;
  active_competitors?: string[];
  active_city?: string | null;
  currency?: string | null;
  user_profile?: {
    display_name?: string;
    email?: string;
    role?: string;
    plan_type?: string;
  };
  user_settings?: {
    threshold_percent?: number;
    check_frequency_minutes?: number;
    notifications_enabled?: boolean;
  };
  filters?: Record<string, any>;
}

interface CopilotChatResponse {
  reply: string;
  tool_calls?: Array<{ name: string; label?: string }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Maps a Next.js pathname to a human-readable page label. */
function pageLabel(pathname: string): string {
  const map: Record<string, string> = {
    '/':               'Dashboard',
    '/dashboard':      'Dashboard',
    '/parity-monitor': 'Parity Monitor',
    '/analysis':       'Market Analysis',
    '/reports':        'Reports',
    '/admin':          'Admin Panel',
  };
  return map[pathname] || pathname;
}

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// useCopilot
// ---------------------------------------------------------------------------
// Manages all state for the AI Copilot chat panel: messages, open/close
// visibility, loading state, and auto-captured screen context.
//
// Uses @tanstack/react-query useMutation for the API call so error/retry
// semantics align with the rest of the codebase (see useDashboard.ts).
// ---------------------------------------------------------------------------

interface DashboardContextData {
  target_hotel?: {
    id?: string;
    name?: string;
    location?: string;
    price_info?: {
      check_in?: string;
      check_out?: string;
      adults?: number;
      currency?: string;
    };
  } | null;
  competitors?: Array<{ id?: string; name?: string }>;
  profile?: {
    display_name?: string;
    email?: string;
    role?: string;
    plan_type?: string;
  } | null;
  user_settings?: {
    threshold_percent?: number;
    check_frequency_minutes?: number;
    notifications_enabled?: boolean;
    currency?: string;
  } | null;
}

export function useCopilot(dashboardData?: DashboardContextData | null) {
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Ref to always have the latest messages in mutation callbacks without stale closures
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // ---- Screen Context (auto-captured) ----
  const screenContext: CopilotScreenContext = useMemo(() => {
    const loc = dashboardData?.target_hotel?.location;
    const activeCity = loc ? loc.split(',')[0].trim() : null;
    const displayCurrency = dashboardData?.user_settings?.currency || dashboardData?.target_hotel?.price_info?.currency || null;

    const filters: Record<string, any> = {};
    if (dashboardData?.target_hotel?.price_info?.check_in) {
      filters.check_in = dashboardData.target_hotel.price_info.check_in;
    }
    if (dashboardData?.target_hotel?.price_info?.check_out) {
      filters.check_out = dashboardData.target_hotel.price_info.check_out;
    }
    if (dashboardData?.target_hotel?.price_info?.adults) {
      filters.adults = dashboardData.target_hotel.price_info.adults;
    }

    return {
      page: pageLabel(pathname),
      active_hotel_id: dashboardData?.target_hotel?.id ?? null,
      active_hotel_name: dashboardData?.target_hotel?.name ?? null,
      active_competitors: (dashboardData?.competitors ?? [])
        .map((c) => c.name)
        .filter(Boolean) as string[],
      active_city: activeCity,
      currency: displayCurrency,
      user_profile: dashboardData?.profile ? {
        display_name: dashboardData.profile.display_name,
        email: dashboardData.profile.email,
        role: dashboardData.profile.role,
        plan_type: dashboardData.profile.plan_type,
      } : undefined,
      user_settings: dashboardData?.user_settings ? {
        threshold_percent: dashboardData.user_settings.threshold_percent,
        check_frequency_minutes: dashboardData.user_settings.check_frequency_minutes,
        notifications_enabled: dashboardData.user_settings.notifications_enabled,
      } : undefined,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
    };
  }, [pathname, dashboardData]);

  // ---- API Mutation ----
  const chatMutation = useMutation<CopilotChatResponse, Error, string>({
    mutationFn: (userMessage: string) => {
      // Build the history payload from current messages (excluding the one
      // we're about to add — it's included as `message`).
      const history = messagesRef.current.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      return api.copilotChat(userMessage, history, { ...screenContext });
    },
    onSuccess: (data) => {
      const assistantMsg: CopilotMessage = {
        id: generateId(),
        role: 'assistant',
        content: data.reply,
        toolCalls: data.tool_calls?.map((tc) => ({
          name: tc.name,
          label: tc.label || tc.name,
        })),
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    },
    onError: (error) => {
      const errorMsg: CopilotMessage = {
        id: generateId(),
        role: 'assistant',
        content: `Sorry, something went wrong. Please try again.\n\n_${error.message}_`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    },
  });

  // ---- Actions ----

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const userMsg: CopilotMessage = {
        id: generateId(),
        role: 'user',
        content: trimmed,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      chatMutation.mutate(trimmed);
    },
    [chatMutation],
  );

  const togglePanel = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const clearHistory = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    isOpen,
    isLoading: chatMutation.isPending,
    screenContext,
    sendMessage,
    togglePanel,
    clearHistory,
  };
}

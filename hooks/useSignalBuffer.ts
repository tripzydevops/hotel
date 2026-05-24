'use client';

import { useCallback, useRef } from 'react';

// ---------------------------------------------------------------------------
// B2B Signal Types
// These mirror the signal_type values expected by the backend
// (backend/api/models.py SignalPayload) and processed by
// backend/agents/signal_processor.py + persona_agent.py.
// ---------------------------------------------------------------------------

export type B2BSignalType =
  // Competitor interaction signals — highest value for compset profile inference
  | 'competitor_click'          // User clicked on a competitor hotel card
  | 'competitor_expand'         // User expanded the competitor detail panel
  | 'competitor_tab_selected'   // User navigated to a specific competitor's tab
  // Alert interaction signals — used for smart alert calibration
  | 'alert_investigated'        // User clicked an alert to investigate it
  | 'alert_dismissed'           // User dismissed an alert without investigating
  // General navigation signals — lower weight for attention profiling
  | 'dwell_time'                // Time spent on a page/component (payload: { target, duration_seconds })
  | 'view'                      // Page view (payload: { page })
  | 'click';                    // Generic click (payload: { target })

export interface SignalPayload {
  signal_type: B2BSignalType;
  payload: Record<string, unknown>;
  timestamp?: string;
}

interface BatchSignalRequest {
  session_id: string;
  signals: SignalPayload[];
}

// ---------------------------------------------------------------------------
// Session ID — stable per browser tab, regenerated on hard refresh
// ---------------------------------------------------------------------------
const SESSION_ID =
  typeof crypto !== 'undefined'
    ? crypto.randomUUID()
    : `session_${Date.now()}`;

// ---------------------------------------------------------------------------
// useSignalBuffer
// ---------------------------------------------------------------------------
// Buffers B2B interaction signals in memory and flushes them to the backend
// in batches.  Designed to be called from competitor tile components, alert
// cards, and any dashboard element whose interaction pattern reveals which
// competitors a revenue manager focuses on.
//
// Usage:
//   const { track } = useSignalBuffer();
//   track('competitor_click', { hotel_id: competitor.id, hotel_name: competitor.name });
// ---------------------------------------------------------------------------

export function useSignalBuffer(flushThreshold = 10) {
  const buffer = useRef<SignalPayload[]>([]);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async (signals: SignalPayload[]) => {
    if (signals.length === 0) return;

    const body: BatchSignalRequest = {
      session_id: SESSION_ID,
      signals,
    };

    try {
      // Dynamically import api client to avoid circular dep at module load time
      const { api } = await import('@/lib/api');
      await api.batchSignals(body);
    } catch (err) {
      // Non-fatal: signals are best-effort telemetry, never block the UI
      if (process.env.NODE_ENV === 'development') {
        console.warn('[useSignalBuffer] flush failed (non-fatal):', err);
      }
    }
  }, []);

  const scheduleFlush = useCallback(() => {
    if (flushTimer.current) clearTimeout(flushTimer.current);
    // Auto-flush after 5 seconds of inactivity
    flushTimer.current = setTimeout(() => {
      const pending = buffer.current.splice(0);
      if (pending.length > 0) flush(pending);
    }, 5000);
  }, [flush]);

  const track = useCallback(
    (signalType: B2BSignalType, payload: Record<string, unknown> = {}) => {
      buffer.current.push({
        signal_type: signalType,
        payload,
        timestamp: new Date().toISOString(),
      });

      // Flush immediately if buffer hits threshold
      if (buffer.current.length >= flushThreshold) {
        if (flushTimer.current) clearTimeout(flushTimer.current);
        const pending = buffer.current.splice(0);
        flush(pending);
      } else {
        scheduleFlush();
      }
    },
    [flush, scheduleFlush, flushThreshold],
  );

  return { track };
}

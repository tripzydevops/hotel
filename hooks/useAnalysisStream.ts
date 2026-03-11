import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

interface AnalysisData {
  hotel_name: string;
  ari: number;
  sent_index: number;
  quadrant_label: string;
  advisory_msg: string;
  daily_prices: any[];
  [key: string]: any;
}

export function useAnalysisStream(userId: string | undefined, roomType: string = 'Standard') {
  const [data, setData] = useState<AnalysisData | null>(null);
  const [narrative, setNarrative] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startStream = useCallback(() => {
    if (!userId) return;

    let eventSource: EventSource | null = null;
    let isMounted = true;

    const setup = async () => {
      try {
        setIsStreaming(true);
        setError(null);
        setNarrative('');

        const { createClient } = await import('@/utils/supabase/client');
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        if (!isMounted) return;

        const tokenParam = token ? `&token=${encodeURIComponent(token)}` : '';
        const url = `${api.baseURL}/api/v2/analysis/stream?room_type=${roomType}${tokenParam}`;
        
        eventSource = new EventSource(url);

        eventSource.addEventListener('data_init', (event) => {
          try {
            const payload = JSON.parse(event.data);
            setData(payload);
          } catch (err) {
            console.error('Failed to parse data_init:', err);
          }
        });

        eventSource.addEventListener('narrative_chunk', (event) => {
          try {
            const payload = JSON.parse(event.data);
            setNarrative((prev) => prev + payload.chunk);
          } catch (err) {
            console.error('Failed to parse narrative_chunk:', err);
          }
        });

        eventSource.addEventListener('complete', () => {
          setIsStreaming(false);
          eventSource?.close();
        });

        eventSource.addEventListener('error', (event) => {
          console.error('SSE Error:', event);
          if (isMounted) {
            setError('Stream connection failed');
            setIsStreaming(false);
          }
          eventSource?.close();
        });
      } catch (err: any) {
        console.error('SSE Setup Error:', err);
        if (isMounted) {
          setError(err.message || 'Failed to initialize stream');
          setIsStreaming(false);
        }
      }
    };

    setup();

    return () => {
      isMounted = false;
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [userId, roomType]);

  useEffect(() => {
    const cleanup = startStream();
    return () => {
      if (cleanup) cleanup();
    };
  }, [startStream]);

  return { data, narrative, isStreaming, error, refetch: startStream };
}

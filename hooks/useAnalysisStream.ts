import { useState, useEffect, useCallback } from 'react';

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

    setIsStreaming(true);
    setError(null);
    setNarrative('');

    const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v2/analysis/stream/${userId}?room_type=${roomType}`;
    const eventSource = new EventSource(url);

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
      eventSource.close();
    });

    eventSource.addEventListener('error', (event) => {
      console.error('SSE Error:', event);
      setError('Stream connection failed');
      setIsStreaming(false);
      eventSource.close();
    });

    return () => {
      eventSource.close();
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

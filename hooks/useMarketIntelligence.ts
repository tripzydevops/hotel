import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useDashboard } from "./useDashboard";

export function useMarketIntelligence(city: string, days: number = 30) {
    const { data: dashboardData } = useDashboard();
    const [marketData, setMarketData] = useState<any>(null);
    const [sentimentData, setSentimentData] = useState<any>(null);
    const [analysisData, setAnalysisData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const targetHotel = dashboardData?.hotels?.find(h => h.is_target_hotel);
    const hotelId = targetHotel?.id;

    useEffect(() => {
        let isMounted = true;

        async function fetchAll() {
            setLoading(true);
            setError(null);
            try {
                const [mForecast, mAnalysis] = await Promise.all([
                    api.getMarketForecast(city, days),
                    api.getAnalysis()
                ]);

                let sHistory = null;
                if (hotelId) {
                    sHistory = await api.getSentimentHistory(hotelId, days);
                }

                if (isMounted) {
                    setMarketData(mForecast);
                    setAnalysisData(mAnalysis);
                    setSentimentData(sHistory);
                }
            } catch (err: any) {
                if (isMounted) {
                    setError(err.message || "Failed to fetch market intelligence");
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        }

        fetchAll();

        return () => {
            isMounted = false;
        };
    }, [city, days, hotelId]);

    return {
        market: marketData?.data || [],
        metadata: marketData?.metadata || null,
        analysis: analysisData || null,
        sentiment: sentimentData || null,
        hotel: targetHotel,
        loading,
        error
    };
}

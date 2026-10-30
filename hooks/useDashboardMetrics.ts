import { useMemo } from "react";
import { DashboardData, UserProfile, UserSettings } from "@/types";
import { parsePrice } from "@/lib/utils";
import {
  calculateEffectiveTargetPrice,
  calculateIsLocked,
  calculateIsEnterprise,
  calculateMarketPulseAvg,
  calculateAvgCompetitorPrice,
  calculateUndercuttingCount,
  calculatePricesDroppedCount,
  resolveActiveCurrency,
} from "@/utils/dashboardCalculations";

export interface DashboardMetrics {
  effectiveTargetPrice: number;
  isLocked: boolean;
  currentHotelCount: number;
  isEnterprise: boolean;
  marketPulseAvg: number;
  avgCompetitorPrice: number;
  undercuttingCount: number;
  pricesDroppedCount: number;
  activeCurrency: string;
  sortedCompetitors: DashboardData["competitors"];
}

export function useDashboardMetrics(
  data: DashboardData | null,
  profile: UserProfile | null,
  userSettings: UserSettings | null
): DashboardMetrics {
  const effectiveTargetPrice = useMemo(
    () => calculateEffectiveTargetPrice(data?.target_hotel?.price_info?.current_price),
    [data?.target_hotel?.price_info?.current_price]
  );

  const isLocked = useMemo(
    () => calculateIsLocked(profile?.subscription_status),
    [profile?.subscription_status]
  );

  const currentHotelCount = useMemo(
    () => (data?.competitors?.length || 0) + (data?.target_hotel ? 1 : 0),
    [data?.competitors?.length, data?.target_hotel]
  );

  const isEnterprise = useMemo(
    () => calculateIsEnterprise(profile?.role, profile?.plan_type),
    [profile?.plan_type, profile?.role]
  );

  const marketPulseAvg = useMemo(() => {
    if (!data?.competitors?.length) return 0;
    return calculateMarketPulseAvg(
      data.competitors.map((c) => c.price_info?.change_percent)
    );
  }, [data?.competitors]);

  const avgCompetitorPrice = useMemo(() => {
    if (!data?.competitors?.length) return 0;
    return calculateAvgCompetitorPrice(
      data.competitors.map((c) => c.price_info?.current_price)
    );
  }, [data?.competitors]);

  const undercuttingCount = useMemo(
    () =>
      calculateUndercuttingCount(
        (data?.competitors || []).map((c) => c.price_info?.current_price),
        effectiveTargetPrice
      ),
    [data?.competitors, effectiveTargetPrice]
  );

  const pricesDroppedCount = useMemo(
    () =>
      calculatePricesDroppedCount(
        (data?.competitors || []).map((c) => c.price_info?.trend)
      ),
    [data?.competitors]
  );

  const activeCurrency = useMemo(
    () =>
      resolveActiveCurrency(
        userSettings?.currency,
        data?.target_hotel?.price_info?.currency,
        data?.competitors?.find((c) => c.price_info?.currency)?.price_info?.currency
      ),
    [
      data?.target_hotel?.price_info?.currency,
      data?.competitors,
      userSettings?.currency,
    ]
  );

  const sortedCompetitors = useMemo(() => {
    if (!data?.competitors) return [];
    return [...data.competitors].sort(
      (a, b) =>
        parsePrice(a.price_info?.current_price || 0) -
        parsePrice(b.price_info?.current_price || 0)
    );
  }, [data?.competitors]);

  return {
    effectiveTargetPrice,
    isLocked,
    currentHotelCount,
    isEnterprise,
    marketPulseAvg,
    avgCompetitorPrice,
    undercuttingCount,
    pricesDroppedCount,
    activeCurrency,
    sortedCompetitors,
  };
}

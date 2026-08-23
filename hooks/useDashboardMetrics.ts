import { useMemo } from "react";
import { DashboardData, UserProfile, UserSettings } from "@/types";
import { parsePrice } from "@/lib/utils";

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
    () => parsePrice(data?.target_hotel?.price_info?.current_price || 0),
    [data?.target_hotel?.price_info?.current_price]
  );

  const isLocked = useMemo(
    () =>
      profile?.subscription_status === "past_due" ||
      profile?.subscription_status === "canceled" ||
      profile?.subscription_status === "unpaid",
    [profile?.subscription_status]
  );

  const currentHotelCount = useMemo(
    () => (data?.competitors?.length || 0) + (data?.target_hotel ? 1 : 0),
    [data?.competitors?.length, data?.target_hotel]
  );

  const isEnterprise = useMemo(
    () =>
      profile?.role === "admin" ||
      profile?.plan_type?.toLowerCase() === "enterprise" ||
      profile?.plan_type?.toLowerCase() === "pro" ||
      profile?.plan_type?.toLowerCase() === "trial",
    [profile?.plan_type, profile?.role]
  );

  const marketPulseAvg = useMemo(() => {
    if (!data?.competitors?.length) return 0;
    return (
      data.competitors.reduce(
        (acc, c) => acc + (c.price_info?.change_percent || 0),
        0
      ) / data.competitors.length
    );
  }, [data?.competitors]);

  const avgCompetitorPrice = useMemo(() => {
    const validCompetitors = (data?.competitors || []).filter(
      (c) => parsePrice(c.price_info?.current_price || 0) > 0
    );
    if (!validCompetitors.length) return 0;

    return Math.round(
      validCompetitors.reduce(
        (sum, c) => sum + parsePrice(c.price_info?.current_price || 0),
        0
      ) / validCompetitors.length
    );
  }, [data?.competitors]);

  const undercuttingCount = useMemo(
    () =>
      (data?.competitors || []).filter((c) => {
        const price = parsePrice(c.price_info?.current_price || 0);
        return price > 0 && price < effectiveTargetPrice;
      }).length,
    [data?.competitors, effectiveTargetPrice]
  );

  const pricesDroppedCount = useMemo(
    () =>
      (data?.competitors || []).filter((c) => c.price_info?.trend === "down")
        .length,
    [data?.competitors]
  );

  const activeCurrency = useMemo(
    () =>
      userSettings?.currency ||
      data?.target_hotel?.price_info?.currency ||
      data?.competitors?.find((c) => c.price_info?.currency)?.price_info
        ?.currency ||
      "TRY",
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

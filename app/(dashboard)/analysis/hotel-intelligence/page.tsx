"use client";

import React from "react";
import dynamic from "next/dynamic";
import { 
  Star, 
  MapPin, 
  BarChart3, 
  AlertCircle, 
  Bed, 
  Users, 
  MessageSquare,
  ShieldCheck,
  ChevronRight,
  TrendingDown,
  Info
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/useAuth";
import { useDashboard } from "@/hooks/useDashboard";

const WhatIfPanel = dynamic(() => import("@/components/features/analysis/WhatIfPanel"), { ssr: false });
const AnnotationsPanel = dynamic(() => import("@/components/features/analysis/AnnotationsPanel"), { ssr: false });


// Mock data extracted from output.txt
const HOTEL_DATA = {
  name: "Hilton Garden Inn Balikesir",
  stars: 4,
  address: "Hilton Garden Inn, Hacı İlbey, Anafartalar Cd. 48/1, 10010 Altıeylül/Balıkesir",
  overallRating: 4.6,
  votesCount: 485,
  lowestPrice: 4118,
  currency: "TRY",
  otaOffers: [
    { title: "Hotel Booking Zone", price: 4118, domain: "hotelbookingzone.com", parity: "Optimal" },
    { title: "Skyscanner", price: 4119, domain: "skyscanner.net", parity: "Optimal" },
    { title: "Hotels.com", price: 4119, domain: "tr.hotels.com", parity: "Optimal" },
    { title: "Agoda", price: 4119, domain: "www.agoda.com", parity: "Optimal" },
    { title: "etstur.com", price: 4168, domain: "www.etstur.com", parity: "Drift" },
    { title: "Vio.com", price: 4339, domain: "vio.com", parity: "Drift" },
    { title: "TUI.com", price: 5119, domain: "www.tui.com", parity: "Deviation" },
    { title: "Jolly Tur", price: 6250, domain: "www.jollytur.com", parity: "Deviation" },
  ],
  roomTypes: [
    { name: "KING ACCESSIBLE ROOM", price: 4119 },
    { name: "Twin Room, 2 Twin Beds", price: 4119 },
    { name: "Deluxe Room, 1 King Bed", price: 5760 },
    { name: "Suite, 1 Bedroom", price: 9330 },
  ],
  sentiment: [
    { category: "Service", positive: 80, score: 4.02 },
    { category: "Property", positive: 70, score: 5.04 },
    { category: "Location", positive: 100, score: 5.0 },
    { category: "Breakfast", positive: 80, score: 5.0 },
    { category: "Cleanliness", positive: 80, score: 5.0 },
  ],
  reviewSources: [
    { name: "Trip.com", rating: 4.5, count: 82 },
    { name: "Tripadvisor", rating: 4.7, count: 18 },
    { name: "Google", rating: 4.6, count: 485 },
  ],
  images: [
    "https://lh3.googleusercontent.com/gps-cs-s/APNQkAG-yWbk9g5UnkQPf4Ipsv7rqTjLB2oM-1n0d9xn31uKAFjlEqBN4s8j4UhlmwT_UeEEZngZ1j49_M-p2_ICyUGbWyidhJ27flCSU0oqgdus5NdGjhaQ_Lk6N90VM8tpbM0NKNN2=s287-w287-h192-n-k-no-v1"
  ]
};

export default function HotelIntelligencePage() {
  const { dict } = useI18n();
  const d = dict.hotelIntelligence;
  const { userId } = useAuth();
  const { data: dashboardData, loading: dashboardLoading } = useDashboard(userId, (key) => key);
  const targetHotelId = dashboardData?.target_hotel?.id ?? null;

  return (
    <div className="flex-1 space-y-8 p-8 pt-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">
              {HOTEL_DATA.name}
            </h2>
            <div className="flex text-[var(--soft-gold)]">
              {[...Array(HOTEL_DATA.stars)].map((_, i) => (
                <Star key={i} size={16} fill="currentColor" />
              ))}
            </div>
          </div>
          <p className="text-[var(--text-secondary)] flex items-center gap-1">
            <MapPin size={14} /> {HOTEL_DATA.address}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="bg-[var(--optimal-green-soft)] text-[var(--optimal-green)] border-[var(--optimal-green)] px-3 py-1">
            <ShieldCheck size={14} className="mr-1" /> {d.marketLeader}
          </Badge>
          <button className="btn-premium">{d.exportIntelligence}</button>
        </div>
      </div>

      {/* High-Level Intelligence HUD */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium tactical-label">{d.bestMarketPrice}</CardTitle>
            <TrendingDown className="h-4 w-4 text-[var(--optimal-green)]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[var(--text-primary)]">
              {HOTEL_DATA.lowestPrice.toLocaleString()} {HOTEL_DATA.currency}
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Found on <span className="text-[var(--soft-gold)]">Hotel Booking Zone</span>
            </p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium tactical-label">{d.globalSentiment}</CardTitle>
            <MessageSquare className="h-4 w-4 text-[var(--soft-gold)]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[var(--text-primary)]">{HOTEL_DATA.overallRating} / 5</div>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Based on {HOTEL_DATA.votesCount} verified reviews
            </p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium tactical-label">{d.parityScore}</CardTitle>
            <BarChart3 className="h-4 w-4 text-[var(--optimal-green)]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[var(--text-primary)]">94%</div>
            <div className="mt-2 h-1 w-full bg-[var(--deep-ocean-lighter)] rounded-full">
              <div className="h-full bg-[var(--optimal-green)] rounded-full" style={{ width: '94%' }}></div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium tactical-label">{d.activeOTAs}</CardTitle>
            <Users className="h-4 w-4 text-[var(--text-secondary)]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[var(--text-primary)]">15+</div>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              {d.monitoringGlobal}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-7">
        {/* OTA Comparison */}
        <Card className="col-span-4 glass-card">
          <CardHeader>
            <CardTitle className="text-xl">{d.otaComparison}</CardTitle>
            <CardDescription className="text-[var(--text-secondary)]">
              {d.otaComparisonDesc}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {HOTEL_DATA.otaOffers.map((offer, index) => (
                <div key={index} className="flex items-center justify-between p-3 tinted-frame hover:border-[var(--soft-gold)] transition-all">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded bg-[var(--deep-ocean)] flex items-center justify-center text-[var(--soft-gold)] font-bold text-xs border border-[var(--glass-border)]">
                      {offer.title.substring(0, 1)}
                    </div>
                    <div>
                      <div className="font-semibold text-sm">{offer.title}</div>
                      <div className="text-xs text-[var(--text-secondary)]">{offer.domain}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="font-bold text-[var(--text-primary)]">
                        {offer.price.toLocaleString()} {HOTEL_DATA.currency}
                      </div>
                      <Badge variant="outline" className={`text-[10px] uppercase h-5 ${
                        offer.parity === 'Optimal' ? 'text-[var(--optimal-green)] border-[var(--optimal-green)]' :
                        offer.parity === 'Drift' ? 'text-yellow-500 border-yellow-500' : 'text-[var(--alert-red)] border-[var(--alert-red)]'
                      }`}>
                        {offer.parity}
                      </Badge>
                    </div>
                    <ChevronRight size={16} className="text-[var(--text-muted)]" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Sentiment & Categories */}
        <Card className="col-span-3 glass-card">
          <CardHeader>
            <CardTitle className="text-xl">{d.intelligenceBreakdown}</CardTitle>
            <CardDescription className="text-[var(--text-secondary)]">
              {d.intelligenceBreakdownDesc}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <h4 className="tactical-label">{d.sentimentByCategory}</h4>
              {HOTEL_DATA.sentiment.map((item, index) => (
                <div key={index} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-[var(--text-primary)]">{item.category}</span>
                    <span className="text-[var(--soft-gold)]">{item.score} / 5.0</span>
                  </div>
                  <Progress value={item.positive} className="h-1.5 bg-[var(--deep-ocean-lighter)]" />
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-[var(--glass-border)]">
              <h4 className="tactical-label mb-3">{d.roomTypeDiscovery}</h4>
              <div className="grid gap-2">
                {HOTEL_DATA.roomTypes.map((room, index) => (
                  <div key={index} className="flex justify-between items-center text-sm p-2 bg-[var(--bg-subtle)] rounded-lg">
                    <div className="flex items-center gap-2">
                      <Bed size={14} className="text-[var(--text-secondary)]" />
                      <span className="truncate max-w-[150px]">{room.name}</span>
                    </div>
                    <span className="font-mono text-[var(--soft-gold)]">
                      {room.price.toLocaleString()} {HOTEL_DATA.currency}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-[var(--glass-border)]">
              <h4 className="tactical-label mb-3">{d.verifiedSources}</h4>
              <div className="flex flex-wrap gap-2">
                {HOTEL_DATA.reviewSources.map((source, index) => (
                  <div key={index} className="px-3 py-1 rounded-full bg-[var(--deep-ocean)] border border-[var(--glass-border)] text-xs flex items-center gap-2">
                    <span className="font-semibold">{source.name}</span>
                    <span className="text-[var(--soft-gold)]">{source.rating}</span>
                    <span className="text-[var(--text-muted)] text-[10px]">({source.count})</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Intelligence Feed Placeholder */}
      <div className="grid gap-6 md:grid-cols-3">
         <Card className="glass-card flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-[var(--deep-ocean-card)] to-[var(--bg-accent)] border-[var(--soft-gold-glow)]">
            <AlertCircle size={32} className="text-[var(--soft-gold)] mb-4 animate-pulse-subtle" />
            <h3 className="text-lg font-bold">{d.newParityOpportunity}</h3>
            <p className="text-sm text-[var(--text-secondary)] mt-2">
              {d.opportunityDesc}
            </p>
            <button className="mt-4 text-xs font-bold uppercase tracking-widest text-[var(--soft-gold)] hover:underline">
              {d.analyzeOpportunity}
            </button>
         </Card>
         
         <div className="col-span-2 relative rounded-2xl overflow-hidden group border border-[var(--glass-border)]">
            <img 
              src={HOTEL_DATA.images[0]} 
              alt="Hotel Interior" 
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-6">
               <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-[var(--soft-gold)] text-white border-none">{d.liveView}</Badge>
                  <span className="text-white/80 text-sm flex items-center gap-1">
                    <Info size={14} /> {d.scanComplete}
                  </span>
               </div>
               <h3 className="text-xl font-bold text-white">
                 {d.interiorOverview.replace("{hotel}", HOTEL_DATA.name)}
               </h3>
               <p className="text-white/60 text-sm mt-1">{d.discoveredVia}</p>
            </div>
         </div>
      </div>

      {/* Section 7 Innovation Features */}
      <div className="grid gap-6 lg:grid-cols-2">
        {dashboardLoading ? (
          // Loading skeleton while hotel ID resolves
          <>
            <div className="h-64 rounded-2xl bg-white/[0.03] border border-[var(--glass-border)] animate-pulse" />
            <div className="h-64 rounded-2xl bg-white/[0.03] border border-[var(--glass-border)] animate-pulse" />
          </>
        ) : targetHotelId ? (
          <>
            <WhatIfPanel hotelId={targetHotelId} />
            <AnnotationsPanel hotelId={targetHotelId} />
          </>
        ) : (
          <div className="col-span-2 flex flex-col items-center justify-center py-12 text-center rounded-2xl border border-dashed border-[var(--glass-border)]">
            <AlertCircle className="w-8 h-8 text-[var(--text-muted)] mb-3" />
            <p className="text-sm font-bold text-[var(--text-secondary)]">No target hotel configured</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">Set a target hotel in your dashboard to use What-If modeling and team annotations.</p>
          </div>
        )}
      </div>
    </div>
  );
}

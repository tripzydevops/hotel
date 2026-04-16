import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Target, TrendingUp, Sparkles, Activity, Shield, PieChart as PieIcon, BarChart3, Swords } from 'lucide-react';
import { Hotel, Competitor, Analysis, MarketIntelligence } from '@/types';

interface MarketAnalysisProps {
  targetHotel: Hotel | null;
  competitors: Competitor[];
  analysis: Analysis | null;
}

const CATEGORY_ALIASES: Record<string, string[]> = {
  cleanliness: ['clean', 'room', 'tidy', 'spotless'],
  service: ['staff', 'reception', 'help', 'friendly', 'service'],
  location: ['near', 'close', 'city', 'center', 'position'],
  value: ['price', 'worth', 'cost', 'money', 'value']
};

function getCategoryScore(hotel: any, category: string): number {
  if (!hotel?.sentiment_breakdown) return 0;
  const target = category.toLowerCase();
  const aliases = CATEGORY_ALIASES[target] || [];

  const item = hotel.sentiment_breakdown.find((s: any) => {
    const name = (s.name || s.category || "").toLowerCase().trim();
    if (name === target) return true;
    return aliases.some((alias) => name.includes(alias));
  });

  if (item) return Number(item.score || item.value || 0);

  if (hotel.guest_mentions?.length > 0) {
    const relevant = hotel.guest_mentions.filter((m: any) => {
      const text = (m.keyword || m.text || "").toLowerCase();
      return aliases.some((alias) => text.includes(alias));
    });
    if (relevant.length > 0) {
      let weightedSum = 0;
      let totalCount = 0;
      relevant.forEach((m: any) => {
        const count = Number(m.count) || 1;
        totalCount += count;
        const score = m.sentiment === "positive" ? 5 : m.sentiment === "negative" ? 1 : 3;
        weightedSum += score * count;
      });
      if (totalCount > 0) return weightedSum / totalCount;
    }
  }
  return 3.0; // Market neutral default
}

const MarketAnalysis: React.FC<MarketAnalysisProps> = ({ targetHotel, competitors, analysis }) => {
  const [activeTab, setActiveTab] = useState<'share' | 'yield' | 'sentiment'>('share');

  // 1. Data Prep: Voice Share (Review Volume Proxy)
  const totalReviews = (targetHotel?.review_count || 0) + competitors.reduce((acc, c) => acc + (c.review_count || 0), 0);
  const voiceShareData = [
    { name: targetHotel?.name || 'You', value: targetHotel?.review_count || 0 },
    ...competitors.map(c => ({ name: c.name, value: c.review_count || 0 }))
  ].map(item => ({ ...item, percentage: totalReviews > 0 ? (item.value / totalReviews) * 100 : 0 }));

  // 2. Data Prep: Yield Dynamics (Price vs Market Avg)
  const yieldData = analysis?.price_history || [];

  // 3. Data Prep: Sentiment Benchmark (Radar)
  const pillars = ['Cleanliness', 'Service', 'Location', 'Value'];
  const sentimentData = pillars.map(p => {
    const hotelScore = getCategoryScore(targetHotel, p);
    const compAvg = competitors.length > 0
      ? competitors.reduce((acc, c) => acc + getCategoryScore(c, p), 0) / competitors.length
      : 3.0;
    return {
      pillar: p,
      hotel_score: Number(hotelScore.toFixed(1)),
      comp_avg: Number(compAvg.toFixed(1))
    };
  });

  const COLORS = ['#D4AF37', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  const tabs = [
    { id: 'share', label: 'Market Impact', icon: PieIcon },
    { id: 'yield', label: 'Yield Dynamics', icon: TrendingUp },
    { id: 'sentiment', label: 'Sentiment Battlefield', icon: Swords },
  ];

  return (
    <div className="glass-card mb-10 overflow-hidden border border-white/[0.08] relative">
      <div className="p-6 border-b border-white/[0.08] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <Activity className="w-4 h-4 text-indigo-400" />
            </div>
            Market Intelligence Hub
          </h3>
          <p className="text-xs text-[var(--text-muted)] mt-1 ml-11 uppercase tracking-widest font-black">
            Consolidated Competitive Analysis
          </p>
        </div>

        <div className="flex bg-black/20 p-1 rounded-xl border border-white/5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                activeTab === tab.id
                  ? 'bg-white/10 text-[var(--soft-gold)] shadow-lg'
                  : 'text-[var(--text-muted)] hover:text-white'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-8 min-h-[450px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.02, y: -10 }}
            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
            className="w-full h-full"
          >
            {activeTab === 'share' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={voiceShareData}
                        cx="50%"
                        cy="50%"
                        innerRadius={80}
                        outerRadius={140}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {voiceShareData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(5, 10, 30, 0.95)',
                          borderRadius: '16px',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          backdropFilter: 'blur(10px)',
                          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)'
                        }}
                        itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-6">
                  <div className="mb-4">
                    <h4 className="text-xl font-black text-white mb-2">Voice Share Index</h4>
                    <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                      Market dominance based on total review volume and digital presence. 
                      You currently hold <span className="text-[var(--soft-gold)] font-bold">{(voiceShareData[0]?.percentage || 0).toFixed(1)}%</span> of the market&apos;s digital voice.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {voiceShareData.map((entry, index) => (
                      <div key={entry.name} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                          <span className="text-xs font-bold text-white/80">{entry.name}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-[10px] font-black text-[var(--text-muted)]">{entry.value} Reviews</span>
                          <span className="text-xs font-black text-white">{entry.percentage.toFixed(1)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'yield' && (
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={yieldData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      stroke="rgba(255,255,255,0.3)" 
                      fontSize={10} 
                      tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    />
                    <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(5, 10, 30, 0.95)',
                        borderRadius: '16px',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        backdropFilter: 'blur(10px)'
                      }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '20px' }} />
                    <Line 
                      type="monotone" 
                      dataKey="price" 
                      name="Your Rate" 
                      stroke="#D4AF37" 
                      strokeWidth={3} 
                      dot={{ r: 4, fill: '#D4AF37' }} 
                      activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }} 
                    />
                    <Line 
                      type="monotone" 
                      dataKey="market_avg" 
                      name="Market Average" 
                      stroke="rgba(255,255,255,0.2)" 
                      strokeWidth={2} 
                      strokeDasharray="5 5"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {activeTab === 'sentiment' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={sentimentData}>
                      <PolarGrid stroke="rgba(255,255,255,0.1)" />
                      <PolarAngleAxis dataKey="pillar" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 'bold' }} />
                      <PolarRadiusAxis angle={30} domain={[0, 5]} tick={false} axisLine={false} />
                      <Radar
                        name="Your Score"
                        dataKey="hotel_score"
                        stroke="#D4AF37"
                        fill="#D4AF37"
                        fillOpacity={0.6}
                      />
                      <Radar
                        name="Compset Avg"
                        dataKey="comp_avg"
                        stroke="#3B82F6"
                        fill="#3B82F6"
                        fillOpacity={0.3}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(5, 10, 30, 0.95)',
                          borderRadius: '16px',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          backdropFilter: 'blur(10px)'
                        }}
                      />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '20px' }} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-6">
                  <div className="mb-4">
                    <h4 className="text-xl font-black text-white mb-2">Competitive Sentiment Radar</h4>
                    <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                      Benchmarking your guest experience against the market average. 
                      Focus on pillars where the gold radar (You) underperforms the blue background (Market).
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    {sentimentData.map((item) => {
                      const diff = item.hotel_score - item.comp_avg;
                      return (
                        <div key={item.pillar} className="p-4 rounded-2xl bg-white/5 border border-white/5">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-black uppercase tracking-widest text-white">{item.pillar}</span>
                            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${
                              diff > 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                            }`}>
                              {diff > 0 ? '+' : ''}{diff.toFixed(1)} vs Market
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden flex">
                            <div 
                              className="h-full bg-[var(--soft-gold)]" 
                              style={{ width: `${(item.hotel_score / 5) * 100}%` }} 
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default MarketAnalysis;

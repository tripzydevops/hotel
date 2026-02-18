import AnalysisTabs from "@/components/features/analysis/AnalysisTabs";

export const metadata = {
  title: "Market Analysis | Hotel Plus",
  description: "Deep analytics for occupancy, rates, and competitive sentiment.",
};

export default function AnalysisLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--deep-ocean)]">
      {/* 
        EXPLANATION: Persistent Navigation Layout
        Balances the "Overview", "Calendar", "Discovery", and "Sentiment" pages 
        with a shared top navigation bar (AnalysisTabs).
      */}
      <div className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto pt-8">
        <AnalysisTabs />
        {children}
      </div>
    </div>
  );
}

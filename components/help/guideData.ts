export interface GuideHotspot {
  id: string;
  pinNumber: number;
  label: string;
  xPercent: number; // percentage from left
  yPercent: number; // percentage from top
  title: string;
  description: string;
  actionRequired?: string;
}

export interface VideoChapter {
  time: string;
  title: string;
  description: string;
}

export interface GuideArticle {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  category: "Getting Started" | "Dashboard & Grid" | "Inspection Modal" | "Market Analysis" | "AI & Copilot" | "Alerts & Parity" | "Reports & Admin";
  readTime: string;
  iconName: string;
  badge?: string;
  summary: string;
  video: {
    title: string;
    duration: string;
    embedUrl?: string; // e.g. youtube/loom embed or local mp4
    previewPoster?: string;
    chapters: VideoChapter[];
    keyTakeaways: string[];
  };
  screenMockup: {
    screenType: "dashboard-grid" | "hotel-modal" | "rate-calendar" | "sentiment-radar" | "copilot-panel" | "parity-monitor";
    caption: string;
    hotspots: GuideHotspot[];
  };
  objectives: string[];
  steps: {
    stepNumber: number;
    title: string;
    description: string;
    tip?: string;
  }[];
  deepDiveSections: {
    heading: string;
    content: string;
    highlights?: string[];
  }[];
  faqs: {
    question: string;
    answer: string;
  }[];
}

export const GUIDE_CATEGORIES = [
  "All Guides",
  "Getting Started",
  "Dashboard & Grid",
  "Inspection Modal",
  "Market Analysis",
  "AI & Copilot",
  "Alerts & Parity",
  "Reports & Admin",
] as const;

export const GUIDE_ARTICLES: GuideArticle[] = [
  {
    id: "getting-started",
    slug: "getting-started-onboarding",
    title: "Quick Start: First 5 Minutes on HotelPlus",
    subtitle: "Setting up your Target Hotel, defining competitor baskets, and selecting currencies",
    category: "Getting Started",
    readTime: "4 min read",
    iconName: "Compass",
    badge: "Essential",
    summary:
      "Learn the core architecture of HotelPlus. Discover how to configure your primary hotel (the Target Property), select your direct competitors, configure currency rates, and initiate your first live market scan.",
    video: {
      title: "HotelPlus in 2 Minutes: Architecture & Quick Setup",
      duration: "02:15",
      embedUrl: "https://www.youtube-nocookie.com/embed/ScMzIvxBSi4",
      previewPoster: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80",
      chapters: [
        { time: "00:00", title: "Introduction & Architecture", description: "Why rate parity and real-time OTA monitoring matter." },
        { time: "00:45", title: "Adding Target Property", description: "Designating your hotel with Google Place ID and direct website." },
        { time: "01:20", title: "Building the Competitor Basket", description: "Adding local rivals by city and star tier." },
        { time: "01:50", title: "First Live Scan & Parity Check", description: "Triggering crawler jobs and reading price alerts." },
      ],
      keyTakeaways: [
        "Your Target Hotel is marked with a gold crown and is the benchmark for all parity calculations.",
        "Competitors are monitored concurrently across major OTAs via DataForSEO crawlers.",
        "Dynamic exchange rate caching keeps international prices unified in your preferred currency.",
      ],
    },
    screenMockup: {
      screenType: "dashboard-grid",
      caption: "Main Google Hotels Live Monitoring Grid with Target Hotel and Competitor Tiles",
      hotspots: [
        {
          id: "hs-1",
          pinNumber: 1,
          label: "Target Hotel Crown",
          xPercent: 18,
          yPercent: 32,
          title: "Target Property Badge",
          description: "Your primary property is highlighted with a gold border and crown icon. All undercut metrics are calculated against this hotel's direct price.",
          actionRequired: "Ensure your direct room rate is updated or connected to match your front desk.",
        },
        {
          id: "hs-2",
          pinNumber: 2,
          label: "Live Market Pulse",
          xPercent: 55,
          yPercent: 12,
          title: "Market Average Price",
          description: "Real-time average rate across your competitor basket for the selected check-in date window.",
          actionRequired: "Compare against your target rate to see if you are priced above or below market average.",
        },
        {
          id: "hs-3",
          pinNumber: 3,
          label: "Quick Scan Trigger",
          xPercent: 88,
          yPercent: 12,
          title: "On-Demand Quick Scan",
          description: "Launches an immediate background crawler task across all tracked hotels to retrieve live rates from Google Hotels, Booking.com, and Expedia.",
          actionRequired: "Click whenever you suspect an intra-day rate move by competitors.",
        },
      ],
    },
    objectives: [
      "Understand the difference between Target Property and Competitor Baskets",
      "Configure your base currency (USD, EUR, GBP, TRY) with automatic exchange conversions",
      "Trigger on-demand market scans and inspect crawler feedback in real-time",
    ],
    steps: [
      {
        stepNumber: 1,
        title: "Locate or Add Your Target Hotel",
        description:
          "Click the '+ Add Hotel' button in the top navigation bar. Enter your hotel's official name or Google Place ID. Toggle the switch marked 'Set as Primary Target Hotel'.",
        tip: "Setting your target hotel unlocks automatic rate parity gap calculations and alerts across all analysis tabs.",
      },
      {
        stepNumber: 2,
        title: "Populate Your Competitor Basket",
        description:
          "Add 3 to 10 hotels in your immediate submarket or competing tier. You can also use the AI Discovery Engine (/analysis/discovery) to auto-detect rivals.",
        tip: "Keep competitors within the same geographic sub-market (e.g. Taksim, Istanbul) for accurate average market pulse metrics.",
      },
      {
        stepNumber: 3,
        title: "Set Your Preferred Display Currency",
        description:
          "Use the currency toggle dropdown in the top bar to choose between USD, EUR, GBP, or TRY. HotelPlus uses high-precision exchange rate caching with auto-fallback.",
      },
      {
        stepNumber: 4,
        title: "Initiate Your Baseline Market Scan",
        description:
          "Click 'Scan All Hotels' or 'Quick Scan'. A modal will display real-time crawler worker stages while rates and OTA room catalogs are being retrieved.",
      },
    ],
    deepDiveSections: [
      {
        heading: "How HotelPlus Solves the 'Cold Start' Challenge",
        content:
          "Unlike legacy revenue management systems that require months of historical reservation ingestion before offering pricing guidance, HotelPlus utilizes autonomous AI agents and vector embeddings (pgvector). The system analyzes competitor amenity configurations, live guest review sentiments, and pricing velocity from day one.",
        highlights: [
          "Zero-history cold start recommendation engine powered by Gemini 3.1 Pro.",
          "Vector-based semantic search finds rival hotels matching guest expectations.",
          "Real-time streaming scrape engine eliminates stale 24-hour rate caches.",
        ],
      },
    ],
    faqs: [
      {
        question: "Can I track more than one Target Property?",
        answer: "Enterprise accounts support multi-property switching from the top hotel selector dropdown. Standard accounts monitor one target hotel with up to 15 competitors.",
      },
      {
        question: "How often are prices refreshed automatically?",
        answer: "By default, automated background rollups run daily, and the system supports on-demand scans whenever you click the scan button.",
      },
    ],
  },
  {
    id: "dashboard-grid",
    slug: "google-hotels-live-dashboard",
    title: "Google Hotels Live Dashboard & Market Pulse",
    subtitle: "Navigating live price tiles, sparkline trends, parity violation badges, and crawler feeds",
    category: "Dashboard & Grid",
    readTime: "5 min read",
    iconName: "LayoutGrid",
    badge: "Core Feature",
    summary:
      "The Live Dashboard is the cockpit of HotelPlus. It aggregates live pricing across Google Hotels, Booking.com, and Expedia, highlighting undercutting OTAs and competitor rate fluctuations at a glance.",
    video: {
      title: "Mastering the Live Dashboard & Rate Cards",
      duration: "03:10",
      embedUrl: "https://www.youtube-nocookie.com/embed/L_LUpnjgPso",
      previewPoster: "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1200&q=80",
      chapters: [
        { time: "00:00", title: "Dashboard Overview & KPI Bar", description: "Understanding Market Pulse, Target Price, and Undercut Counters." },
        { time: "01:05", title: "Hotel Tile Anatomy", description: "Reading price trends, OTA badges, and star ratings." },
        { time: "01:55", title: "Undercutting & Parity Badges", description: "Spotting rogue OTAs selling below direct rates." },
        { time: "02:30", title: "Intraday Rate Stories & Scans", description: "Inspecting price changes that happened today." },
      ],
      keyTakeaways: [
        "Red badges indicate a competitor or OTA is undercutting your direct rate.",
        "Green badges indicate your direct rate is the best offer in the market.",
        "Clicking any card opens the 6-Tab Deep Inspection Modal.",
      ],
    },
    screenMockup: {
      screenType: "dashboard-grid",
      caption: "HotelPlus Live Grid: Target Property vs Competitor Cards",
      hotspots: [
        {
          id: "hs-tile-price",
          pinNumber: 1,
          label: "Live Price & Delta",
          xPercent: 24,
          yPercent: 48,
          title: "Current Room Rate & 24h Delta",
          description: "Displays current lowest publicly available rate. Green or red arrows indicate price shifts compared to the previous scan session.",
        },
        {
          id: "hs-tile-ota",
          pinNumber: 2,
          label: "OTA Channel Badges",
          xPercent: 22,
          yPercent: 68,
          title: "Active Vendor Channels",
          description: "Shows which vendors (Booking.com, Expedia, Agoda, Direct) are active, and highlights the vendor offering the lowest price.",
        },
        {
          id: "hs-tile-actions",
          pinNumber: 3,
          label: "Card Actions & Deep Dive",
          xPercent: 32,
          yPercent: 35,
          title: "Quick Inspect & Edit",
          description: "Click 'View Details' to inspect the full 6-tab modal, or click the scan icon to trigger a single-hotel refresh.",
        },
      ],
    },
    objectives: [
      "Interpret the KPI header metrics: Target Price, Market Average, Undercut Count",
      "Read price change sparklines and 24-hour percentage variances",
      "Identify rogue OTA undercutting before prospective guests book elsewhere",
    ],
    steps: [
      {
        stepNumber: 1,
        title: "Review the Top Metric Cards",
        description:
          "Check the 'Undercutting' badge. If it shows a number greater than 0, at least one OTA is selling your rooms below your direct rate, or a competitor has dropped rates below yours.",
      },
      {
        stepNumber: 2,
        title: "Filter and Sort the Hotel Grid",
        description:
          "Sort by 'Price: Low to High', 'Rating', or 'Most Undercut' to quickly spot aggressive competitor discounts.",
      },
      {
        stepNumber: 3,
        title: "Inspect Sparkline Trends",
        description:
          "Each tile includes a mini historical trend graph showing price movements over the last 7 to 30 days.",
      },
    ],
    deepDiveSections: [
      {
        heading: "Understanding the Parity Engine Logic",
        content:
          "When our crawler scans Google Hotels, it resolves the nested 'offers' block from DataForSEO. It compares the official Direct hotel website offer against third-party intermediaries (e.g. Booking.com, Trip.com, Prestigia). If an OTA's published rate is lower than Direct by even $1, HotelPlus flags a Rate Parity Breach.",
      },
    ],
    faqs: [
      {
        question: "Why does a hotel tile show 'Estimated'?",
        answer: "If a competitor is fully booked on the selected dates, HotelPlus uses the most recent verified price log or historical rollup snapshot.",
      },
    ],
  },
  {
    id: "hotel-inspection",
    slug: "6-tab-hotel-inspection-modal",
    title: "6-Tab Deep Hotel Inspection Modal",
    subtitle: "Complete forensic analysis of rooms, OTA vendor offers, reviews, amenities, and media",
    category: "Inspection Modal",
    readTime: "6 min read",
    iconName: "Eye",
    badge: "Advanced",
    summary:
      "Clicking 'View Details' on any hotel opens the 6-Tab Inspection Modal. It is a full forensic console displaying room tiers, vendor rate distributions, AI-synthesized guest sentiment, and amenities.",
    video: {
      title: "Mastering the 6-Tab Hotel Inspection Modal",
      duration: "04:00",
      embedUrl: "https://www.youtube-nocookie.com/embed/1la40l03574",
      previewPoster: "https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=1200&q=80",
      chapters: [
        { time: "00:00", title: "Modal Overview", description: "Opening the modal and navigating the 6 tabs." },
        { time: "00:50", title: "Tab 1: Overview & Location", description: "GPS coordinates, phone, check-in rules, star rating." },
        { time: "01:30", title: "Tab 2: Rooms & Catalog", description: "Room tier mappings (Deluxe, Suite, Standard)." },
        { time: "02:20", title: "Tab 3: Offers & OTA Channels", description: "Side-by-side pricing from all OTAs." },
        { time: "03:10", title: "Tab 4: Sentiment & Reviews", description: "AI guest review breakdown and topic sentiment." },
        { time: "03:45", title: "Tabs 5 & 6: Amenities & Gallery", description: "Feature comparison and high-res imagery." },
      ],
      keyTakeaways: [
        "The Offers tab is the primary tool to catch OTAs violating rate agreements.",
        "The Sentiment tab runs AI summarization on thousands of guest reviews.",
        "Room tiers are normalized so you compare Deluxe-to-Deluxe, not Deluxe-to-Economy.",
      ],
    },
    screenMockup: {
      screenType: "hotel-modal",
      caption: "6-Tab Hotel Details Modal: Forensic breakdown of room tiers and OTA offers",
      hotspots: [
        {
          id: "hs-tab-nav",
          pinNumber: 1,
          label: "Tab Navigation Header",
          xPercent: 50,
          yPercent: 18,
          title: "6 Specialized Forensic Tabs",
          description: "Switch seamlessly between Overview, Rooms, Offers, Reviews, Amenities, and Gallery.",
        },
        {
          id: "hs-tab-offers",
          pinNumber: 2,
          label: "OTA Offers Matrix",
          xPercent: 35,
          yPercent: 50,
          title: "Multi-OTA Comparison Table",
          description: "Lists every vendor selling rooms for this property, including prices, direct booking links, and currency conversion.",
        },
        {
          id: "hs-tab-sentiment",
          pinNumber: 3,
          label: "Guest Sentiment Score",
          xPercent: 72,
          yPercent: 50,
          title: "Sentiment & Topic Radar",
          description: "Analyzes guest mentions across Cleanliness, Service, Breakfast, WiFi, and Location with positive/negative percentages.",
        },
      ],
    },
    objectives: [
      "Perform room-tier price audits (checking if an OTA lists Standard at a price lower than your website)",
      "Analyze competitor strengths and weaknesses via AI sentiment extraction",
      "Audit competitor amenity packages (free breakfast, pool, spa) vs your hotel",
    ],
    steps: [
      {
        stepNumber: 1,
        title: "Click 'View Details' on Any Hotel Tile",
        description: "The 6-tab modal opens instantly with cached data, pre-fetching live rate logs.",
      },
      {
        stepNumber: 2,
        title: "Inspect the 'Offers' Tab for Parity Leakage",
        description: "Sort offers from lowest to highest. If an OTA is listed lower than the official hotel site, note the vendor name and price delta.",
      },
      {
        stepNumber: 3,
        title: "Navigate to the 'Reviews' Tab for Sentiment Mining",
        description: "Review top complaints for competitors (e.g. slow check-in, noisy street) to market your hotel's contrasting strengths.",
      },
    ],
    deepDiveSections: [
      {
        heading: "Deep Granular Deduplication Algorithm",
        content:
          "HotelPlus uses a composite key `{source}_{room_type}_{price}` to prevent duplicate offers from cluttering the table while preserving legitimate multi-tier room offers from the same vendor.",
      },
    ],
    faqs: [
      {
        question: "Can I click the OTA links to verify the price?",
        answer: "Yes, clicking the external link icon next to any vendor opens the exact booking landing page on that OTA for instant manual verification.",
      },
    ],
  },
  {
    id: "rate-calendar",
    slug: "30-day-rate-calendar-matrix",
    title: "30-Day Rate Calendar Matrix",
    subtitle: "Macro pricing calendar, competitor forward-rate curves, and demand spike indicators",
    category: "Market Analysis",
    readTime: "5 min read",
    iconName: "Calendar",
    badge: "Revenue Essential",
    summary:
      "The Rate Calendar (/analysis/calendar) maps out day-by-day rates across the next 30 to 90 days. Quickly detect weekends where competitors are jacking up rates or dumping distressed inventory.",
    video: {
      title: "Mastering the 30-Day Rate Calendar",
      duration: "02:45",
      embedUrl: "https://www.youtube-nocookie.com/embed/V-_O7nl0Ii0",
      previewPoster: "https://images.unsplash.com/photo-1506059612708-99d6c258160e?auto=format&fit=crop&w=1200&q=80",
      chapters: [
        { time: "00:00", title: "Calendar Interface Tour", description: "Understanding the date grid and price heatmaps." },
        { time: "00:45", title: "Target vs Market Spread", description: "Visualizing forward pricing differences." },
        { time: "01:30", title: "Filtering Room Types", description: "Isolating suites from entry-level rooms." },
        { time: "02:10", title: "Identifying High-Demand Dates", description: "Spotting holidays and local event pricing spikes." },
      ],
      keyTakeaways: [
        "Color heatmaps immediately highlight days where your price is misaligned with market averages.",
        "Forward scans help you avoid selling out too early during high-demand local events.",
      ],
    },
    screenMockup: {
      screenType: "rate-calendar",
      caption: "Interactive Rate Calendar Matrix: Daily competitor rate comparison",
      hotspots: [
        {
          id: "hs-cal-header",
          pinNumber: 1,
          label: "Date Range & Filters",
          xPercent: 30,
          yPercent: 15,
          title: "Date Range Selector",
          description: "Toggle between 7-day, 14-day, and 30-day forward outlooks.",
        },
        {
          id: "hs-cal-cells",
          pinNumber: 2,
          label: "Daily Price Matrix",
          xPercent: 50,
          yPercent: 45,
          title: "Rate Spread Heatmap",
          description: "Each cell displays your rate vs the competitor average. Red outlines indicate dates where competitors undercut you.",
        },
      ],
    },
    objectives: [
      "Review forward-looking pricing trends up to 30 days in advance",
      "Spot competitor compression dates (dates where competitors are sold out or raising rates significantly)",
      "Align direct pricing with market demand cycles",
    ],
    steps: [
      {
        stepNumber: 1,
        title: "Select Your Date Window",
        description: "Choose check-in dates using the calendar picker controls at the top of `/analysis/calendar`.",
      },
      {
        stepNumber: 2,
        title: "Analyze the Daily Spread",
        description: "Compare your daily row against the market benchmark row. Notice days with significant variance.",
      },
      {
        stepNumber: 3,
        title: "Export Calendar Data",
        description: "Click 'Export Schedule' to download the 30-day matrix as a spreadsheet for your PMS or revenue team.",
      },
    ],
    deepDiveSections: [
      {
        heading: "Hybrid Trend Pipeline",
        content:
          "The calendar leverages our hybrid historical rollup pipeline: querying live price logs for recent dates and daily rollup summaries (price_history_daily) for macro trends, keeping load times under 200ms.",
      },
    ],
    faqs: [
      {
        question: "Can I scan dates beyond 30 days?",
        answer: "Yes, enterprise tiers can configure scan schedules up to 90 or 180 days in advance.",
      },
    ],
  },
  {
    id: "discovery-engine",
    slug: "ai-competitor-discovery-radar",
    title: "AI Discovery Engine: Vector Semantic Competitor Match",
    subtitle: "Using pgvector & Gemini embeddings to discover non-obvious rival hotels",
    category: "Market Analysis",
    readTime: "4 min read",
    iconName: "Radar",
    badge: "AI Powered",
    summary:
      "Traditional tools only find competitors based on GPS radius. HotelPlus's Discovery Engine (/analysis/discovery) creates 1536-dimensional semantic embeddings of guest personas, hotel amenities, and pricing bands to find your true rivals.",
    video: {
      title: "Discovering Hidden Rivals with Semantic AI",
      duration: "02:30",
      embedUrl: "https://www.youtube-nocookie.com/embed/5qap5aO4i9A",
      previewPoster: "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1200&q=80",
      chapters: [
        { time: "00:00", title: "Why GPS Distance Fails", description: "A boutique luxury hotel does not compete with a budget motel next door." },
        { time: "00:50", title: "How Vector Discovery Works", description: "Amenity matching, guest lifestyle, and pricing tier." },
        { time: "01:40", title: "Adding Discovered Rivals", description: "One-click addition to your live monitoring grid." },
      ],
      keyTakeaways: [
        "Discovers hotels that share your exact guest target persona even if they are 5 miles away.",
        "Uses HNSW vector indexing for millisecond-fast semantic similarity scores.",
      ],
    },
    screenMockup: {
      screenType: "rate-calendar",
      caption: "Competitor Discovery Radar: Semantic match score and rival recommendations",
      hotspots: [
        {
          id: "hs-disc-score",
          pinNumber: 1,
          label: "Similarity Score",
          xPercent: 75,
          yPercent: 30,
          title: "Semantic Match %",
          description: "Calculates similarity score (e.g. 94% match) based on amenities, star rating, vibe, and guest segment.",
        },
        {
          id: "hs-disc-add",
          pinNumber: 2,
          label: "One-Click Add",
          xPercent: 85,
          yPercent: 55,
          title: "Add to Active Basket",
          description: "Click to start tracking this newly discovered hotel in your live Google Hotels dashboard.",
        },
      ],
    },
    objectives: [
      "Find genuine competitor properties that traditional radius filters overlook",
      "Benchmark similarity scores against your target property",
      "Expand your competitor basket with one click",
    ],
    steps: [
      {
        stepNumber: 1,
        title: "Navigate to /analysis/discovery",
        description: "The engine runs a background vector similarity query against our regional hotel database.",
      },
      {
        stepNumber: 2,
        title: "Review Similarity Shards",
        description: "Inspect matching tags such as 'Boutique Design', 'Business Executive', 'Spa & Wellness', and 'Rooftop Lounge'.",
      },
      {
        stepNumber: 3,
        title: "Add to Grid",
        description: "Click 'Track Hotel' to immediately schedule scans and include them in your market pulse calculations.",
      },
    ],
    deepDiveSections: [
      {
        heading: "The Math Behind Semantic Discovery",
        content:
          "We generate embeddings using Google's text-embedding models, stored in PostgreSQL with pgvector. The query computes cosine distance over hotel descriptions, amenity lists, and target personas, ranking candidates by similarity.",
      },
    ],
    faqs: [
      {
        question: "Does the search stay within my city?",
        answer: "Yes, searches are filtered by target city and region to ensure all recommended rivals are relevant to your market.",
      },
    ],
  },
  {
    id: "parity-alerts",
    slug: "rate-parity-monitoring-alerts",
    title: "Rate Parity Monitoring & Violation Alerts",
    subtitle: "Automated breach detection, alert thresholds, and evidence capture for OTA disputes",
    category: "Alerts & Parity",
    readTime: "5 min read",
    iconName: "ShieldAlert",
    badge: "Revenue Protection",
    summary:
      "When OTAs undercut your direct rate by passing on unapproved discounts or foreign currency markdowns, you lose revenue and direct bookings. Learn how to configure automated parity alerts and collect timestamped proof.",
    video: {
      title: "Enforcing Rate Parity & Winning OTA Disputes",
      duration: "03:15",
      embedUrl: "https://www.youtube-nocookie.com/embed/9bZkp7q19f0",
      previewPoster: "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?auto=format&fit=crop&w=1200&q=80",
      chapters: [
        { time: "00:00", title: "The High Cost of Parity Breaches", description: "Why direct bookings evaporate when OTAs undercut." },
        { time: "00:45", title: "Configuring Parity Thresholds", description: "Setting percentage and dollar deviation limits." },
        { time: "01:30", title: "Reviewing Parity Violation Cards", description: "Reading screenshots, vendor identities, and price deltas." },
        { time: "02:15", title: "Generating Dispute Evidence", description: "Exporting audit logs to send your OTA market manager." },
      ],
      keyTakeaways: [
        "Set alert sensitivity to notify you only when undercutting exceeds your acceptable buffer (e.g. >2%).",
        "Every breach records the exact timestamp, vendor name, currency, and room category.",
      ],
    },
    screenMockup: {
      screenType: "parity-monitor",
      caption: "Rate Parity Monitor: Live feed of detected violations across OTA channels",
      hotspots: [
        {
          id: "hs-parity-flag",
          pinNumber: 1,
          label: "Violation Delta",
          xPercent: 30,
          yPercent: 40,
          title: "Price Discrepancy Amount",
          description: "Shows exactly how much the OTA is undercutting your direct rate (e.g. -$18 / -12%).",
        },
        {
          id: "hs-parity-channel",
          pinNumber: 2,
          label: "Offending Channel",
          xPercent: 18,
          yPercent: 55,
          title: "Channel Identification",
          description: "Identifies whether the leak originated from Agoda Private Rates, Booking.com Genius, or Expedia Member Deals.",
        },
      ],
    },
    objectives: [
      "Configure automated email and in-app alerts for parity violations",
      "Identify the specific OTA channel breaching your direct rate",
      "Export timestamped forensic records to dispute unauthorized discounting with your OTA account manager",
    ],
    steps: [
      {
        stepNumber: 1,
        title: "Access Parity Monitor (/analysis/parity)",
        description: "Review current parity health index and the list of active violations.",
      },
      {
        stepNumber: 2,
        title: "Open Alerts Configuration",
        description: "Click 'Alert Settings' or the bell icon in the top header. Set your notification threshold (e.g., notify if undercut by >$5).",
      },
      {
        stepNumber: 3,
        title: "Generate Dispute Packet",
        description: "Click 'Export Violation Dossier' to generate a timestamped report ready to send to your market manager.",
      },
    ],
    deepDiveSections: [
      {
        heading: "Detecting Hidden OTA Discount Tactics",
        content:
          "Many OTAs bypass standard parity checks by applying mobile-only discounts, geo-targeted rates, or packaging discounts. HotelPlus's distributed crawler simulates multiple user agents to catch these hidden rate leaks.",
      },
    ],
    faqs: [
      {
        question: "Can HotelPlus automatically update my channel manager?",
        answer: "We offer API webhook integrations in enterprise plans to trigger automatic rate updates in supported channel managers.",
      },
    ],
  },
  {
    id: "copilot-ai",
    slug: "gemini-autonomous-copilot",
    title: "Autonomous AI Copilot & Pricing DNA",
    subtitle: "Conversational market reasoning, Gemini 3.1 Pro integration, and strategy synthesis",
    category: "AI & Copilot",
    readTime: "5 min read",
    iconName: "Sparkles",
    badge: "Next-Gen AI",
    summary:
      "The HotelPlus Copilot is an autonomous reasoning engine powered by Gemini 3.1 Pro. Rather than merely presenting raw numbers, Copilot explains WHY competitors changed prices and synthesizes actionable recommendations.",
    video: {
      title: "Conversational Revenue Strategy with AI Copilot",
      duration: "02:50",
      embedUrl: "https://www.youtube-nocookie.com/embed/kJQP7kiw5Fk",
      previewPoster: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80",
      chapters: [
        { time: "00:00", title: "Launching Copilot", description: "Opening the floating AI panel from any page." },
        { time: "00:40", title: "Asking Tactical Questions", description: "Querying market shifts in plain English." },
        { time: "01:25", title: "Pricing DNA Synthesis", description: "Understanding Yield Seeker vs Volume Leader behaviors." },
        { time: "02:10", title: "Actionable Recommendations", description: "Generating immediate price adjustments." },
      ],
      keyTakeaways: [
        "Ask questions like: 'Should I raise prices for next Saturday based on competitor occupancy?'",
        "Copilot automatically evaluates competitor Pricing DNA and historical price velocity.",
        "Responses are grounded in real, live scan data with zero hallucinations.",
      ],
    },
    screenMockup: {
      screenType: "copilot-panel",
      caption: "Copilot AI Assistant: Natural language revenue intelligence and strategy chat",
      hotspots: [
        {
          id: "hs-copilot-input",
          pinNumber: 1,
          label: "Prompt Input Bar",
          xPercent: 50,
          yPercent: 88,
          title: "Natural Language Prompting",
          description: "Type questions or click suggested prompt chips such as 'Analyze weekend demand' or 'Summarize parity leaks'.",
        },
        {
          id: "hs-copilot-dna",
          pinNumber: 2,
          label: "Pricing DNA Analysis",
          xPercent: 45,
          yPercent: 35,
          title: "Competitor Strategy Classification",
          description: "Copilot categorizes rivals into 'Volume Leaders' (aggressive discounting) or 'Yield Seekers' (holding rate for RevPAR).",
        },
      ],
    },
    objectives: [
      "Use conversational natural language to query market intelligence",
      "Understand competitor behavior types (Yield Seeker vs Volume Leader)",
      "Get actionable daily pricing recommendations tailored to your occupancy goals",
    ],
    steps: [
      {
        stepNumber: 1,
        title: "Click the Copilot Sparkle Icon",
        description: "Open the Copilot drawer on the right side of any dashboard screen.",
      },
      {
        stepNumber: 2,
        title: "Select a Suggested Strategy Prompt",
        description: "Choose 'Analyze Market Velocity' or type your own question regarding specific dates.",
      },
      {
        stepNumber: 3,
        title: "Review the AI Reasoning & Recommendation",
        description: "Copilot provides clear rationale explaining whether to match, hold, or undercut competitor rates.",
      },
    ],
    deepDiveSections: [
      {
        heading: "Dynamic AI Model Fallback Cascade",
        content:
          "The Copilot leverages a resilient multi-tier model cascade defined in `ai_config.py`. It defaults to `gemini-3.1-pro-preview` for deep strategic reasoning, with automatic dynamic fallback to ensure zero downtime.",
      },
    ],
    faqs: [
      {
        question: "Does Copilot share my hotel's data publicly?",
        answer: "No. All Copilot queries are executed within your secure isolated tenant workspace.",
      },
    ],
  },
  {
    id: "reports-exports",
    slug: "executive-reports-exports",
    title: "Executive Reports & PMS Data Exports",
    subtitle: "Generating PDF audit packets, scheduling CSV exports, and sharing findings",
    category: "Reports & Admin",
    readTime: "4 min read",
    iconName: "FileText",
    badge: "Reporting",
    summary:
      "Export clean, presentation-ready PDF reports for hotel owners and general managers, or download raw CSV price logs to ingest into PMS or Excel models.",
    video: {
      title: "Generating Executive Parity & Pricing Reports",
      duration: "02:10",
      embedUrl: "https://www.youtube-nocookie.com/embed/ScMzIvxBSi4",
      previewPoster: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80",
      chapters: [
        { time: "00:00", title: "Reports Overview", description: "Available templates and export formats." },
        { time: "00:45", title: "Customizing Report Parameters", description: "Date filters, competitor selection, metrics." },
        { time: "01:25", title: "Exporting PDF & CSV", description: "One-click download of audit packets." },
      ],
      keyTakeaways: [
        "Generate one-click PDF reports formatted for executive presentations.",
        "Export clean CSV datasets for custom analysis in Excel or PMS.",
      ],
    },
    screenMockup: {
      screenType: "dashboard-grid",
      caption: "Reports Console: Report builder and export options",
      hotspots: [
        {
          id: "hs-rep-export",
          pinNumber: 1,
          label: "Export Buttons",
          xPercent: 78,
          yPercent: 22,
          title: "PDF & CSV Export",
          description: "Generate instant PDF summary or raw CSV data download.",
        },
      ],
    },
    objectives: [
      "Generate executive-ready PDF rate parity audit reports",
      "Export raw CSV price history for Excel modeling",
      "Schedule recurring automated report deliveries",
    ],
    steps: [
      {
        stepNumber: 1,
        title: "Navigate to /reports",
        description: "Select the report type: 'Parity Audit', 'Competitor Trend', or 'Market Summary'.",
      },
      {
        stepNumber: 2,
        title: "Configure Date Range & Properties",
        description: "Choose the reporting window (Last 7 Days, Month-to-Date, Custom).",
      },
      {
        stepNumber: 3,
        title: "Download or Schedule",
        description: "Click 'Download PDF' for immediate review or set up an automated weekly schedule.",
      },
    ],
    deepDiveSections: [
      {
        heading: "Automated Data Maintenance & Aggregations",
        content:
          "Daily aggregation rollups run in PostgreSQL via `perform_data_maintenance()`, aggregating thousands of raw price points into clean daily benchmarks.",
      },
    ],
    faqs: [
      {
        question: "Can I customize the PDF logo and branding?",
        answer: "Enterprise accounts can upload custom hotel logos and corporate color themes in Settings.",
      },
    ],
  },
  {
    id: "admin-operations",
    slug: "admin-panel-crawler-operations",
    title: "Master Control: Crawler Operations & System Health",
    subtitle: "Monitoring scan pipelines, Dead Man's Switch heartbeat, and AI model cascades",
    category: "Reports & Admin",
    readTime: "5 min read",
    iconName: "Shield",
    badge: "Admin Only",
    summary:
      "For system administrators and technical managers: overview of crawler pipeline queues, DataForSEO task health, Dead Man's Switch heartbeat monitoring, and database management.",
    video: {
      title: "Admin Operations & Infrastructure Monitoring",
      duration: "02:40",
      chapters: [
        { time: "00:00", title: "Admin Panel Overview", description: "System health and active workers." },
        { time: "00:50", title: "Dead Man's Switch Monitoring", description: "Heartbeat alerts and scan frequency." },
        { time: "01:35", title: "AI Model Cascade Settings", description: "Configuring Gemini fallback order." },
      ],
      keyTakeaways: [
        "Dead Man's Switch triggers an alert if no global scan runs for >8 hours.",
        "Model Cascade ensures zero downtime by failing over across Gemini model versions.",
      ],
    },
    screenMockup: {
      screenType: "dashboard-grid",
      caption: "Admin Master Control: Worker queues, crawler health, and system telemetry",
      hotspots: [
        {
          id: "hs-adm-dms",
          pinNumber: 1,
          label: "Dead Man's Switch",
          xPercent: 20,
          yPercent: 25,
          title: "Dead Man's Switch Heartbeat",
          description: "Continuously tracks last_global_scan_at. If scans stall, red banner alerts fire immediately.",
        },
      ],
    },
    objectives: [
      "Monitor real-time status of DataForSEO crawler queues",
      "Inspect Dead Man's Switch heartbeat to ensure scans are never delayed",
      "Configure active AI model fallback cascade in Admin Settings",
    ],
    steps: [
      {
        stepNumber: 1,
        title: "Access /admin",
        description: "Only available to users with the 'admin' role in their user profile.",
      },
      {
        stepNumber: 2,
        title: "Inspect Telemetry & Health",
        description: "Verify worker status, API quota remaining, and recent scan task logs.",
      },
    ],
    deepDiveSections: [
      {
        heading: "Dead Man's Switch Heartbeat Alert Architecture",
        content:
          "Defined in `monitor_service.py`, `check_dead_mans_switch()` runs periodic health checks. If $>8$ hours elapse without a completed scan, high-priority audit events and warning banners are triggered across the platform.",
      },
    ],
    faqs: [
      {
        question: "How do I grant admin access to another team member?",
        answer: "Admins can update user roles via the Users tab in the Admin Panel or through Supabase profiles table.",
      },
    ],
  },
];

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // KAIZEN: Enforce type safety for production stability
    ignoreBuildErrors: false,
  },
  // [REMOVED] Legacy External Proxy. API now handled by local Python backend at api/index.py
  // Enable built-in asset compression (Gzip/Brotli) for static files
  compress: true,
  experimental: {
    serverActions: {
      allowedOrigins: [
        "localhost:3000",
        "tripzydevops-hotel.vercel.app",
        "www.hotelplustr.com",
        "hotelplustr.com",
      ]
    },
    // optimizePackageImports reduces bundle size by only importing the parts of 
    // these heavy libraries that are actually used in each page.
    optimizePackageImports: ["lucide-react", "recharts"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.insforge.app",
      },
      {
        protocol: "https",
        hostname: "*.booking.com",
      },
      {
        protocol: "https",
        hostname: "cf.bstatic.com",
      },
      {
        protocol: "https",
        hostname: "t-cf.bstatic.com",
      },
      {
        protocol: "https",
        hostname: "q-xx.bstatic.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "images.trvl-media.com",
      },
      {
        protocol: "https",
        hostname: "media-cdn.tripadvisor.com",
      },
      {
        protocol: "https",
        hostname: "encrypted-tbn0.gstatic.com",
      },
      {
        protocol: "https",
        hostname: "*.expedia.com",
      },
      {
        protocol: "https",
        hostname: "*.hotels.com",
      },
    ],
  },
  // P-API REWRITES (V25): Dynamic Environment-based Routing
  // Moves rewrites from vercel.json to next.config.ts to allow project-specific
  // routing without manual configuration in vercel.json.
  async rewrites() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
    if (!supabaseUrl) return [];

    return [
      {
        source: "/auth/v1/:path*",
        destination: `${supabaseUrl}/auth/v1/:path*`,
      },
      {
        source: "/rest/v1/:path*",
        destination: `${supabaseUrl}/rest/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;

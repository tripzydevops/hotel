import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // KAIZEN: Enforce type safety for production stability
    ignoreBuildErrors: false,
  },
  // [REMOVED] Legacy External Proxy. API now handled by local Python backend at api/index.py
  // Enable built-in asset compression (Gzip/Brotli) for static files
  compress: true,

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
  // Proxy auth and rest endpoints to InsForge using environment variables
  async rewrites() {
    return [
      {
        source: "/api/auth/:path*",
        destination: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/api/auth/:path*`,
      },
      {
        source: "/auth/v1/:path*",
        destination: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/:path*`,
      },
      {
        source: "/rest/v1/:path*",
        destination: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/api/auth/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization, X-Requested-With, Accept, Origin, apikey" },
        ],
      },
      {
        source: "/auth/v1/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization, X-Requested-With, Accept, Origin, apikey" },
        ],
      },
      {
        source: "/rest/v1/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization, X-Requested-With, Accept, Origin, apikey, Prefer" },
        ],
      },
    ];
  },
};

export default nextConfig;

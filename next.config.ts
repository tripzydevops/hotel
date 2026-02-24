// @ts-nocheck
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // KAIZEN: Enforce type safety for production stability
    ignoreBuildErrors: false,
  },
  async rewrites() {
    return [
      process.env.NODE_ENV === "development"
        ? {
            source: "/api/:path*",
            destination: "http://127.0.0.1:8000/api/:path*",
          }
        : [],
    ].flat();
  },
  // Enable built-in asset compression (Gzip/Brotli) for static files
  compress: true,
  experimental: {
    // optimizePackageImports reduces bundle size by only importing the parts of 
    // these heavy libraries that are actually used in each page.
    optimizePackageImports: ["lucide-react", "recharts"],
  },
  images: {
    remotePatterns: [
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
};

export default nextConfig;

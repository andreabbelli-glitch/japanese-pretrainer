import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/media-audio/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable"
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff"
          }
        ]
      }
    ];
  },
  devIndicators: false,
  reactStrictMode: true,
  serverExternalPackages: ["@open-spaced-repetition/binding"],
  typedRoutes: true
};

export default nextConfig;

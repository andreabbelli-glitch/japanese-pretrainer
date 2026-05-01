import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  reactStrictMode: true,
  serverExternalPackages: ["@open-spaced-repetition/binding"],
  typedRoutes: true
};

export default nextConfig;

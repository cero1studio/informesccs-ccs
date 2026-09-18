import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true },
  eslint:     { ignoreDuringBuilds: true },
  images: {
    remotePatterns: [{ hostname: 'camaradecomerciosoacha.org.co' }],
  },
};

export default nextConfig;

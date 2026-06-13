import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Photo uploads go through a Server Action; the default body cap is 1 MB,
    // which phone photos blow past. Client-side resize keeps payloads small,
    // this is the safety net for the un-resized fallback path.
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "music-metadata", "slsk-client", "node-id3", "chokidar"],
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;

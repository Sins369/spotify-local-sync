import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "music-metadata", "slsk-client", "node-id3", "chokidar"],
};

export default nextConfig;

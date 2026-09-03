import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "@libsql/client"],
  images: {
    unoptimized: true,
  },
};

export default nextConfig;

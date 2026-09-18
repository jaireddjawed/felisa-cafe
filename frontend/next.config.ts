import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits a self-contained `.next/standalone` build (app + pruned
  // node_modules) so the runtime Docker stage doesn't need `npm install`.
  output: "standalone",
};

export default nextConfig;

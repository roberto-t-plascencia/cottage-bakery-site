import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output bundles only the production dependencies actually
  // used at runtime into .next/standalone — the Docker image below copies
  // just that, instead of the full node_modules tree. Keeps the shipped
  // image small without a separate manual dependency-pruning step.
  output: "standalone",
};

export default nextConfig;

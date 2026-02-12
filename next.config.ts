import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["vm2", "isolated-vm"],
};

export default nextConfig;

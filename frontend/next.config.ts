import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
};

module.exports = {
  allowedDevOrigins: ["ec2-3-129-206-222.us-east-2.compute.amazonaws.com"],
};

export default nextConfig;

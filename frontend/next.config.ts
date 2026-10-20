import type { NextConfig } from "next";
import path from "path";

// Where the Next server forwards /api/* requests. The browser only talks to
// the Next origin (e.g. CloudFront over HTTPS), so the backend never needs to
// be exposed publicly or served over TLS itself.
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  allowedDevOrigins: [
    "ec2-3-129-206-222.us-east-2.compute.amazonaws.com",
    "d381vgrwdqsb3p.cloudfront.net",
  ],
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` }];
  },
};

export default nextConfig;

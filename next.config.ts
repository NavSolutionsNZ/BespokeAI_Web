import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Serve the existing marketing site unchanged at /
  async redirects() {
    return []
  },
  async rewrites() {
    return [
      // /index.html served by Next.js from public/ automatically
    ]
  },
}

export default nextConfig

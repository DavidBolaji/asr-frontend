/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const backend = process.env.TRANSCRIPTION_API_URL

    if (!backend) return []

    return [
      // WebSocket proxy — Vercel's edge handles the WS upgrade server-side
      // so the browser connects wss:// to Vercel, Vercel connects ws:// to backend
      {
        source: '/ws/:path*',
        destination: `${backend}/:path*`,
      },
    ]
  },
}

export default nextConfig

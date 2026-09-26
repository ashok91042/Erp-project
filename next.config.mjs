/** @type {import('next').NextConfig} */
// Backend origin for the /api proxy (rewrites below). Overridable for deployments
// where the API is hosted elsewhere.
const API_ORIGIN = process.env.API_ORIGIN || "http://localhost:4000";

const nextConfig = {
  reactStrictMode: true,
  // Proxy API calls through the Next server so the browser always talks
  // same-origin. This avoids CORS failures ("Failed to fetch") when the app
  // is opened via 127.0.0.1, another port, or an https tunnel.
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_ORIGIN}/api/:path*`,
      },
    ];
  },
};
export default nextConfig;

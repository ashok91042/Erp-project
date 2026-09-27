/** @type {import('next').NextConfig} */
// Backend origin for the /api proxy (rewrites below). Overridable for deployments
// where the API is hosted elsewhere.
const API_ORIGIN = process.env.API_ORIGIN || "http://localhost:4000";

// On Vercel the two apps are separate services of ONE project, and vercel.json
// routes /api/backend/* straight to the Express backend. A rewrite here would
// hijack those requests and forward them to http://localhost:4000, which does
// not exist inside a Vercel Function — so the proxy is local-dev only, unless
// an explicit API_ORIGIN says the API really does live at another origin.
const USE_DEV_PROXY = !process.env.VERCEL || Boolean(process.env.API_ORIGIN);

const nextConfig = {
  reactStrictMode: true,
  // Proxy API calls through the Next server so the browser always talks
  // same-origin. This avoids CORS failures ("Failed to fetch") when the app
  // is opened via 127.0.0.1, another port, or an https tunnel.
  async rewrites() {
    if (!USE_DEV_PROXY) return [];
    return [
      {
        source: "/api/:path*",
        destination: `${API_ORIGIN}/api/:path*`,
      },
    ];
  },
};
export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  // SSR so route handlers and server components read the backend env vars per request.
  reactStrictMode: true,
};

export default nextConfig;

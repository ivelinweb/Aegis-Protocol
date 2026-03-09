/** @type {import('next').NextConfig} */
const nextConfig = {
  // Optimize for Vercel deployment
  output: "standalone",
  // Suppress hydration warnings from wallet extensions injecting into DOM
  reactStrictMode: true,
};

export default nextConfig;

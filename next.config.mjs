/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // self-contained server build for containers (Cloud Run)
  output: 'standalone',
};

export default nextConfig;

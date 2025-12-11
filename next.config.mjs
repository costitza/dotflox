/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable TypeScript type-checking errors from failing the build
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;

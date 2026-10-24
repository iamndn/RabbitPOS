/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  eslint: {
    // Avoid slow linting steps during production builds
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Type check is strictly verified via tsc
    ignoreBuildErrors: false,
  },
  async rewrites() {
    // In Docker / Production, backend is reachable at http://rabbitpos-backend:8080, http://backend:8080 or via INTERNAL_API_URL / INTERNAL_BACKEND_URL.
    // In local development, defaults to http://127.0.0.1:8080 if not set.
    const backendUrl =
      process.env.INTERNAL_API_URL ||
      process.env.INTERNAL_BACKEND_URL ||
      (process.env.NODE_ENV === 'production' ? 'http://rabbitpos-backend:8080' : 'http://127.0.0.1:8080');

    return [
      {
        source: '/api/v1/:path*',
        destination: `${backendUrl}/api/v1/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${backendUrl}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;

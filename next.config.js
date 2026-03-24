// @ts-check
/** @type {import('next').NextConfig} */
const nextConfig = {
  // ✅ Allow ngrok domain for HMR in dev
  allowedDevOrigins: ['antoine-aposematic-carole.ngrok-free.dev'],

  typescript: {
    ignoreBuildErrors: true,
  },

  images: {
    unoptimized: process.env.NODE_ENV === "development",
    remotePatterns: [
      { 
        protocol: "https", 
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
  },

  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      config.devtool = false;
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
        ignored: [
          '**/node_modules/**',
          '**/.next/**',
          '**/public/**',
          '**/price_service/**',
        ],
      };
    }

    if (!isServer) {
      config.optimization = {
        ...config.optimization,
        moduleIds: 'named',
      };
    }

    return config;
  },

  experimental: {},

  // ✅ Skip ngrok browser warning for all visitors
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "ngrok-skip-browser-warning",
            value: "true",
          },
        ],
      },
    ];
  },

  async rewrites() {
    if (process.env.NODE_ENV === 'development') {
      return [
        {
          source: '/api/ml/predict',
          destination: 'http://127.0.0.1:8000/predict',
        },
        {
          source: '/api/ml/predict/batch',
          destination: 'http://127.0.0.1:8000/predict/batch',
        },
        {
          source: '/api/ml/health',
          destination: 'http://127.0.0.1:8000/health',
        },
      ];
    }
    return [];
  },
};

export default nextConfig;
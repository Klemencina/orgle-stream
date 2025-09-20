import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'pub-0f529cd7f5c3406786e738af6a74d65e.r2.dev',
        port: '',
        pathname: '/**',
      },
      // Allow images from your R2 bucket
      {
        protocol: 'https',
        hostname: process.env.R2_BUCKET_NAME ||
                  'your-bucket-name.r2.dev',
        port: '',
        pathname: '/**',
      },
      // Support for public bucket URLs
      {
        protocol: 'https',
        hostname: process.env.R2_PUBLIC_URL?.replace(/^https?:\/\//, '') ||
                  'your-public-bucket.r2.dev',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default withNextIntl(nextConfig);

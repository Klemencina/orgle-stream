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
      ...(process.env.R2_PUBLIC_URL ? [new URL(
        `${(process.env.R2_PUBLIC_URL.includes('://')
          ? process.env.R2_PUBLIC_URL
          : `https://${process.env.R2_PUBLIC_URL}`).replace(/\/+$/, '')}/**`
      )] : []),
    ],
  },
};

export default withNextIntl(nextConfig);

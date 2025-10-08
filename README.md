# Orgle Stream 🎼

A modern concert streaming platform built with Next.js that enables live and on-demand streaming of classical music concerts with multi-language support and comprehensive admin management

## ✨ Features

- **🎵 Concert Management**: Create, edit, and manage classical music concerts with detailed program information
- **🌍 Multi-language Support**: Full internationalization support with Slovenian and original language content
- **🎥 Live Streaming**: HLS-based video streaming using Amazon IVS (Interactive Video Service)
- **👥 Performer Profiles**: Rich performer information with photos and descriptions
- **📊 Admin Dashboard**: Comprehensive admin interface for content management
- **🔐 Role-based Access**: Secure authentication with Clerk and admin role management
- **☁️ Cloud Storage**: AWS S3 integration for media assets and Cloudflare R2 for images
- **📱 Responsive Design**: Mobile-first design with Tailwind CSS
- **🔍 SEO Optimized**: Server-side rendering with Next.js for optimal performance

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and pnpm
- PostgreSQL database
- Amazon IVS channel (for streaming)
- Clerk account (for authentication)
- Cloudflare R2 (for image storage)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd orgle-stream
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```

   Then edit `.env.local` with your actual values.

   Add the following variables to `.env.local`:
   ```env
   # Database
   DATABASE_URL="postgresql://username:password@localhost:5432/orgle_stream"

   # Authentication (Clerk)
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
   CLERK_SECRET_KEY=your_clerk_secret_key

   # Streaming (Amazon IVS)
   IVS_PLAYBACK_URL=https://your-channel.m3u8

   # Payments (Stripe)
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   NEXT_PUBLIC_APP_URL=http://localhost:3000

   # Cloud Storage (Cloudflare R2)
   R2_ACCOUNT_ID=your_r2_account_id
   R2_ACCESS_KEY_ID=your_r2_access_key_id
   R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
   R2_PUBLIC_URL=https://your-public-bucket.r2.dev
   ```

4. **Set up the database**
   ```bash
   pnpm prisma generate
   pnpm prisma db push
   ```

5. **Start the development server**
   ```bash
   pnpm dev
   ```

6. **Open [http://localhost:3000](http://localhost:3000)**

## 🏗️ Project Structure

```
src/
├── app/                 # Next.js app router
│   ├── admin/          # Admin dashboard
│   ├── api/            # API routes
│   │   ├── concerts/   # Concert management API
│   │   └── ...
│   ├── dashboard/      # User dashboard
│   └── ...
├── components/         # Reusable UI components
├── lib/               # Utility libraries
│   ├── db.ts         # Database connection
│   └── ...
├── middleware.ts      # Route protection
└── types/            # TypeScript type definitions
```

## 👨‍💼 Admin Setup

The application includes a comprehensive admin system. To set up admin users:

1. Visit `/admin-setup` for a visual setup guide
2. Use the [Clerk Dashboard](https://dashboard.clerk.com) to assign admin roles
3. Add `{"role": "admin"}` to the user's public metadata

For detailed instructions, see [ADMIN_SETUP.md](./ADMIN_SETUP.md).

## 🌐 Multi-language Support

The platform supports multiple languages with a focus on:
- **Slovenian (sl)**: Primary interface language
- **Original**: Content in the original language (composer names, titles, etc.)

All concerts include program information in both languages, ensuring accessibility for international audiences.

## 📡 API Documentation

### Concerts API

- `GET /api/concerts` - Retrieve concerts with localization support
- `POST /api/concerts` - Create new concerts (admin only)

### Query Parameters

- `locale` - Language preference (e.g., `sl`, `en`)
- `admin` - Include hidden concerts (admin only)

## 🚢 Deployment

### Vercel (Recommended)

1. **Connect your repository** to Vercel
2. **Set environment variables** in the Vercel dashboard
3. **Deploy automatically** on every push

### Environment Variables for Production

```env
DATABASE_URL=your_production_database_url
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
IVS_PLAYBACK_URL=https://your-production-channel.m3u8
R2_ACCOUNT_ID=your_r2_account_id
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_PUBLIC_URL=https://your-production-bucket.r2.dev
```

## 🛠️ Development

### Available Scripts

```bash
pnpm dev           # Start development server
pnpm build         # Build for production
pnpm start         # Start production server
pnpm lint          # Run ESLint
pnpm vercel-build  # Build for Vercel deployment
```

### Database Management

```bash
pnpm prisma studio   # Open database browser
pnpm prisma db push  # Push schema changes
pnpm prisma generate # Regenerate Prisma client
```

## 📚 Additional Resources

- [Admin Setup Guide](./ADMIN_SETUP.md) - Complete admin configuration
- [Cloudflare R2 Setup](./R2_SETUP.md) - Image storage configuration
- [Next.js Documentation](https://nextjs.org/docs) - Framework documentation
- [Prisma Documentation](https://www.prisma.io/docs) - Database toolkit
- [Clerk Documentation](https://docs.clerk.com) - Authentication service


# Cloudflare R2 Setup for Image Uploads

To enable image uploads for concert performers, you need to configure the following environment variables in your `.env.local` file:

## Required Environment Variables

Add these variables to your `.env.local` file using the R2_ naming convention:

### For Private/Custom Domain Bucket:
```bash
R2_ACCOUNT_ID=your_actual_account_id
R2_ACCESS_KEY_ID=your_actual_access_key_id
R2_SECRET_ACCESS_KEY=your_actual_secret_access_key
R2_BUCKET_NAME=your_actual_bucket_name
```

### For Public Bucket (like pub-xxxxx.r2.dev):
```bash
R2_ACCOUNT_ID=your_actual_account_id
R2_ACCESS_KEY_ID=your_actual_access_key_id
R2_SECRET_ACCESS_KEY=your_actual_secret_access_key
R2_PUBLIC_URL=https://pub-0f529cd7f5c3406786e738af6a74d65e.r2.dev
# No bucket name needed when using public URL
```

### For Mixed Setup (private upload, public serving):
```bash
R2_ACCOUNT_ID=your_actual_account_id
R2_ACCESS_KEY_ID=your_actual_access_key_id
R2_SECRET_ACCESS_KEY=your_actual_secret_access_key
R2_BUCKET_NAME=your_private_bucket_name
R2_PUBLIC_URL=https://pub-0f529cd7f5c3406786e738af6a74d65e.r2.dev
```

## Setup Steps

### For Public Bucket (like pub-xxxxx.r2.dev):

1. **If using public bucket URL:**
   - Add these variables to your `.env.local` file:
   ```bash
   R2_ACCOUNT_ID=your_account_id
   R2_ACCESS_KEY_ID=your_access_key_id
   R2_SECRET_ACCESS_KEY=your_secret_access_key
   R2_PUBLIC_URL=https://pub-0f529cd7f5c3406786e738af6a74d65e.r2.dev
   ```

2. **Test Configuration:**
   - Run `npm run build` to ensure there are no configuration errors
   - Start the development server with `npm run dev`
   - Try uploading an image through the admin interface at `/admin/concerts`

### For Private/Custom Domain Bucket:

1. **Create a Cloudflare R2 Bucket:**
   - Go to your Cloudflare Dashboard
   - Navigate to R2 Storage
   - Create a new bucket for storing concert performer images

2. **Get R2 Credentials:**
   - Go to Cloudflare Dashboard > R2 > API Tokens
   - Create an API token with R2 permissions for your bucket
   - Note down the Account ID, Access Key ID, and Secret Access Key

3. **Configure Environment Variables:**
   - Add the R2_ prefixed variables to your `.env.local` file
   - Replace the placeholder values with your actual credentials
   - Use `R2_BUCKET_NAME` for private buckets or `R2_PUBLIC_URL` for public buckets

## Environment Variables

The system only uses R2_ prefixed environment variables:

- **R2_ACCOUNT_ID**: Your Cloudflare account ID
- **R2_ACCESS_KEY_ID**: Your R2 API access key ID
- **R2_SECRET_ACCESS_KEY**: Your R2 API secret access key
- **R2_BUCKET_NAME**: Your R2 bucket name (for private buckets)
- **R2_PUBLIC_URL**: Your public bucket URL (for public buckets like pub-xxxxx.r2.dev)

### Quick Setup for Public Bucket

If you're using a public bucket like `pub-0f529cd7f5c3406786e738af6a74d65e.r2.dev`, add this to your `.env.local`:

```bash
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key_id
R2_SECRET_ACCESS_KEY=your_secret_access_key
R2_PUBLIC_URL=https://pub-0f529cd7f5c3406786e738af6a74d65e.r2.dev
```

## Security Notes

- Keep your R2 credentials secure and never commit them to version control
- The API token should have minimal permissions (only read/write access to your specific R2 bucket)
- Consider using Cloudflare R2's public bucket feature for serving images
- Images are stored in the `performers/` folder within your bucket

## Troubleshooting

If uploads fail, check:

1. **Environment variables are set correctly** in `.env.local`
2. **R2 bucket exists** and is accessible
3. **API token has correct permissions** for your bucket
4. **Account ID is correct** - it should be the ID shown in your Cloudflare dashboard URL
5. **Bucket name is correct** - it should match exactly what's in your R2 dashboard

import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

// Get R2 configuration from environment variables
const getR2Config = () => {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;
  const publicBucketUrl = process.env.R2_PUBLIC_URL;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('Missing R2 credentials. Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY environment variables.');
  }

  if (!bucketName && !publicBucketUrl) {
    throw new Error('Missing bucket configuration. Please set either R2_BUCKET_NAME or R2_PUBLIC_URL environment variable.');
  }

  return { accountId, accessKeyId, secretAccessKey, bucketName, publicBucketUrl };
};

let s3Client: S3Client | null = null;

const getS3Client = () => {
  if (!s3Client) {
    const config = getR2Config();

    // Determine the endpoint based on whether we have a public URL or traditional bucket
    let endpoint: string;
    if (config.publicBucketUrl) {
      // Extract account ID from public URL if needed
      // Public URLs are typically like: https://pub-xxxxxxxxxxxxx.r2.dev
      // We might need to construct the endpoint differently
      endpoint = `https://${config.accountId}.r2.cloudflarestorage.com`;
    } else {
      endpoint = `https://${config.accountId}.r2.cloudflarestorage.com`;
    }

    s3Client = new S3Client({
      region: 'auto',
      endpoint: endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }
  return s3Client;
};

export async function POST(request: NextRequest) {
  try {
    const config = getR2Config();
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type (only allow images)
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be less than 5MB' }, { status: 400 });
    }

    // Generate unique filename with timestamp and random string
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const fileExtension = file.name.split('.').pop();
    const fileName = `performers/${timestamp}-${randomString}.${fileExtension}`;

    // Convert file to buffer
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // Use bucket name for upload (required for S3 API)
    const uploadBucketName = config.bucketName || 'default-bucket';

    // Upload to R2
    const uploadCommand = new PutObjectCommand({
      Bucket: uploadBucketName,
      Key: fileName,
      Body: fileBuffer,
      ContentType: file.type,
      // Make the image publicly accessible
      ACL: 'public-read',
    });

    const s3Client = getS3Client();
    await s3Client.send(uploadCommand);

    // Generate public URL - use public URL if provided, otherwise construct from bucket name
    let publicUrl: string;
    if (config.publicBucketUrl) {
      // Remove protocol from public URL if present
      const cleanPublicUrl = config.publicBucketUrl.replace(/^https?:\/\//, '');
      publicUrl = `https://${cleanPublicUrl}/${fileName}`;
    } else if (config.bucketName) {
      publicUrl = `https://${config.bucketName}.r2.dev/${fileName}`;
    } else {
      throw new Error('Unable to generate public URL: no bucket name or public URL configured');
    }

    return NextResponse.json({
      url: publicUrl,
      fileName: fileName,
      fileSize: file.size,
      fileType: file.type
    });

  } catch (error) {
    console.error('Upload error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to upload file';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const config = getR2Config();
    const url = new URL(request.url);
    const fileName = url.searchParams.get('fileName');

    if (!fileName) {
      return NextResponse.json({ error: 'No fileName provided' }, { status: 400 });
    }

    const s3Client = getS3Client();

    // Use bucket name for delete (required for S3 API)
    const deleteBucketName = config.bucketName || 'default-bucket';

    // Delete from R2
    const deleteCommand = new DeleteObjectCommand({
      Bucket: deleteBucketName,
      Key: fileName,
    });

    await s3Client.send(deleteCommand);

    return NextResponse.json({
      message: 'File deleted successfully',
      fileName: fileName
    });

  } catch (error) {
    console.error('Delete error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete file';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// Handle unsupported methods
export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function PUT() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
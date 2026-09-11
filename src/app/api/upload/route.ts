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

  if (!bucketName) {
    throw new Error('Missing R2_BUCKET_NAME. Set the bucket name used by the R2 S3 API.');
  }

  if (!publicBucketUrl) {
    throw new Error('Missing R2_PUBLIC_URL. Set the public development URL or custom domain for this bucket.');
  }

  const publicUrl = new URL(publicBucketUrl.includes('://') ? publicBucketUrl : `https://${publicBucketUrl}`);
  if (!['http:', 'https:'].includes(publicUrl.protocol) || publicUrl.username || publicUrl.password || publicUrl.search || publicUrl.hash) {
    throw new Error('R2_PUBLIC_URL must be an HTTP or HTTPS URL without credentials, query parameters, or a fragment.');
  }

  return { accountId, accessKeyId, secretAccessKey, bucketName, publicBucketUrl: publicUrl.href.replace(/\/+$/, '') };
};

let s3Client: S3Client | null = null;

const getS3Client = () => {
  if (!s3Client) {
    const config = getR2Config();

    s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }
  return s3Client;
};

function getStorageErrorMessage(error: unknown, fallback: string) {
  const storageError = error as { $metadata?: { httpStatusCode?: number } } | null;
  const status = storageError?.$metadata?.httpStatusCode;
  if (status === 401 || status === 403) {
    return 'Image storage rejected access. Check the R2 S3 credentials and Object Read & Write permission for R2_BUCKET_NAME.';
  }
  return error instanceof Error ? error.message : fallback;
}

export async function POST(request: NextRequest) {
  try {
    const config = getR2Config();
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
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

    // Upload to R2
    const uploadCommand = new PutObjectCommand({
      Bucket: config.bucketName,
      Key: fileName,
      Body: fileBuffer,
      ContentType: file.type,
    });

    const s3Client = getS3Client();
    await s3Client.send(uploadCommand);

    const publicUrl = `${config.publicBucketUrl}/${fileName}`;

    return NextResponse.json({
      url: publicUrl,
      fileName: fileName,
      fileSize: file.size,
      fileType: file.type
    });

  } catch (error) {
    console.error('Upload error:', error);
    const errorMessage = getStorageErrorMessage(error, 'Failed to upload file');
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

    // Delete from R2
    const deleteCommand = new DeleteObjectCommand({
      Bucket: config.bucketName,
      Key: fileName,
    });

    await s3Client.send(deleteCommand);

    return NextResponse.json({
      message: 'File deleted successfully',
      fileName: fileName
    });

  } catch (error) {
    console.error('Delete error:', error);
    const errorMessage = getStorageErrorMessage(error, 'Failed to delete file');
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
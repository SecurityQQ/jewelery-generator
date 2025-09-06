"use server";

import { S3 } from "aws-sdk";
import { Readable } from "node:stream";

// At the top, check for required environment variables
if (!process.env.R2_ACCOUNT_ID) {
  console.error("Missing R2_ACCOUNT_ID environment variable");
  throw new Error("R2_ACCOUNT_ID is not configured");
}

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const ACCESS_KEY_ID = process.env.S3_ACCESS_KEY || "";
const SECRET_ACCESS_KEY = process.env.S3_SECRET_KEY || "";
const BUCKET_NAME = process.env.R2_BUCKET_NAME;
const PUBLIC_URL = process.env.R2_PUBLIC_URL;

// Log configuration status (without sensitive data)
console.log('[S3 Config]', {
  accountConfigured: !!ACCOUNT_ID,
  accessKeyConfigured: !!ACCESS_KEY_ID,
  secretKeyConfigured: !!SECRET_ACCESS_KEY,
  bucketConfigured: !!BUCKET_NAME,
  publicUrlConfigured: !!PUBLIC_URL
});

// Initialize S3 client with the correct endpoint
const s3Client = new S3({
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  accessKeyId: ACCESS_KEY_ID,
  secretAccessKey: SECRET_ACCESS_KEY,
  signatureVersion: 'v4',
  region: 'auto',
  s3ForcePathStyle: true // Important for R2
});

interface S3Error extends Error {
  cause?: unknown;
  response?: any;
}

// Helper function to determine file extension from content type
function getExtensionFromContentType(contentType: string): string {
  const typeMap: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg', 
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/bmp': '.bmp',
    'image/tiff': '.tiff',
    'image/svg+xml': '.svg',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'video/avi': '.avi',
    'video/mov': '.mov',
    'text/plain': '.txt',
    'application/pdf': '.pdf',
    'application/json': '.json'
  };
  
  return typeMap[contentType.toLowerCase()] || '';
}

export async function uploadToS3(
  input: string | Buffer | Readable,
  options: { folder?: string; contentType?: string } = {}
): Promise<string> {
  const { folder = "default", contentType = "image/jpeg" } = options;

  try {
    let buffer: Buffer;

    if (typeof input === "string" && input.startsWith("http")) {
      const response = await fetch(input);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      }
      buffer = Buffer.from(await response.arrayBuffer());
    } else if (Buffer.isBuffer(input)) {
      buffer = input;
    } else if (input instanceof Readable) {
      const chunks: Buffer[] = [];
      for await (const chunk of input) {
        chunks.push(chunk);
      }
      buffer = Buffer.concat(chunks);
    } else {
      throw new Error("Unsupported input type. Must be a valid URL, Buffer, or stream.");
    }

    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const extension = getExtensionFromContentType(contentType);
    const filename = `${timestamp}-${randomString}${extension}`;
    const key = folder ? `${folder}/${filename}` : filename;

    console.log('[S3] Uploading to bucket:', {
      bucket: BUCKET_NAME,
      key: key,
      bufferSize: buffer.length,
      contentType: contentType
    });

    const uploadResult = await s3Client.upload({
      Bucket: BUCKET_NAME || "",
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }).promise();

    if (!uploadResult || !uploadResult.Location) {
      throw new Error('S3 upload did not return a location');
    }

    const publicUrl = `${PUBLIC_URL}/${key}`;
    console.log('[S3] Upload successful:', {
      s3Location: uploadResult.Location,
      publicUrl: publicUrl
    });

    return publicUrl;

  } catch (error) {
    console.error('[S3] Upload error details:', error);
    throw new Error(`S3 upload failed: ${(error as Error).message}`);
  }
}

// Optional: Generate a pre-signed URL for direct uploads
export async function generatePresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 3600
): Promise<string> {
  const params = {
    Bucket: BUCKET_NAME || "",
    Key: key,
    Expires: expiresIn,
    ContentType: contentType,
  };

  return await s3Client.getSignedUrlPromise('putObject', params);
}

// Optional: Generate a pre-signed URL for downloading
export async function generatePresignedDownloadUrl(
  key: string,
  expiresIn = 3600
): Promise<string> {
  const params = {
    Bucket: BUCKET_NAME,
    Key: key,
    Expires: expiresIn,
  };

  return await s3Client.getSignedUrlPromise('getObject', params);
}

// Add this new function
export async function deleteFromS3(key: string): Promise<void> {
  try {
    const params = {
      Bucket: BUCKET_NAME || "",
      Key: key,
    };

    await s3Client.deleteObject(params).promise();
  } catch (error) {
    const s3Error = error as S3Error;
    console.error("Failed to delete from S3:", s3Error);
    throw new Error(`S3 deletion failed: ${s3Error.message}`);
  }
} 
"use server"

import { uploadToS3 as uploadToS3Lib } from "./s3";

interface UploadOptions {
  folder?: string;
  contentType?: string;
}

// Get PUBLIC_URL from environment (same as in s3.ts)
const PUBLIC_URL = process.env.R2_PUBLIC_URL!;

export async function uploadToS3(input: string | Buffer | File, options: UploadOptions = {}) {
  console.time('[Server] S3 upload time');
  
  try {
    // If input is already a PUBLIC_URL, return it as-is
    if (typeof input === 'string' && input.includes(PUBLIC_URL)) {
      console.timeEnd('[Server] S3 upload time');
      return input;
    }

    let buffer: Buffer;
    let detectedContentType = options.contentType;

    // Handle File objects from form uploads
    if (input instanceof File) {
      const bytes = await input.arrayBuffer();
      buffer = Buffer.from(bytes);
      // Use File's type if no contentType was provided
      if (!detectedContentType && input.type) {
        detectedContentType = input.type;
      }
    } 
    // Handle Buffer directly
    else if (Buffer.isBuffer(input)) {
      buffer = input;
    }
    // Handle strings (URLs or data URLs)
    else if (typeof input === 'string') {
      if (input.startsWith('data:')) {
        // Handle base64 data URLs - convert to buffer
        const base64Data = input.split(',')[1];
        buffer = Buffer.from(base64Data, 'base64');
        
        // Extract contentType from data URL if not provided
        if (!detectedContentType) {
          const dataUrlMatch = input.match(/^data:([^;]+)/);
          if (dataUrlMatch) {
            detectedContentType = dataUrlMatch[1];
          }
        }
      } else if (input.startsWith('http')) {
        // Pass HTTP URLs directly to S3 lib with enhanced options
        const enhancedOptions = { ...options };
        if (detectedContentType) {
          enhancedOptions.contentType = detectedContentType;
        }
        const result = await uploadToS3Lib(input, enhancedOptions);
        console.timeEnd('[Server] S3 upload time');
        return result;
      } else {
        throw new Error('Invalid string input. Must be a data URL or HTTP URL');
      }
    } else {
      throw new Error(`Invalid input type. Must be File, Buffer, or string; Got: ${typeof input} ${input}`);
    }

    // Upload the buffer to S3 with detected content type
    const enhancedOptions = { ...options };
    if (detectedContentType) {
      enhancedOptions.contentType = detectedContentType;
    }
    
    console.log('[Server] Uploading buffer to S3...', {
      bufferSize: buffer.length,
      contentType: enhancedOptions.contentType,
      folder: enhancedOptions.folder
    });
    
    const result = await uploadToS3Lib(buffer, enhancedOptions);
    
    if (!result) {
      throw new Error('S3 upload returned no URL');
    }
    
    console.log('[Server] S3 upload successful:', result);
    console.timeEnd('[Server] S3 upload time');
    return result;

  } catch (error) {
    console.timeEnd('[Server] S3 upload time');
    console.error('[Server] S3 upload error:', error);
    throw error;
  }
} 
import { NextRequest, NextResponse } from 'next/server';
import { uploadToS3 } from '../../lib/uploadToS3';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Upload the image to S3
    console.log('Uploading image to S3...', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type
    });
    
    const uploadedImageUrl = await uploadToS3(file, {
      folder: 'uploads',
      contentType: file.type
    });
    
    console.log('Upload successful:', uploadedImageUrl);

    return NextResponse.json({ 
      success: true,
      message: 'Image uploaded successfully',
      data: {
        url: uploadedImageUrl,
        imageUrl: uploadedImageUrl // Keep for backward compatibility
      }
    });
  } catch (error) {
    console.error('Error in upload route:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to upload file'
      },
      { status: 500 }
    );
  }
}

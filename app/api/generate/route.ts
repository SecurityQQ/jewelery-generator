import { NextRequest, NextResponse } from 'next/server';
import { uploadToS3 } from '../../lib/uploadToS3';
import { runGemini } from '../../lib/generate_image';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, urls, references, type } = body;
    
    if (!prompt) {
      return NextResponse.json(
        { success: false, error: 'No prompt provided' },
        { status: 400 }
      );
    }

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No URLs provided' },
        { status: 400 }
      );
    }

    // Combine main images with references if provided
    const allImages = references && Array.isArray(references) 
      ? [...urls, ...references]
      : urls;

    // Customize prompt based on generation type
    let enhancedPrompt = prompt;
    if (type === 'background') {
      enhancedPrompt = `${prompt}. Extract color palette and create elegant, abstract background suitable for jewelry photography.`;
    } else if (type === 'studio') {
      enhancedPrompt = `${prompt}. Professional product photography with perfect lighting and shadows.`;
    } else if (type === 'model') {
      enhancedPrompt = `${prompt}. Fashion photography style with focus on jewelry details and anchor points.`;
    }

    // Process with Gemini
    console.log(`Processing ${type || 'standard'} generation with Gemini...`);
    const processedImageDataUrl = await runGemini({
      prompt: enhancedPrompt,
      images: allImages
    });

    // Upload the processed image to S3
    console.log('Uploading processed image to S3...');
    const folder = type ? `processed/${type}` : 'processed';
    const processedImageUrl = await uploadToS3(processedImageDataUrl, {
      folder,
      contentType: 'image/png'
    });

    return NextResponse.json({ 
      success: true,
      message: 'Image processed successfully',
      data: {
        processedImage: processedImageUrl,
        type: type || 'standard'
      }
    });
  } catch (error) {
    console.error('Error in generate route:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to process request'
      },
      { status: 500 }
    );
  }
}
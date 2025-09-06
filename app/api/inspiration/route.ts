import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

interface ImageItem {
  src: string;
  category: string;
  filename: string;
}

export async function GET() {
  try {
    const publicDir = path.join(process.cwd(), 'public');
    const categories = fs.readdirSync(publicDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name)
      .filter(name => !name.startsWith('.') && name !== 'node_modules');

    const images: ImageItem[] = [];

    for (const category of categories) {
      const categoryPath = path.join(publicDir, category);
      
      try {
        const files = fs.readdirSync(categoryPath);
        const imageFiles = files.filter(file => {
          const ext = path.extname(file).toLowerCase();
          return ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext);
        });

        // Limit to first 20 images per category for performance
        const limitedFiles = imageFiles.slice(0, 20);

        for (const file of limitedFiles) {
          images.push({
            src: `/${category}/${file}`,
            category: category.replace(/\+/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            filename: file
          });
        }
      } catch (error) {
        console.error(`Error reading category ${category}:`, error);
        continue;
      }
    }

    // Shuffle images for variety
    const shuffledImages = images.sort(() => Math.random() - 0.5);

    return NextResponse.json({
      success: true,
      data: {
        images: shuffledImages,
        totalCategories: categories.length,
        totalImages: images.length
      }
    });

  } catch (error) {
    console.error('Error reading inspiration images:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to load inspiration images',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

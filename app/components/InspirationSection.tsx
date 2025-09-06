'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

interface ImageItem {
  src: string;
  category: string;
  filename: string;
}

interface InspirationData {
  images: ImageItem[];
  totalCategories: number;
  totalImages: number;
}

export default function InspirationSection() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    fetchImages();
  }, []);

  const fetchImages = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/inspiration');
      const data = await response.json();

      if (data.success) {
        console.log('Loaded images:', data.data.images.slice(0, 3)); // Debug: show first 3 images
        setImages(data.data.images);
        
        // Extract unique categories
        const uniqueCategories = Array.from(
          new Set(data.data.images.map((img: ImageItem) => img.category))
        ).sort() as string[];
        setCategories(['All', ...uniqueCategories]);
        
        setError(null);
      } else {
        console.error('API Error:', data.error);
        setError(data.error || 'Failed to load images');
      }
    } catch (err) {
      setError('Network error occurred');
      console.error('Error fetching images:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredImages = selectedCategory === 'all' || selectedCategory === 'All'
    ? images
    : images.filter(img => img.category === selectedCategory);

  const handleImageClick = (imageSrc: string) => {
    // Open image in new tab
    window.open(imageSrc, '_blank');
  };

  if (isLoading) {
    return (
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              ✨ Get Inspired
            </h2>
            <p className="text-lg text-gray-600">
              Browse our collection of jewelry photography inspiration
            </p>
          </div>
          
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              ✨ Get Inspired
            </h2>
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md mx-auto">
              <p className="text-red-800">{error}</p>
              <button
                onClick={fetchImages}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            ✨ Get Inspired
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            Browse our collection of jewelry photography inspiration
          </p>
          
          {/* Category Filter */}
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  selectedCategory === category || (selectedCategory === 'all' && category === 'All')
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {filteredImages.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">No images found for the selected category.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {filteredImages.map((image, index) => (
                <div
                  key={`${image.category}-${image.filename}-${index}`}
                  className="group relative aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:shadow-lg transition-all duration-300 hover:scale-105"
                  onClick={() => handleImageClick(image.src)}
                >
                  <Image
                    src={image.src}
                    alt={`${image.category} inspiration`}
                    fill
                    className="object-cover group-hover:scale-110 transition-transform duration-300"
                    sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 16vw"
                    loading="lazy"
                    unoptimized={true}
                  />
                  
                  {/* Overlay */}
                  <div className="absolute inset-0 bg-black/30 group-hover:bg-opacity-30 transition-all duration-300 flex items-center justify-center">
                    <div className="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <svg
                        className="w-8 h-8"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>
                    </div>
                  </div>
                  
                  {/* Category Badge */}
                  <div className="absolute top-2 left-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    {image.category}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="text-center mt-12">
              <p className="text-gray-600">
                Showing {filteredImages.length} images
                {selectedCategory !== 'all' && selectedCategory !== 'All' && (
                  <span> in {selectedCategory}</span>
                )}
              </p>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

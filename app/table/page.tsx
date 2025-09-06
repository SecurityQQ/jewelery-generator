'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';
import { Upload, X, Loader2, Sparkles, Image as ImageIcon, Link2, Copy, Check, Globe } from 'lucide-react';

interface UploadedFile {
  id: string;
  file: File;
  previewUrl: string;
  type: 'image' | 'reference';
}

interface GenerationResult {
  backgroundAssets: string[];
  objectResults: {
    studioView: string;
    modelShots: {
      type: 'ear' | 'neck' | 'wrist';
      images: string[];
    }[];
  }[];
}

interface GenerationProgress {
  stage: string;
  currentStep: number;
  totalSteps: number;
  message: string;
}

export default function TablePage() {
  const [images, setImages] = useState<UploadedFile[]>([]);
  const [references, setReferences] = useState<UploadedFile[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [results, setResults] = useState<GenerationResult>({
    backgroundAssets: [],
    objectResults: []
  });
  const [progress, setProgress] = useState<GenerationProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [dragActive, setDragActive] = useState<{ images: boolean; references: boolean }>({
    images: false,
    references: false
  });

  const handleDrag = useCallback((e: React.DragEvent, type: 'images' | 'references') => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(prev => ({ ...prev, [type]: true }));
    } else if (e.type === "dragleave") {
      setDragActive(prev => ({ ...prev, [type]: false }));
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, type: 'image' | 'reference') => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive({ images: false, references: false });
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files, type);
    }
  }, []);

  const handleFiles = (files: FileList, type: 'image' | 'reference') => {
    const newFiles: UploadedFile[] = [];
    
    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) {
        const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const previewUrl = URL.createObjectURL(file);
        newFiles.push({ id, file, previewUrl, type });
      }
    });

    if (type === 'image') {
      setImages(prev => [...prev, ...newFiles]);
    } else {
      setReferences(prev => [...prev, ...newFiles]);
    }
    setError(null);
    setResults({ backgroundAssets: [], objectResults: [] });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'reference') => {
    if (e.target.files) {
      handleFiles(e.target.files, type);
    }
  };

  const removeFile = (id: string, type: 'image' | 'reference') => {
    if (type === 'image') {
      setImages(prev => {
        const file = prev.find(f => f.id === id);
        if (file) URL.revokeObjectURL(file.previewUrl);
        return prev.filter(f => f.id !== id);
      });
    } else {
      setReferences(prev => {
        const file = prev.find(f => f.id === id);
        if (file) URL.revokeObjectURL(file.previewUrl);
        return prev.filter(f => f.id !== id);
      });
    }
  };

  const uploadFiles = async (files: UploadedFile[]) => {
    const uploadPromises = files.map(async (uploadedFile) => {
      const formData = new FormData();
      formData.append('file', uploadedFile.file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to upload ${uploadedFile.file.name}: ${errorText}`);
      }

      const data = await response.json();
      if (!data.success || !data.data?.url) {
        throw new Error(`Invalid upload response for ${uploadedFile.file.name}: ${data.error || 'No URL returned'}`);
      }
      
      return data.data.url;
    });

    return Promise.all(uploadPromises);
  };

  const handleGenerate = async () => {
    if (images.length === 0) {
      setError('Please upload at least one image');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setResults({ backgroundAssets: [], objectResults: [] });
    
    // Calculate total steps for progress tracking
    const totalSteps = 1 + 5 + (images.length * 10); // upload + 5 backgrounds + (objects * (1 studio + 9 model shots))
    let completedSteps = 0;

    const updateProgress = (stage: string, message: string, increment: number = 1) => {
      completedSteps += increment;
      setProgress({
        stage,
        currentStep: completedSteps,
        totalSteps,
        message
      });
    };

    try {
      // Upload all files
      updateProgress('Uploading', 'Uploading your jewelry images and references to cloud storage...', 0);
      
      const [imageUrls, referenceUrls] = await Promise.all([
        uploadFiles(images),
        uploadFiles(references)
      ]);
      
      updateProgress('Preparing', 'Files uploaded successfully! Analyzing jewelry for AI generation...');

      // Generate background assets in parallel based on analysis
      updateProgress('Background Analysis', 'AI is analyzing your jewelry to suggest perfect backgrounds...');
      
      const backgroundPrompts = [
        'Luxurious velvet texture in deep jewel tones, soft focus, elegant backdrop for high-end jewelry photography',
        'Minimalist marble surface with subtle gold veining, clean aesthetic, perfect for modern jewelry presentation',
        'Soft gradient sunset colors transitioning from rose gold to champagne, dreamy atmosphere for romantic jewelry',
        'Abstract geometric patterns with metallic accents, contemporary design suitable for statement jewelry pieces',
        'Natural silk fabric with gentle folds and highlights, sophisticated texture for classic jewelry photography'
      ];

      // Generate all backgrounds in parallel
      const backgroundPromises = backgroundPrompts.map(async (prompt, i) => {
        try {
          const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: `${prompt}. Analyze the jewelry style from references and create a complementary background. No jewelry in the image, only background.`,
              urls: referenceUrls.length > 0 ? referenceUrls : imageUrls.slice(0, 1), // Use references or first image for style analysis
              type: 'background'
            })
          });

          if (!response.ok) {
            throw new Error(`Failed to generate background ${i + 1}: ${response.statusText}`);
          }

          const data = await response.json();
          if (!data.success || !data.data?.processedImage) {
            throw new Error(`Invalid response for background ${i + 1}: ${data.error || 'No processed image'}`);
          }

          // Update progress and results as each background completes
          updateProgress('Backgrounds', `Background ${i + 1} of 5 created successfully!`);
          setResults(prev => ({
            ...prev,
            backgroundAssets: [...prev.backgroundAssets, data.data.processedImage]
          }));

          return data.data.processedImage;
        } catch (error) {
          console.error(`Background ${i + 1} generation failed:`, error);
          return null;
        }
      });

      const backgroundAssets = (await Promise.all(backgroundPromises)).filter(url => url !== null) as string[];

      // Process all objects in parallel
      updateProgress('Object Processing', 'Starting parallel generation for all jewelry pieces...');
      
      const objectPromises = imageUrls.map(async (imageUrl, objIndex) => {
        const objectResult: GenerationResult['objectResults'][0] = {
          studioView: '',
          modelShots: []
        };

        try {
          // Generate studio view and all model shots in parallel for this object
          const studioPromise = fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: 'Transform jewelry to studio photography: clean white background, professional shadows, elegant highlights, product photography style',
              urls: [imageUrl],
              references: backgroundAssets.slice(0, 2), // Use generated backgrounds as references
              type: 'studio'
            })
          }).then(async res => {
            if (!res.ok) throw new Error(`Studio generation failed: ${res.statusText}`);
            const data = await res.json();
            if (!data.success || !data.data?.processedImage) {
              throw new Error(`Invalid studio response: ${data.error || 'No processed image'}`);
            }
            objectResult.studioView = data.data.processedImage;
            updateProgress('Studio Photography', `Studio shot for piece ${objIndex + 1} completed!`);
            
            // Update results immediately
            setResults(prev => {
              const newResults = [...prev.objectResults];
              newResults[objIndex] = { ...objectResult };
              return { ...prev, objectResults: newResults };
            });
            
            return data.data.processedImage;
          });

          // Model shots configuration
          const modelTypes = [
            { type: 'ear' as const, prompt: 'Show earring on model ear, close-up shot focusing on earlobe, elegant pose' },
            { type: 'neck' as const, prompt: 'Show necklace on model neck, close-up shot focusing on collarbone line, elegant pose' },
            { type: 'wrist' as const, prompt: 'Show bracelet/ring on model hand, close-up shot focusing on wrist/finger joint, elegant pose' }
          ];

          // Generate all model shots in parallel
          const modelPromises = modelTypes.map(async ({ type, prompt }) => {
            const shotPromises = Array.from({ length: 3 }, async (_, shotIndex) => {
              try {
                const response = await fetch('/api/generate', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    prompt: `${prompt}. Use elegant lighting and professional photography style.`,
                    urls: [imageUrl],
                    references: [...backgroundAssets.slice(0, 2), ...referenceUrls],
                    type: 'model'
                  })
                });

                if (!response.ok) throw new Error(`Model shot failed: ${response.statusText}`);
                const data = await response.json();
                if (!data.success || !data.data?.processedImage) {
                  throw new Error(`Invalid model response: ${data.error || 'No processed image'}`);
                }

                updateProgress('Model Photography', `${type} shot ${shotIndex + 1} for piece ${objIndex + 1} completed!`);
                return data.data.processedImage;
              } catch (error) {
                console.error(`Failed to generate ${type} shot ${shotIndex + 1}:`, error);
                return null;
              }
            });

            const images = (await Promise.all(shotPromises)).filter(url => url !== null) as string[];
            
            if (images.length > 0) {
              const modelShot = { type, images };
              
              // Update results immediately as each type completes
              setResults(prev => {
                const newResults = [...prev.objectResults];
                if (!newResults[objIndex]) {
                  newResults[objIndex] = { studioView: '', modelShots: [] };
                }
                const existingTypeIndex = newResults[objIndex].modelShots.findIndex(ms => ms.type === type);
                if (existingTypeIndex >= 0) {
                  newResults[objIndex].modelShots[existingTypeIndex] = modelShot;
                } else {
                  newResults[objIndex].modelShots.push(modelShot);
                }
                return { ...prev, objectResults: newResults };
              });
              
              return modelShot;
            }
            return null;
          });

          // Wait for all generation for this object
          const [studioView, ...modelResults] = await Promise.all([studioPromise, ...modelPromises]);
          
          objectResult.studioView = studioView;
          objectResult.modelShots = modelResults.filter(ms => ms !== null) as GenerationResult['objectResults'][0]['modelShots'];
          
          return objectResult;
        } catch (error) {
          console.error(`Failed to process object ${objIndex + 1}:`, error);
          return null;
        }
      });

      const objectResults = (await Promise.all(objectPromises)).filter(result => result !== null) as GenerationResult['objectResults'];
      
      // Final update with all results
      setResults({
        backgroundAssets,
        objectResults
      });

      updateProgress('Complete', '🎉 All images generated successfully! You can now download your jewelry photos.', 0);

      // Clear progress after a delay
      setTimeout(() => {
        setProgress(null);
      }, 3000);

    } catch (err) {
      console.error('Generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate images');
      setProgress(null);
    } finally {
      setIsGenerating(false);
    }
  };

  const copyEcommercePrompt = () => {
    const allUrls = [
      ...results.backgroundAssets,
      ...results.objectResults.map(obj => obj.studioView),
      ...results.objectResults.flatMap(obj => obj.modelShots.flatMap(ms => ms.images))
    ].filter(url => url);

    const prompt = `Create a modern e-commerce website for luxury jewelry with the following product images:

BACKGROUND ASSETS (${results.backgroundAssets.length} images):
${results.backgroundAssets.map((url, i) => `${i + 1}. ${url}`).join('\n')}

PRODUCT CATALOG (${results.objectResults.length} jewelry pieces):
${results.objectResults.map((obj, i) => {
  const earShots = obj.modelShots.find(ms => ms.type === 'ear')?.images || [];
  const neckShots = obj.modelShots.find(ms => ms.type === 'neck')?.images || [];
  const wristShots = obj.modelShots.find(ms => ms.type === 'wrist')?.images || [];
  
  return `
JEWELRY PIECE ${i + 1}:
Studio Photography:
- ${obj.studioView}

Model Shots - Ear (${earShots.length} images):
${earShots.map((url, j) => `- ${url}`).join('\n')}

Model Shots - Neck (${neckShots.length} images):
${neckShots.map((url, j) => `- ${url}`).join('\n')}

Model Shots - Wrist/Ring (${wristShots.length} images):
${wristShots.map((url, j) => `- ${url}`).join('\n')}`;
}).join('\n')}

WEBSITE REQUIREMENTS:
1. Homepage:
   - Hero section with rotating background assets
   - Featured products carousel
   - Category navigation (Earrings, Necklaces, Bracelets/Rings)
   - Testimonials section

2. Product Gallery:
   - Grid layout with studio shots as primary images
   - Quick view functionality
   - Filter by category and price range
   - Sort options (newest, price, popularity)

3. Product Details Page:
   - Image gallery with zoom functionality
   - Studio shot as main image
   - Model shots in thumbnail carousel
   - Size guide and material information
   - Related products section

4. Shopping Features:
   - Add to cart with size selection
   - Wishlist functionality
   - Shopping cart with quantity adjustment
   - Secure checkout process
   - Guest checkout option

5. Design Guidelines:
   - Color scheme: Elegant neutrals with gold accents
   - Typography: Modern serif for headings, clean sans-serif for body
   - Use background assets for:
     * Hero sections
     * Category headers
     * Newsletter signup backgrounds
     * Loading screens
   - Responsive design for all devices
   - Smooth animations and transitions
   - High-end, luxurious aesthetic

6. Additional Features:
   - Search functionality
   - Customer reviews and ratings
   - Size and care guides
   - Newsletter signup
   - Social media integration
   - Contact form for custom orders

TOTAL ASSETS: ${allUrls.length} images
- Background Assets: ${results.backgroundAssets.length}
- Studio Shots: ${results.objectResults.length}
- Model Shots: ${results.objectResults.reduce((acc, obj) => 
    acc + obj.modelShots.reduce((sum, ms) => sum + ms.images.length, 0), 0)}

Note: All images are high-quality, professionally generated, and ready for immediate use in the e-commerce platform.`;

    navigator.clipboard.writeText(prompt).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 3000);
    }).catch(err => {
      console.error('Failed to copy:', err);
      setError('Failed to copy to clipboard');
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-8 text-center">
          Jewelry Image Generator
        </h1>

        {/* Upload Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Images Upload */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center mb-4">
              <ImageIcon className="w-6 h-6 mr-2 text-blue-600" />
              <h2 className="text-2xl font-semibold text-gray-800">Images</h2>
              <span className="ml-auto text-sm text-gray-500">{images.length} uploaded</span>
            </div>
            
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive.images ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragEnter={(e) => handleDrag(e, 'images')}
              onDragLeave={(e) => handleDrag(e, 'images')}
              onDragOver={(e) => handleDrag(e, 'images')}
              onDrop={(e) => handleDrop(e, 'image')}
            >
              <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600 mb-2">Drag & drop jewelry images here</p>
              <p className="text-sm text-gray-500 mb-4">or</p>
              <label className="cursor-pointer">
                <span className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  Browse Files
                </span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => handleFileSelect(e, 'image')}
                  className="hidden"
                />
              </label>
            </div>

            {/* Image Previews */}
            {images.length > 0 && (
              <div className="grid grid-cols-3 gap-3 mt-4">
                {images.map((file) => (
                  <div key={file.id} className="relative group">
                    <Image
                      src={file.previewUrl}
                      alt={file.file.name}
                      width={100}
                      height={100}
                      className="w-full h-24 object-cover rounded-lg"
                    />
                    <button
                      onClick={() => removeFile(file.id, 'image')}
                      className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* References Upload */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center mb-4">
              <Link2 className="w-6 h-6 mr-2 text-purple-600" />
              <h2 className="text-2xl font-semibold text-gray-800">References</h2>
              <span className="ml-auto text-sm text-gray-500">{references.length} uploaded</span>
            </div>
            
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive.references ? 'border-purple-500 bg-purple-50' : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragEnter={(e) => handleDrag(e, 'references')}
              onDragLeave={(e) => handleDrag(e, 'references')}
              onDragOver={(e) => handleDrag(e, 'references')}
              onDrop={(e) => handleDrop(e, 'reference')}
            >
              <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600 mb-2">Drag & drop reference images here</p>
              <p className="text-sm text-gray-500 mb-4">or</p>
              <label className="cursor-pointer">
                <span className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                  Browse Files
                </span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => handleFileSelect(e, 'reference')}
                  className="hidden"
                />
              </label>
            </div>

            {/* Reference Previews */}
            {references.length > 0 && (
              <div className="grid grid-cols-3 gap-3 mt-4">
                {references.map((file) => (
                  <div key={file.id} className="relative group">
                    <Image
                      src={file.previewUrl}
                      alt={file.file.name}
                      width={100}
                      height={100}
                      className="w-full h-24 object-cover rounded-lg"
                    />
                    <button
                      onClick={() => removeFile(file.id, 'reference')}
                      className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Generate Button */}
        <div className="text-center mb-8">
          <button
            onClick={handleGenerate}
            disabled={isGenerating || images.length === 0}
            className={`px-8 py-4 rounded-lg font-semibold text-lg transition-all transform hover:scale-105 ${
              isGenerating || images.length === 0
                ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 shadow-lg'
            }`}
          >
            {isGenerating ? (
              <span className="flex items-center">
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Generating...
              </span>
            ) : (
              <span className="flex items-center">
                <Sparkles className="w-5 h-5 mr-2" />
                Generate Images
              </span>
            )}
          </button>
        </div>

        {/* Progress Display */}
        {progress && (
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6 mb-8 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <Loader2 className="w-6 h-6 mr-3 animate-spin text-blue-600" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">{progress.stage}</h3>
                  <p className="text-sm text-gray-600">{progress.message}</p>
                </div>
              </div>
              <span className="text-sm font-medium text-gray-700">
                {progress.currentStep} / {progress.totalSteps}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${(progress.currentStep / progress.totalSteps) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Results Display */}
        {(results.backgroundAssets.length > 0 || results.objectResults.length > 0) && (
          <div className="space-y-8">
            {/* Background Assets */}
            {results.backgroundAssets.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-2xl font-semibold text-gray-800 mb-4">
                  Background Assets {isGenerating && `(${results.backgroundAssets.length}/5)`}
                </h3>
                <div className="grid grid-cols-5 gap-4">
                  {results.backgroundAssets.map((url, index) => (
                  <div key={index} className="relative group animate-fadeIn">
                    <Image
                      src={url}
                      alt={`Background ${index + 1}`}
                      width={200}
                      height={200}
                      className="w-full h-32 object-cover rounded-lg"
                    />
                    <a
                      href={url}
                      download={`background-${index + 1}.png`}
                      className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg"
                    >
                      <span className="text-white font-semibold">Download</span>
                    </a>
                  </div>
                  ))}
                  {/* Show placeholders for remaining backgrounds */}
                  {isGenerating && Array.from({ length: 5 - results.backgroundAssets.length }, (_, i) => (
                    <div key={`placeholder-${i}`} className="relative">
                      <div className="w-full h-32 bg-gray-100 rounded-lg animate-pulse flex items-center justify-center">
                        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Object Results */}
            {results.objectResults.map((objectResult, objIndex) => (
              <div key={objIndex} className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-2xl font-semibold text-gray-800 mb-4">
                  Object {objIndex + 1} Results
                </h3>
                
                {/* Studio View */}
                <div className="mb-6">
                  <h4 className="text-lg font-medium text-gray-700 mb-2">Studio View</h4>
                  <div className="relative group inline-block animate-fadeIn">
                    <Image
                      src={objectResult.studioView}
                      alt={`Studio view ${objIndex + 1}`}
                      width={300}
                      height={300}
                      className="rounded-lg"
                    />
                    <a
                      href={objectResult.studioView}
                      download={`studio-${objIndex + 1}.png`}
                      className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg"
                    >
                      <span className="text-white font-semibold">Download</span>
                    </a>
                  </div>
                </div>

                {/* Model Shots */}
                <div className="space-y-4">
                  {objectResult.modelShots.map((modelShot, shotIndex) => (
                    <div key={shotIndex}>
                      <h4 className="text-lg font-medium text-gray-700 mb-2 capitalize">
                        {modelShot.type} Shots
                      </h4>
                      <div className="grid grid-cols-3 gap-4">
                        {modelShot.images.map((imageUrl, imgIndex) => (
                          <div key={imgIndex} className="relative group animate-fadeIn">
                            <Image
                              src={imageUrl}
                              alt={`${modelShot.type} ${imgIndex + 1}`}
                              width={200}
                              height={200}
                              className="w-full h-40 object-cover rounded-lg"
                            />
                            <a
                              href={imageUrl}
                              download={`${modelShot.type}-${objIndex + 1}-${imgIndex + 1}.png`}
                              className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg"
                            >
                              <span className="text-white font-semibold">Download</span>
                            </a>
                          </div>
                        ))}
                        {/* Show placeholders for remaining model shots */}
                        {isGenerating && modelShot.images.length < 3 && Array.from({ length: 3 - modelShot.images.length }, (_, i) => (
                          <div key={`placeholder-${i}`} className="relative">
                            <div className="w-full h-40 bg-gray-100 rounded-lg animate-pulse flex items-center justify-center">
                              <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Copy E-commerce Prompt Button */}
            {(results.backgroundAssets.length > 0 || results.objectResults.length > 0) && (
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-800 mb-2 flex items-center">
                      <Globe className="w-6 h-6 mr-2 text-blue-600" />
                      Ready to Build Your E-commerce Website?
                    </h3>
                    <p className="text-gray-600">
                      Copy all generated image URLs with comprehensive instructions to create a stunning jewelry e-commerce website
                    </p>
                    <div className="flex gap-4 mt-2">
                      <span className="text-sm text-gray-500">
                        Total images: {
                          results.backgroundAssets.length + 
                          results.objectResults.length + 
                          results.objectResults.reduce((acc, obj) => 
                            acc + obj.modelShots.reduce((sum, ms) => sum + ms.images.length, 0), 0
                          )
                        }
                      </span>
                      <span className="text-sm text-gray-500">
                        • {results.backgroundAssets.length} backgrounds
                      </span>
                      <span className="text-sm text-gray-500">
                        • {results.objectResults.length} products
                      </span>
                      <span className="text-sm text-gray-500">
                        • {results.objectResults.reduce((acc, obj) => 
                            acc + obj.modelShots.reduce((sum, ms) => sum + ms.images.length, 0), 0
                          )} model shots
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={copyEcommercePrompt}
                    className={`px-6 py-3 rounded-lg font-semibold transition-all transform hover:scale-105 flex items-center ${
                      copySuccess 
                        ? 'bg-green-500 text-white' 
                        : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 shadow-lg'
                    }`}
                  >
                    {copySuccess ? (
                      <>
                        <Check className="w-5 h-5 mr-2" />
                        Copied to Clipboard!
                      </>
                    ) : (
                      <>
                        <Copy className="w-5 h-5 mr-2" />
                        Copy Website Prompt
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

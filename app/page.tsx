'use client';

import { useState } from 'react';
import Image from 'next/image';
import InspirationSection from './components/InspirationSection';

interface ProcessingResult {
  processedImage: string;
}

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
      setResult(null);
      setUploadedImageUrl(null);
      
      // Create preview URL
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file first');
      return;
    }

    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Step 1: Upload the file
      const formData = new FormData();
      formData.append('file', selectedFile);

      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const uploadData = await uploadResponse.json();

      if (!uploadData.success) {
        setError(uploadData.error || 'Failed to upload image');
        return;
      }

      const imageUrl = uploadData.data.imageUrl;
      setUploadedImageUrl(imageUrl);

      // Step 2: Generate processed image
      const generateResponse = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt,
          urls: [imageUrl]
        }),
      });

      const generateData = await generateResponse.json();

      if (generateData.success) {
        setResult(generateData.data);
      } else {
        setError(generateData.error || 'Failed to process image');
      }
    } catch (err) {
      setError('Network error occurred');
      console.error('Processing error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setPrompt('');
    setResult(null);
    setError(null);
    setUploadedImageUrl(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Main Generator Section */}
      <div className="py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              AI Jewelry Image Generator
            </h1>
            <p className="text-lg text-gray-600">
              Upload an image and provide a prompt to generate stunning jewelry photography using AI
            </p>
          </div>

        <div className="bg-white rounded-xl shadow-lg p-8">
          {!result ? (
            <div className="space-y-6">
              {/* File Upload Area */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-input"
                />
                <label
                  htmlFor="file-input"
                  className="cursor-pointer flex flex-col items-center space-y-4"
                >
                  <svg
                    className="w-12 h-12 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  <div>
                    <p className="text-lg font-medium text-gray-700">
                      Click to upload an image
                    </p>
                    <p className="text-sm text-gray-500">
                      PNG, JPG, WEBP up to 7MB
                    </p>
                  </div>
                </label>
              </div>

              {/* Prompt Input */}
              <div className="space-y-2">
                <label htmlFor="prompt" className="block text-lg font-semibold text-gray-900">
                  Prompt:
                </label>
                <textarea
                  id="prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe what you want to generate with the image..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows={3}
                />
                <p className="text-sm text-gray-500">
                  Be specific about what you want the AI to do with your image
                </p>
              </div>

              {/* Preview */}
              {previewUrl && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Preview:</h3>
                  <div className="relative w-full max-w-md mx-auto">
                    <Image
                      src={previewUrl}
                      alt="Preview"
                      width={400}
                      height={300}
                      className="rounded-lg object-contain w-full h-auto max-h-64"
                    />
                  </div>
                  <p className="text-sm text-gray-600 text-center">
                    {selectedFile?.name} ({Math.round((selectedFile?.size || 0) / 1024)}KB)
                  </p>
                </div>
              )}

              {/* Error Display */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-800">{error}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-4 justify-center">
                <button
                  onClick={handleUpload}
                  disabled={!selectedFile || !prompt.trim() || isProcessing}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {isProcessing ? (
                    <span className="flex items-center space-x-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      <span>Generating...</span>
                    </span>
                  ) : (
                    'Generate Image'
                  )}
                </button>
                
                {selectedFile && (
                  <button
                    onClick={resetForm}
                    className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* Results Display */
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-green-600 mb-2">
                  ✅ Generation Complete!
                </h2>
                <p className="text-gray-600">
                  Your image has been successfully generated using AI
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                {uploadedImageUrl && (
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-gray-900">Original Image:</h3>
                    <div className="relative">
                      <Image
                        src={uploadedImageUrl}
                        alt="Original"
                        width={400}
                        height={300}
                        className="rounded-lg object-contain w-full h-auto max-h-64 border"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-gray-900">Generated Image:</h3>
                  <div className="relative">
                    <Image
                      src={result.processedImage}
                      alt="Generated"
                      width={400}
                      height={300}
                      className="rounded-lg object-contain w-full h-auto max-h-64 border"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-4 justify-center">
                <a
                  href={result.processedImage}
                  download="generated-image.png"
                  className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                >
                  Download Generated Image
                </a>
                <button
                  onClick={resetForm}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                >
                  Generate Another Image
                </button>
              </div>
            </div>
          )}
        </div>
        </div>
      </div>
      
      {/* Inspiration Section */}
      <InspirationSection />
    </div>
  );
}
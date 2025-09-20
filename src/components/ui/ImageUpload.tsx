'use client';

import { useState, useCallback, useRef } from 'react';
import Image from 'next/image';

interface ImageUploadProps {
  onImageSelected: (file: File) => void;
  onImageRemoved: () => void;
  onImageCleared: () => void;
  currentImageUrl?: string;
  currentFileName?: string;
  selectedFile?: File | null;
  label?: string;
  className?: string;
  maxSize?: number; // in MB
  acceptedTypes?: string[];
}

export default function ImageUpload({
  onImageSelected,
  onImageRemoved,
  onImageCleared,
  currentImageUrl,
  currentFileName,
  selectedFile,
  label = 'Upload Image',
  className = '',
  maxSize = 5,
  acceptedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleFileSelected = useCallback((file: File) => {
    setUploadError(null);

    // Validate file type
    if (!acceptedTypes.includes(file.type)) {
      setUploadError(`Please select a valid image file (${acceptedTypes.map(type => type.split('/')[1]).join(', ')})`);
      return;
    }

    // Validate file size
    if (file.size > maxSize * 1024 * 1024) {
      setUploadError(`File size must be less than ${maxSize}MB`);
      return;
    }

    // Pass the file to parent component for later upload
    onImageSelected(file);
  }, [acceptedTypes, maxSize, onImageSelected]);

  const handleImageRemove = useCallback(() => {
    // Show confirmation dialog
    const confirmed = window.confirm('Are you sure you want to remove this image? It will be permanently deleted when you update the concert.');

    if (!confirmed) {
      return;
    }

    // Just remove locally - actual deletion happens on concert update
    onImageRemoved();
  }, [onImageRemoved]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelected(files[0]);
    }
  }, [handleFileSelected]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelected(files[0]);
    }
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
      )}

      <div className="flex flex-col items-center space-y-4">
        {/* Current Image Preview or Selected File Preview */}
        {(currentImageUrl || selectedFile) && (
          <div className="relative">
            <div className="relative w-40 h-40 border-2 border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
              {currentImageUrl ? (
                <Image
                  src={currentImageUrl}
                  alt="Current image"
                  fill
                  className="object-cover"
                  onError={() => {
                    setUploadError('Failed to load image');
                  }}
                />
              ) : selectedFile ? (
                <div className="w-full h-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-4xl mb-2">📸</div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {selectedFile.name}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={handleImageRemove}
              className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm shadow-md"
              title="Remove image"
            >
              ×
            </button>
          </div>
        )}

        {/* Upload Area - Show if no current image and no selected file */}
        {!currentImageUrl && !selectedFile && (
          <div
            className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors duration-200 w-full max-w-md ${
              dragActive
                ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                : 'border-gray-300 dark:border-gray-600 hover:border-orange-400'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              accept={acceptedTypes.join(',')}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />

            <div className="space-y-4">
              <div className="flex flex-col items-center">
                <div className="text-4xl mb-2">📸</div>
                <p className="text-lg font-medium text-gray-900 dark:text-white">
                  {dragActive ? 'Drop image here' : 'Drag & drop image here'}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  or{' '}
                  <button
                    type="button"
                    onClick={openFileDialog}
                    className="text-orange-500 hover:text-orange-600 font-medium"
                  >
                    browse files
                  </button>
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Max size: {maxSize}MB • Formats: {acceptedTypes.map(type => type.split('/')[1].toUpperCase()).join(', ')}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {uploadError && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded text-sm">
            {uploadError}
          </div>
        )}
      </div>
    </div>
  );
}

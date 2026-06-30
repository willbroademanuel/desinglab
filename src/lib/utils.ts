// ==============================================================================
// UTILITIES
// ==============================================================================
// Contains client-side utilities and helpers for the DesignLab app.

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Compresses an image file natively in the browser using the HTML Canvas API.
 * This ensures we don't send massive 20MB files across the network, saving
 * bandwidth, storage, and reducing API latency.
 * 
 * @param file The original File object (usually from an <input type="file" />)
 * @param maxWidth The maximum width to scale the image down to
 * @param maxHeight The maximum height to scale the image down to
 * @param quality A number between 0 and 1 indicating image quality (1 is best)
 * @returns A Promise that resolves to the compressed File object
 */
export async function compressImage(
  file: File, 
  maxWidth: number = 1024, 
  maxHeight: number = 1024, 
  quality: number = 0.8
): Promise<File> {
  return new Promise((resolve, reject) => {
    // 1. Ensure this is only running in the browser. Next.js server components don't have Image/Canvas.
    if (typeof window === 'undefined') {
      return reject(new Error('compressImage can only be called in the browser.'));
    }

    // 2. Create an image object to read the file dimensions
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      // 3. Calculate new dimensions while maintaining aspect ratio
      let { width, height } = img;
      
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      if (height > maxHeight) {
        width = Math.round((width * maxHeight) / height);
        height = maxHeight;
      }

      // 4. Draw the image to a temporary invisible Canvas at the new size
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        return reject(new Error('Failed to get canvas context'));
      }

      ctx.drawImage(img, 0, 0, width, height);

      // 5. Convert the canvas back into a fresh Blob/File object (JPEG)
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url); // Clean up memory
        
        if (!blob) {
          return reject(new Error('Canvas to Blob conversion failed'));
        }

        // Return the new File object
        const compressedFile = new File([blob], file.name, {
          type: 'image/jpeg',
          lastModified: Date.now(),
        });
        
        resolve(compressedFile);
      }, 'image/jpeg', quality);
    };

    img.onerror = (error) => {
      URL.revokeObjectURL(url);
      reject(error);
    };

    // Trigger the actual image load
    img.src = url;
  });
}

/**
 * Merges Tailwind classes safely, resolving conflicts.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Safely formats an ISO date string to a localized short string.
 */
export function formatWhen(iso: string): string {
  try {
    const date = new Date(iso);
    if (isNaN(date.getTime())) throw new Error('Invalid date');
    return date.toLocaleString(undefined, {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return 'Invalid date';
  }
}

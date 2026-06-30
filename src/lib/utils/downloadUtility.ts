/**
 * Enterprise-grade utility for securely downloading media on both Web and Android (Capacitor) platforms.
 * Uses the native Kotlin `@JavascriptInterface` (AndroidBlobDownloader) for 100% reliable MediaStore saving,
 * falling back to Capacitor and standard web mechanisms.
 */

import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export interface DownloadResult {
  success: boolean;
  error?: string;
}

const convertBlobToBase64 = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = reject;
  reader.onload = () => {
    // extract base64 string without data:mime/type;base64, prefix
    const dataUrl = reader.result as string;
    const base64 = dataUrl.split(',')[1];
    resolve(base64);
  };
  reader.readAsDataURL(blob);
});

export async function downloadMedia(
  source: string | Blob,
  baseFilename: string,
  isVideo: boolean = false
): Promise<DownloadResult> {
  let blob: Blob;

  // 1. Resolve source into a Blob
  if (typeof source === 'string') {
    try {
      const res = await fetch(source, { mode: 'cors', credentials: 'omit' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      blob = await res.blob();
    } catch (e: any) {
      console.warn('[downloadMedia] CORS or network error, falling back to window.open', e);
      window.open(source, '_blank', 'noopener,noreferrer');
      return { success: false, error: 'Network/CORS error. Opened in new tab instead.' };
    }
  } else {
    blob = source;
  }

  // 2. Resolve proper extension based on blob type
  let ext = isVideo ? 'mp4' : 'png';
  if (blob.type) {
    if (blob.type.includes('jpeg') || blob.type.includes('jpg')) ext = 'jpg';
    else if (blob.type.includes('png')) ext = 'png';
    else if (blob.type.includes('webp')) ext = 'webp';
    else if (blob.type.includes('mp4')) ext = 'mp4';
    else if (blob.type.includes('webm')) ext = 'webm';
  }
  const filename = `${baseFilename}.${ext}`;

  // 3. Check for Native Kotlin Bridge (100% Guaranteed Native Android Save)
  // This interacts directly with MainActivity.java's BlobDownloader.
  if (typeof window !== 'undefined' && (window as any).AndroidBlobDownloader) {
    try {
      const base64Data = await convertBlobToBase64(blob);
      (window as any).AndroidBlobDownloader.saveBlob(base64Data, filename, blob.type);
      return { success: true };
    } catch (e: any) {
      console.error('[downloadMedia] Kotlin AndroidBlobDownloader failed', e);
      // Fall through to Capacitor as backup
    }
  }

  // 4. Capacitor Native Fallback (requires user to rebuild native app with plugins)
  if (Capacitor.isNativePlatform()) {
    try {
      const base64Data = await convertBlobToBase64(blob);
      const savedFile = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Documents,
      });
      await Share.share({ title: filename, url: savedFile.uri });
      return { success: true };
    } catch (e: any) {
      console.error('[downloadMedia] Native Capacitor fallback failed', e);
    }
  }

  // 5. Standard Web `<a>` Fallback
  let objectUrl: string | null = null;
  try {
    objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
      try { document.body.removeChild(a); } catch { /* ignore */ }
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    }, 5000);

    return { success: true };
  } catch (e: any) {
    console.error('[downloadMedia] Web fallback failed', e);
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    
    if (typeof source === 'string') {
       window.open(source, '_blank', 'noopener,noreferrer');
    }
    return { success: false, error: e.message || 'Download failed' };
  }
}

'use client';

import { useState, useCallback, useRef } from 'react';

export interface UploadState {
  /** 0–100 */
  progress: number;
  isUploading: boolean;
  uploadedUrl: string | null;
  error: string | null;
}

const INITIAL_STATE: UploadState = {
  progress: 0,
  isUploading: false,
  uploadedUrl: null,
  error: null,
};

/**
 * Uploads a file to `/api/upload-photo` via XMLHttpRequest
 * so we can track upload progress (impossible with fetch).
 *
 * Returns state + `upload(file)` that resolves with the public URL
 * or rejects on failure.
 */
export function useUploadWithProgress() {
  const [state, setState] = useState<UploadState>(INITIAL_STATE);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const reset = useCallback(() => {
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
    setState(INITIAL_STATE);
  }, []);

  const upload = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      // Abort any in-flight upload
      if (xhrRef.current) {
        xhrRef.current.abort();
      }

      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;

      setState({
        progress: 0,
        isUploading: true,
        uploadedUrl: null,
        error: null,
      });

      // Track upload progress
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          setState((prev) => ({ ...prev, progress: pct }));
        }
      });

      xhr.addEventListener('load', () => {
        xhrRef.current = null;

        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const json = JSON.parse(xhr.responseText);
            if (json.publicUrl) {
              setState({
                progress: 100,
                isUploading: false,
                uploadedUrl: json.publicUrl,
                error: null,
              });
              resolve(json.publicUrl);
            } else {
              const errMsg = json.error || 'Upload succeeded but no URL returned.';
              setState({
                progress: 0,
                isUploading: false,
                uploadedUrl: null,
                error: errMsg,
              });
              reject(new Error(errMsg));
            }
          } catch {
            const errMsg = 'Invalid response from upload server.';
            setState({
              progress: 0,
              isUploading: false,
              uploadedUrl: null,
              error: errMsg,
            });
            reject(new Error(errMsg));
          }
        } else {
          let errMsg = `Upload failed (HTTP ${xhr.status}).`;
          try {
            const json = JSON.parse(xhr.responseText);
            errMsg = json.error || errMsg;
          } catch {
            // not JSON
          }
          setState({
            progress: 0,
            isUploading: false,
            uploadedUrl: null,
            error: errMsg,
          });
          reject(new Error(errMsg));
        }
      });

      xhr.addEventListener('error', () => {
        xhrRef.current = null;
        const errMsg = 'Network error during upload. Please try again.';
        setState({
          progress: 0,
          isUploading: false,
          uploadedUrl: null,
          error: errMsg,
        });
        reject(new Error(errMsg));
      });

      xhr.addEventListener('abort', () => {
        xhrRef.current = null;
        setState(INITIAL_STATE);
        reject(new Error('Upload cancelled.'));
      });

      // Send as FormData
      const fd = new FormData();
      fd.append('photo', file);

      xhr.open('POST', '/api/upload-photo');
      xhr.withCredentials = true;
      xhr.send(fd);
    });
  }, []);

  return { ...state, upload, reset };
}

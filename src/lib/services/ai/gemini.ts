import { GoogleGenAI, Modality } from '@google/genai';
import { AIProvider, GenerateImagePayload, GenerateImageResponse } from './types';

// ==============================================================================
// GEMINI PROVIDER
// ==============================================================================

const DEFAULT_IMAGE_MODEL = 'gemini-2.5-flash-image';

/** Hard ceilings to prevent any one phase from hanging indefinitely. */
const FETCH_TIMEOUT_MS  = 15_000;  // 15 s to download the source photo
const API_TIMEOUT_MS    = 50_000;  // 50 s for the Gemini generateContent call
const LARGE_IMAGE_WARN_BYTES = 5 * 1024 * 1024; // warn if input > 5 MB

function styleTextFromPayload(payload: GenerateImagePayload): string {
  const fromStyle = payload.stylePrompt?.trim();
  if (fromStyle) return fromStyle;
  const p = payload.prompt?.trim() ?? '';
  const cut = p.split(/\n\n\[Source Person Reference Image:/)[0]?.trim();
  return cut || p;
}

/**
 * Wraps a Promise with a hard deadline. Rejects with a clean Error if the
 * deadline fires before the inner promise resolves.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeoutP = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`[GeminiProvider] Timed out after ${ms / 1000}s during: ${label}`)),
      ms
    );
  });
  return Promise.race([promise, timeoutP]).finally(() => clearTimeout(timer));
}

/**
 * Google Gemini native image model: text + reference image → edited/generated image.
 * Requires GEMINI_API_KEY. Optional GEMINI_IMAGE_MODEL (default gemini-2.5-flash-image).
 *
 * Two-phase execution with independent timeouts:
 *   1. Download input image  (max FETCH_TIMEOUT_MS)
 *   2. Call Gemini API       (max API_TIMEOUT_MS)
 */
export class GeminiProvider implements AIProvider {
  async execute(payload: GenerateImagePayload, _generationId: string): Promise<GenerateImageResponse> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('[GeminiProvider] Missing GEMINI_API_KEY');
      return { status: 'failed', error: 'GEMINI_API_KEY is not configured on the server.' };
    }

    const inputUrl = payload.inputImageUrl?.trim();
    if (!inputUrl) {
      return { status: 'failed', error: 'An input photo URL is required for image editing.' };
    }

    const startTime = Date.now();

    // ── Phase 1: Download the source image with a hard timeout ──────────────
    let buf: Buffer;
    let mimeType: string;
    try {
      const fetchStart = Date.now();
      const controller = new AbortController();
      const imgRes = await withTimeout(
        fetch(inputUrl, { cache: 'no-store', signal: controller.signal }),
        FETCH_TIMEOUT_MS,
        'source image download'
      );

      if (!imgRes.ok) {
        return {
          status: 'failed',
          error: `Could not download the uploaded photo (HTTP ${imgRes.status}).`,
        };
      }

      const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
      mimeType = contentType.split(';')[0].trim() || 'image/jpeg';
      buf = Buffer.from(await imgRes.arrayBuffer());

      const fetchMs = Date.now() - fetchStart;
      console.log(`[GeminiProvider] phase=download duration_ms=${fetchMs} size_bytes=${buf.byteLength}`);

      if (buf.byteLength > LARGE_IMAGE_WARN_BYTES) {
        console.warn(
          `[GeminiProvider] Input image is ${(buf.byteLength / (1024 * 1024)).toFixed(1)} MB — ` +
          'consider adding image resizing (sharp) to reduce Gemini latency.'
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to download source image.';
      const isTimeout = msg.includes('Timed out');
      console.error('[GeminiProvider] Download phase error:', msg);
      return {
        status: 'failed',
        error: isTimeout
          ? 'Could not download your photo in time. Please try again.'
          : `Could not download the uploaded photo: ${msg}`,
      };
    }

    const base64Image = buf.toString('base64');

    // ── Phase 2: Call Gemini API with a hard timeout ─────────────────────────
    try {
      const style = styleTextFromPayload(payload);
      const instruction =
        `Edit and transform this photograph according to the following style instructions. ` +
        `Preserve the main subject's identity and likeness. Output a single polished photographic image.\n\n` +
        style;

      const model = process.env.GEMINI_IMAGE_MODEL?.trim() || DEFAULT_IMAGE_MODEL;
      const ai = new GoogleGenAI({ apiKey });

      const apiStart = Date.now();
      const response = await withTimeout(
        ai.models.generateContent({
          model,
          contents: [
            { text: instruction },
            {
              inlineData: {
                mimeType,
                data: base64Image,
              },
            },
          ],
          config: {
            responseModalities: [Modality.TEXT, Modality.IMAGE],
          },
        }),
        API_TIMEOUT_MS,
        'Gemini generateContent'
      );

      const apiMs = Date.now() - apiStart;
      const totalMs = Date.now() - startTime;
      console.log(`[GeminiProvider] phase=api_call duration_ms=${apiMs} total_ms=${totalMs} model=${model}`);

      // ── Safety feedback check ───────────────────────────────────────────────
      const blockReason = response.promptFeedback?.blockReason;
      if (blockReason) {
        console.warn(`[GeminiProvider] Blocked by safety filter: ${String(blockReason)}`);
        return {
          status: 'failed',
          error: 'POLICY_VIOLATION',
        };
      }

      // ── Extract image from response ─────────────────────────────────────────
      const parts = response.candidates?.[0]?.content?.parts ?? [];
      let outputBase64: string | undefined;
      let outputMimeType: string | undefined;

      for (const part of parts) {
        const data = part.inlineData?.data;
        if (data) {
          outputBase64 = data;
          outputMimeType = part.inlineData?.mimeType ?? 'image/png';
          break;
        }
      }

      if (!outputBase64) {
        const textFallback = parts
          .map((p) => p.text)
          .filter(Boolean)
          .join(' ')
          .trim();

        console.error('[GeminiProvider] No image data in response. Text parts:', textFallback);

        // If the model returned text instead of an image it is almost always a
        // content-policy refusal (copyright, nudity, etc.). Surface a single
        // sanitised sentinel so upstream layers show the privacy-policy message.
        const looksLikeRefusal = /\b(cannot|can't|sorry|policy|violat|copyright|nudity|inappropriate|unsafe|block|refus|not allowed|prohibited)\b/i.test(textFallback);
        return {
          status: 'failed',
          error: looksLikeRefusal
            ? 'POLICY_VIOLATION'
            : 'The AI model did not return an image. Try a different photo or template.',
        };
      }

      return {
        status: 'completed',
        outputBase64,
        outputMimeType: outputMimeType ?? 'image/png',
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Gemini API call failed.';
      const isTimeout = message.includes('Timed out');
      const isQuota   = message.includes('429') || message.toLowerCase().includes('quota');

      console.error(`[GeminiProvider] API phase error (timeout=${isTimeout}, quota=${isQuota}):`, message);

      return {
        status: 'failed',
        error: isTimeout
          ? 'Image generation timed out. The AI service is currently busy — your credits have been refunded. Please try again in a moment.'
          : isQuota
          ? 'AI quota limit reached. Please try again in a few minutes.'
          : message,
      };
    }
  }
}

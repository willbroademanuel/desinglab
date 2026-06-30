// ==============================================================================
// AI PROVIDERS TYPE DEFINITIONS
// ==============================================================================
// This file defines the standard interface that ALL AI providers must adhere to.
// By doing this, we create a "Plugin Architecture", making it dead simple
// to add a new provider later (like OpenAI or Midjourney) without breaking
// the rest of the application.

/**
 * Standard request payload sent to any provider.
 */
export interface GenerateImagePayload {
  prompt: string;
  /** Template style instructions (preferred for image+prompt flows). */
  stylePrompt?: string;
  // Many models support image-to-image. This is optional.
  inputImageUrl?: string;
  // Any extra configuration specific to an image request
  width?: number;
  height?: number;
  numInferenceSteps?: number;
}

/**
 * Standard response from a provider.
 */
export interface GenerateImageResponse {
  /**
   * If the provider is SYNCHRONOUS, they return the completed image URL immediately.
   */
  outputUrl?: string;

  /** Raw image from the model; orchestrator uploads to storage and sets outputUrl on the generation. */
  outputBase64?: string;
  outputMimeType?: string;

  /**
   * If the provider is ASYNCHRONOUS (like Fal or Replicate), they return an ID
   * first, and then ping our webhook when it's done.
   */
  jobId?: string;

  /**
   * Whether the generation is completely finished right now ('completed'),
   * or if we're waiting on a webhook ('pending').
   */
  status: 'completed' | 'pending' | 'failed';

  /**
   * Explains any failures if status is 'failed'.
   */
  error?: string;
}

/**
 * The strict Interface every Provider Class MUST implement.
 */
export interface AIProvider {
  /**
   * @param payload The prompt and settings for generation.
   * @param generationId The UUID created in our database (useful for passing to webhooks as a callback ID)
   */
  execute(payload: GenerateImagePayload, generationId: string): Promise<GenerateImageResponse>;
}

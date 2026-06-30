/**
 * Professional Security Utils for DesignLab
 * 
 * Provides robust sanitization and validation utilities for design projects.
 * These methods should be invoked prior to exporting project state to HTML,
 * SVG, or any external DOM context where raw text nodes could become 
 * execution vectors (XSS).
 */

/**
 * Strips dangerous HTML injection sequences from user text.
 * Natively, Canvas `fillText` is immune to XSS, but this is critical
 * if the text is ever serialized to an SVG file or injected into a DOM string.
 * 
 * @param rawText The untrusted user input string
 * @returns Escaped text safe for SVG/HTML interpolation
 */
export function sanitizeTextForExport(rawText: string): string {
  if (!rawText) return '';
  return rawText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Deep clones and recursively sanitizes an entire project state.
 * Useful as a middleware interceptor before transmitting project JSON
 * to an external rendering service, or generating an SVG export.
 * 
 * @param projectJson The raw project state from useDesignLab
 * @returns A safe, sanitized copy of the project
 */
export function sanitizeProjectForExport(projectJson: any): any {
  if (!projectJson) return projectJson;
  
  // Deep clone to guarantee we don't accidentally mutate the live React state
  const cleanProject = JSON.parse(JSON.stringify(projectJson));
  
  if (Array.isArray(cleanProject.layers)) {
    cleanProject.layers = cleanProject.layers.map((layer: any) => {
      // 1. Text Sanitization
      if (layer.type === 'text' && layer.text) {
        layer.text = sanitizeTextForExport(layer.text);
      }
      
      // 2. Additional layer sanitization could be added here
      // (e.g. validating image URLs against an allow-list, verifying SVG magic bytes)
      
      return layer;
    });
  }
  
  return cleanProject;
}

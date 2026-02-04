/**
 * Validate and parse an HTTP/HTTPS URL.
 *
 * @param urlString - The URL string to validate
 * @param fieldName - Name of the field for error messages (e.g., "baseUrl")
 * @returns Parsed URL object
 * @throws Error if URL is invalid or not HTTP/HTTPS
 */
export function validateHttpUrl(urlString: string, fieldName = 'URL'): URL {
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`${fieldName} must use http or https protocol`);
    }
    return parsed;
  } catch (error) {
    if (error instanceof Error && error.message.includes('protocol')) {
      throw error;
    }
    throw new Error(`${fieldName} is not a valid URL`);
  }
}

/**
 * Normalize a base URL by removing trailing slashes.
 *
 * @param baseUrl - The base URL to normalize
 * @returns URL without trailing slashes
 */
export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

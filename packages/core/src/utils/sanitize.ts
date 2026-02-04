// packages/core/src/utils/sanitize.ts

const DEFAULT_MAX_LENGTH = 8000;

/**
 * Sanitize and validate a string input.
 *
 * @param input - The input value to sanitize
 * @param fieldName - Name of the field for error messages
 * @param maxLength - Maximum allowed length (default: 8000)
 * @returns Trimmed string
 * @throws Error if input is not a non-empty string or exceeds maxLength
 */
export function sanitizeString(
  input: unknown,
  fieldName: string,
  maxLength = DEFAULT_MAX_LENGTH
): string {
  if (typeof input !== 'string') {
    throw new Error(`${fieldName} must be a string`);
  }
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error(`${fieldName} is required`);
  }
  if (trimmed.length > maxLength) {
    throw new Error(`${fieldName} exceeds maximum length of ${maxLength}`);
  }
  return trimmed;
}

/**
 * Sanitize an optional string input.
 * Returns undefined if input is null/undefined, otherwise validates.
 *
 * @param input - The optional input value
 * @param fieldName - Name of the field for error messages
 * @param maxLength - Maximum allowed length
 * @returns Trimmed string or undefined
 */
export function sanitizeOptionalString(
  input: unknown,
  fieldName: string,
  maxLength = DEFAULT_MAX_LENGTH
): string | undefined {
  if (input === null || input === undefined) {
    return undefined;
  }
  return sanitizeString(input, fieldName, maxLength);
}

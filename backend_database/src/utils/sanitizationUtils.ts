import validator from "validator";

/**
 * - Defense in Depth: Multiple layers
 *   1. Schema validation (format, length, required)
 *   2. Sanitization (escape HTML, normalize)
 *   3. Frontend output encoding (React auto-escapes)
 */

export const sanitize = {
  username: (input: string): string => {
    return validator.escape(validator.trim(input));
  },

  email: (input: string): string => {
    const normalized = validator.normalizeEmail(input, {
      gmail_remove_dots: false, // Keep dots (john.doe different from johndoe)
      gmail_remove_subaddress: false, // Keep +tags (useful for tracking)
    });
    return normalized ? validator.trim(normalized) : validator.trim(input);
  },

  text: (input: string): string => {
    return validator.escape(validator.trim(input));
  },
};

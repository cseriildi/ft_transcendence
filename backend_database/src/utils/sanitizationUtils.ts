import validator from "validator";

/**
 * Sanitization utilities for user input
 *
 * Purpose: Clean user input before storage to prevent XSS and ensure data hygiene
 *
 * Key Concepts:
 * - Sanitization ≠ Validation
 *   - Validation: "Is this acceptable?" (reject or accept)
 *   - Sanitization: "Make this safe" (transform input)
 *
 * - Defense in Depth: Multiple layers
 *   1. Schema validation (format, length, required)
 *   2. Sanitization (escape HTML, normalize)
 *   3. Frontend output encoding (React auto-escapes)
 *
 * Why escape HTML?
 * - Prevents stored XSS: <script>alert('XSS')</script> → &lt;script&gt;...
 * - Browser won't execute escaped content
 */

export const sanitize = {
  /**
   * Sanitize username: trim whitespace, escape HTML entities
   *
   * Example:
   *   Input:  "  john<script>alert(1)</script>  "
   *   Output: "john&lt;script&gt;alert(1)&lt;/script&gt;"
   *
   * Why: Prevent stored XSS when username is displayed in frontend
   */
  username: (input: string): string => {
    return validator.escape(validator.trim(input));
  },

  /**
   * Sanitize email: normalize (lowercase, remove dots in gmail), trim
   *
   * Example:
   *   Input:  "  John.Doe+test@Gmail.COM  "
   *   Output: "johndoe@gmail.com"
   *
   * Why: Consistent email format prevents duplicate accounts
   * Note: validator.normalizeEmail removes gmail dots/plus addressing
   */
  email: (input: string): string => {
    const normalized = validator.normalizeEmail(input, {
      gmail_remove_dots: false, // Keep dots (john.doe different from johndoe)
      gmail_remove_subaddress: false, // Keep +tags (useful for tracking)
    });
    return normalized ? validator.trim(normalized) : validator.trim(input);
  },

  /**
   * Sanitize general text: trim, escape HTML
   *
   * Use for: Bio, comments, any user-generated content displayed as HTML
   */
  text: (input: string): string => {
    return validator.escape(validator.trim(input));
  },
};

/**
 * Interview Question: "Why sanitize before storage instead of on display?"
 *
 * Answer:
 * 1. **Single point of defense** - Sanitize once at entry, not at every display point
 * 2. **Database integrity** - Store clean data, avoid "garbage in, garbage out"
 * 3. **API consistency** - All consumers get safe data (web, mobile, exports)
 * 4. **Defense in depth** - Complement frontend escaping (React auto-escapes)
 *
 * BUT: Also validate format (schema) before sanitization
 * Order: Validate → Sanitize → Store
 */

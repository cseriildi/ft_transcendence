/**
 * Simple password hashing utility without bcrypt
 * Uses basic hashing as a temporary workaround for crypto issues
 */

/**
 * Simple hash function using String operations
 * NOTE: This is NOT cryptographically secure - only for temporary workaround
 */
function simpleHash(input: string, salt: string): string {
  let hash = 0;
  const combined = input + salt;
  
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Convert to positive hex string
  return Math.abs(hash).toString(36).padStart(12, '0');
}

/**
 * Generate a simple salt
 */
function generateSalt(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

/**
 * Hash password with multiple iterations for better security
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = generateSalt();
  let hash = password;
  
  // Multiple iterations for better security
  for (let i = 0; i < 1000; i++) {
    hash = simpleHash(hash, salt + i);
  }
  
  // Return salt and hash combined
  return `${salt}:${hash}`;
}

/**
 * Compare password with stored hash
 */
export async function comparePassword(password: string, storedHash: string): Promise<boolean> {
  const [salt, hash] = storedHash.split(':');
  
  if (!salt || !hash) {
    return false;
  }
  
  let computedHash = password;
  for (let i = 0; i < 1000; i++) {
    computedHash = simpleHash(computedHash, salt + i);
  }
  
  return computedHash === hash;
}

import { randomBytes } from 'crypto';

/**
 * Generate a random verification token
 * @returns A random token for email verification
 */
export function generateVerificationToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Generate an expiry date for a verification token
 * @param expiryHours Hours until the token expires
 * @returns Date object representing the expiry time
 */
export function generateTokenExpiry(expiryHours: number = 24): Date {
  const now = new Date();
  now.setHours(now.getHours() + expiryHours);
  return now;
}

/**
 * Check if a verification token has expired
 * @param expiryDate The token's expiry date
 * @returns Boolean indicating if the token has expired
 */
export function isTokenExpired(expiryDate: Date | null): boolean {
  if (!expiryDate) return true;
  return new Date() > new Date(expiryDate);
}

/**
 * Build verification URL for email
 * @param baseUrl Base URL of the application
 * @param userId User ID
 * @param token Verification token
 * @returns Full verification URL to include in email
 */
export function buildVerificationUrl(baseUrl: string, userId: string, token: string): string {
  // Use a more email-friendly path-based URL instead of query parameters
  return `${baseUrl}/confirm-email/${userId}/${token}`;
}
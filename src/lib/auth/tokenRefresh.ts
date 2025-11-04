/**
 * Token Refresh Manager
 * Automatically refreshes access tokens before they expire
 */

import { getCurrentGoogleUser } from "./google";
import { getCurrentCognitoUser } from "./cognito";

let refreshInterval: number | null = null;

/**
 * Start automatic token refresh
 * Checks every 5 minutes and refreshes if token expires within 10 minutes
 */
export function startTokenRefresh(): void {
  if (refreshInterval) {
    return; // Already running
  }

  // Check immediately
  checkAndRefreshTokens();

  // Then check every 5 minutes
  refreshInterval = window.setInterval(() => {
    checkAndRefreshTokens();
  }, 5 * 60 * 1000); // 5 minutes
}

/**
 * Stop automatic token refresh
 */
export function stopTokenRefresh(): void {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}

/**
 * Check if tokens need refresh and refresh them
 */
async function checkAndRefreshTokens(): Promise<void> {
  try {
    // Check Google token
    const googleExpiry = localStorage.getItem('google_token_expiry');
    if (googleExpiry) {
      const expiresIn = Number(googleExpiry) - Date.now();
      const tenMinutes = 10 * 60 * 1000;

      // Refresh if expires within 10 minutes
      if (expiresIn < tenMinutes && expiresIn > 0) {
        console.log('[TokenRefresh] Refreshing Google token...');
        await getCurrentGoogleUser(); // This will trigger refresh
      }
    }

    // Check Cognito token
    const cognitoExpiry = localStorage.getItem('cognito_token_expiry');
    if (cognitoExpiry) {
      const expiresIn = Number(cognitoExpiry) - Date.now();
      const tenMinutes = 10 * 60 * 1000;

      // Refresh if expires within 10 minutes
      if (expiresIn < tenMinutes && expiresIn > 0) {
        console.log('[TokenRefresh] Refreshing Cognito token...');
        await getCurrentCognitoUser(); // This will trigger refresh
      }
    }
  } catch (error) {
    console.error('[TokenRefresh] Error refreshing tokens:', error);
  }
}

/**
 * Manually refresh all active tokens
 */
export async function refreshAllTokens(): Promise<void> {
  await checkAndRefreshTokens();
}

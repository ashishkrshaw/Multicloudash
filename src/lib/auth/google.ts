/**
 * Google OAuth 2.0 Authentication Service
 * Uses backend for OAuth flow (simpler and more secure)
 */

const GOOGLE_USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v2/userinfo';

export interface GoogleUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
  verified_email: boolean;
}

/**
 * Get the backend API URL
 */
function getBackendUrl(): string {
  return import.meta.env.VITE_API_URL || 'http://localhost:4000';
}

/**
 * Initiate Google OAuth flow via backend
 * Much simpler - just redirect to backend endpoint
 */
export async function initiateGoogleSignIn(): Promise<void> {
  console.log('[GoogleAuth] Initiating sign-in via backend');
  
  const backendUrl = getBackendUrl();
  const authUrl = `${backendUrl}/auth/google`;
  
  console.log('[GoogleAuth] Redirecting to:', authUrl);
  
  // Redirect to backend which will handle the OAuth flow
  window.location.href = authUrl;
}

/**
 * Handle OAuth callback from backend
 * Backend sends token and user data via URL params
 */
export async function handleOAuthCallback(): Promise<GoogleUser | null> {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const userJson = params.get('user');
  const error = params.get('error');

  console.log('[GoogleAuth] Processing OAuth callback');
  console.log('[GoogleAuth] Token present:', token ? 'yes' : 'no');
  console.log('[GoogleAuth] User data present:', userJson ? 'yes' : 'no');
  console.log('[GoogleAuth] Error:', error || 'none');

  if (error) {
    throw new Error(`OAuth error: ${error}`);
  }

  if (!token || !userJson) {
    return null;
  }

  try {
    const user = JSON.parse(userJson);
    
    // Store token and user info
    localStorage.setItem('auth_token', token);
    localStorage.setItem('cloudctrl_user', userJson);
    
    // Clean up URL
    window.history.replaceState({}, document.title, window.location.pathname);
    
    console.log('[GoogleAuth] User authenticated:', user.email);
    
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      verified_email: true,
    };
  } catch (error) {
    console.error('[GoogleAuth] Failed to parse user data:', error);
    return null;
  }
}

/**
 * Get current user from stored data
 */
export async function getCurrentGoogleUser(): Promise<GoogleUser | null> {
  const token = localStorage.getItem('auth_token');
  const userJson = localStorage.getItem('cloudctrl_user');

  if (!token || !userJson) {
    return null;
  }

  try {
    const user = JSON.parse(userJson);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      verified_email: true,
    };
  } catch {
    return null;
  }
}

/**
 * Sign out and clear stored data
 */
export function signOutGoogle(): void {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('cloudctrl_user');
  localStorage.removeItem('google_access_token');
  localStorage.removeItem('google_refresh_token');
  localStorage.removeItem('google_token_expiry');
}

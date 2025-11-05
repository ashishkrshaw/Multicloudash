/**
 * Google OAuth 2.0 Authentication Service
 * Handles Google Sign-In flow with PKCE (Proof Key for Code Exchange)
 */

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v2/userinfo';

export interface GoogleUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
  verified_email: boolean;
}

/**
 * Get the appropriate redirect URI based on environment
 */
function getRedirectUri(): string {
  // In development mode, always use localhost
  const isDevelopment = import.meta.env.MODE === 'development' || 
                       import.meta.env.DEV ||
                       window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1';
  
  if (isDevelopment) {
    // Use configured redirect URI for development (localhost)
    const devUri = import.meta.env.VITE_GOOGLE_REDIRECT_URI || 'http://localhost:8081/auth/callback/google';
    console.log('[GoogleAuth] Using development redirect URI:', devUri);
    return devUri;
  }
  
  // In production, use the current origin
  const prodUri = `${window.location.origin}/auth/callback/google`;
  console.log('[GoogleAuth] Using production redirect URI:', prodUri);
  return prodUri;
}

// Generate PKCE code verifier and challenge
function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Store PKCE verifier in session
function storeCodeVerifier(verifier: string) {
  sessionStorage.setItem('google_code_verifier', verifier);
}

function getCodeVerifier(): string | null {
  return sessionStorage.getItem('google_code_verifier');
}

function clearCodeVerifier() {
  sessionStorage.removeItem('google_code_verifier');
}

/**
 * Initiate Google OAuth flow
 */
export async function initiateGoogleSignIn(): Promise<void> {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const redirectUri = getRedirectUri();

  console.log('[GoogleAuth] Initiating sign-in');
  console.log('[GoogleAuth] Client ID:', clientId ? 'present' : 'missing');
  console.log('[GoogleAuth] Redirect URI:', redirectUri);

  if (!clientId || clientId.includes('placeholder')) {
    throw new Error('Google OAuth not configured. Please set VITE_GOOGLE_CLIENT_ID in .env');
  }

  // Generate PKCE parameters
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  storeCodeVerifier(codeVerifier);

  // Build authorization URL
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    access_type: 'offline',
    prompt: 'consent',
  });

  console.log('[GoogleAuth] Redirecting to Google...');
  // Redirect to Google
  window.location.href = `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

/**
 * Handle OAuth callback and exchange code for tokens
 */
export async function handleGoogleCallback(code: string): Promise<GoogleUser> {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const redirectUri = getRedirectUri();
  const codeVerifier = getCodeVerifier();

  console.log('[GoogleAuth] Processing callback');
  console.log('[GoogleAuth] Code present:', code ? 'yes' : 'no');
  console.log('[GoogleAuth] Code verifier present:', codeVerifier ? 'yes' : 'no');
  console.log('[GoogleAuth] Redirect URI:', redirectUri);

  if (!codeVerifier) {
    throw new Error('Code verifier not found. Please restart sign-in flow.');
  }

  try {
    // Exchange authorization code for tokens
    const tokenResponse = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('[GoogleAuth] Token exchange failed:', error);
      throw new Error(`Token exchange failed: ${error}`);
    }

    const tokens = await tokenResponse.json();
    console.log('[GoogleAuth] Tokens received successfully');
    
    // Store tokens
    localStorage.setItem('google_access_token', tokens.access_token);
    if (tokens.refresh_token) {
      localStorage.setItem('google_refresh_token', tokens.refresh_token);
    }
    localStorage.setItem('google_token_expiry', String(Date.now() + tokens.expires_in * 1000));

    // Fetch user info
    const userResponse = await fetch(GOOGLE_USERINFO_ENDPOINT, {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    if (!userResponse.ok) {
      throw new Error('Failed to fetch user info');
    }

    const user = await userResponse.json();
    console.log('[GoogleAuth] User info retrieved:', user.email);
    
    // Clean up PKCE verifier
    clearCodeVerifier();

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      verified_email: user.verified_email,
    };
  } catch (error) {
    clearCodeVerifier();
    console.error('[GoogleAuth] Callback handling failed:', error);
    throw error;
  }
}

/**
 * Get current user from stored token
 */
export async function getCurrentGoogleUser(): Promise<GoogleUser | null> {
  const accessToken = localStorage.getItem('google_access_token');
  const expiry = localStorage.getItem('google_token_expiry');

  if (!accessToken || !expiry) {
    return null;
  }

  // Check if token expired
  if (Date.now() >= Number(expiry)) {
    await refreshGoogleToken();
    return getCurrentGoogleUser();
  }

  try {
    const response = await fetch(GOOGLE_USERINFO_ENDPOINT, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const user = await response.json();
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      verified_email: user.verified_email,
    };
  } catch {
    return null;
  }
}

/**
 * Refresh access token using refresh token
 */
async function refreshGoogleToken(): Promise<void> {
  const refreshToken = localStorage.getItem('google_refresh_token');
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      grant_type: 'refresh_token',
    }).toString(),
  });

  if (!response.ok) {
    throw new Error('Token refresh failed');
  }

  const tokens = await response.json();
  localStorage.setItem('google_access_token', tokens.access_token);
  localStorage.setItem('google_token_expiry', String(Date.now() + tokens.expires_in * 1000));
}

/**
 * Sign out and clear tokens
 */
export function signOutGoogle(): void {
  localStorage.removeItem('google_access_token');
  localStorage.removeItem('google_refresh_token');
  localStorage.removeItem('google_token_expiry');
  clearCodeVerifier();
}

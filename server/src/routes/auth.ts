/**
 * Authentication Routes
 * Handles Google OAuth flow on backend
 */

import { Router, Request, Response } from 'express';
import { upsertUser } from '../utils/userManager.js';

const authRouter = Router();

/**
 * Generate a simple JWT token (you can use jsonwebtoken package for production)
 */
function generateSimpleToken(userId: string, email: string): string {
  // Simple base64 encoded token for development
  // In production, use proper JWT with signing
  const payload = {
    userId,
    email,
    provider: 'google',
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

/**
 * Initiate Google OAuth Flow
 * Frontend redirects here to start OAuth
 */
authRouter.get('/google', (req: Request, res: Response) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const backendUrl = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;
  const redirectUri = `${backendUrl}/auth/callback/google`;
  
  console.log('[OAuth] Initiating Google OAuth flow');
  console.log('[OAuth] Redirect URI:', redirectUri);
  
  if (!clientId) {
    return res.status(500).json({ 
      error: 'GOOGLE_CLIENT_ID not configured' 
    });
  }
  
  // Build Google OAuth URL
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent'
  });
  
  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  
  // Redirect user to Google
  return res.redirect(googleAuthUrl);
});

/**
 * Google OAuth Callback Handler
 * Google redirects here after user authorizes
 */
authRouter.get('/callback/google', async (req: Request, res: Response) => {
  try {
    const code = req.query.code as string;
    const error = req.query.error as string;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8081';

    console.log('[OAuth] Google callback received');
    console.log('[OAuth] Code present:', code ? 'yes' : 'no');
    console.log('[OAuth] Error:', error || 'none');

    // If user denied access
    if (error) {
      console.error('[OAuth] User denied access:', error);
      return res.redirect(`${frontendUrl}/?error=access_denied`);
    }

    // If no code received
    if (!code) {
      console.error('[OAuth] No authorization code received');
      return res.redirect(`${frontendUrl}/?error=no_code`);
    }

    // Exchange code for tokens
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const backendUrl = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;
    const redirectUri = `${backendUrl}/auth/callback/google`;

    console.log('[OAuth] Exchanging code for tokens...');
    console.log('[OAuth] Redirect URI used:', redirectUri);

    if (!clientId) {
      throw new Error('GOOGLE_CLIENT_ID not configured');
    }

    // Note: clientSecret is optional for public clients (PKCE flow)
    // If you don't have it, the token exchange might still work
    const tokenParams: any = {
      code,
      client_id: clientId,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    };

    if (clientSecret) {
      tokenParams.client_secret = clientSecret;
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(tokenParams),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[OAuth] Token exchange failed:', errorText);
      throw new Error(`Token exchange failed: ${errorText}`);
    }

    const tokens = await tokenResponse.json();
    console.log('[OAuth] Tokens received successfully');

    // Get user info from Google
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userResponse.ok) {
      throw new Error('Failed to fetch user info from Google');
    }

    const googleUser = await userResponse.json();
    console.log('[OAuth] User info received:', googleUser.email);

    // Create or update user in database
    const userId = await upsertUser({
      email: googleUser.email,
      name: googleUser.name || googleUser.email.split('@')[0],
      provider: 'google',
      providerId: googleUser.id,
    });

    console.log('[OAuth] User created/updated in database:', userId);

    // Generate token for frontend
    const userToken = generateSimpleToken(userId, googleUser.email);

    // Prepare user data for frontend
    const userData = {
      id: userId,
      email: googleUser.email,
      name: googleUser.name,
      picture: googleUser.picture,
      provider: 'google'
    };

    // Redirect to frontend with token and user data
    const params = new URLSearchParams({
      token: userToken,
      user: JSON.stringify(userData)
    });

    console.log('[OAuth] Redirecting to frontend with auth token');
    return res.redirect(`${frontendUrl}/?${params.toString()}`);

  } catch (error) {
    console.error('[OAuth] Error handling callback:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8081';
    const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
    return res.redirect(`${frontendUrl}/?error=${encodeURIComponent(errorMessage)}`);
  }
});

/**
 * Health check for auth routes
 */
authRouter.get('/health', (_req: Request, res: Response) => {
  const googleConfigured = !!(process.env.GOOGLE_CLIENT_ID);
  const frontendConfigured = !!(process.env.FRONTEND_URL);
  
  return res.json({ 
    status: 'ok', 
    service: 'auth',
    routes: ['/auth/google', '/auth/callback/google'],
    config: {
      googleClientId: googleConfigured ? 'configured' : 'missing',
      frontendUrl: frontendConfigured ? 'configured' : 'missing (using default)',
    }
  });
});

export default authRouter;

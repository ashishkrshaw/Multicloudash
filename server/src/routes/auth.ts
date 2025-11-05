/**
 * Authentication Routes
 * Handles Google OAuth callback on backend
 */

import { Router, Request, Response } from 'express';

const authRouter = Router();

/**
 * Google OAuth Callback Handler
 * This handles the redirect from Google after user authorizes
 */
authRouter.get('/callback/google', async (req: Request, res: Response) => {
  try {
    const code = req.query.code as string;
    const error = req.query.error as string;

    console.log('[OAuth] Google callback received');
    console.log('[OAuth] Code present:', code ? 'yes' : 'no');
    console.log('[OAuth] Error:', error || 'none');

    // If user denied access
    if (error) {
      console.error('[OAuth] User denied access:', error);
      // Redirect to frontend with error
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8081';
      return res.redirect(`${frontendUrl}/?error=access_denied`);
    }

    // If no code received
    if (!code) {
      console.error('[OAuth] No authorization code received');
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8081';
      return res.redirect(`${frontendUrl}/?error=no_code`);
    }

    // OPTION 1: Pass code to frontend to handle token exchange
    // This is simpler and keeps token logic in frontend
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8081';
    console.log('[OAuth] Redirecting to frontend with code');
    return res.redirect(`${frontendUrl}/auth/callback/google?code=${code}`);

    // OPTION 2: Handle token exchange on backend (more secure)
    // Uncomment this if you want backend to handle everything
    /*
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET; // You'd need this
    const redirectUri = `${req.protocol}://${req.get('host')}/auth/callback/google`;

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId!,
        client_secret: clientSecret!,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error('Token exchange failed');
    }

    const tokens = await tokenResponse.json();

    // Get user info
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    const user = await userResponse.json();

    // Create user in database using existing userManager
    const userId = await upsertUser({
      email: user.email,
      name: user.name,
      provider: 'google',
      providerId: user.id,
    });

    // Create JWT token for user
    const jwt = require('jsonwebtoken');
    const userToken = jwt.sign(
      { userId, email: user.email, provider: 'google' },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    // Redirect to frontend with token
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8081';
    return res.redirect(`${frontendUrl}/?token=${userToken}`);
    */
  } catch (error) {
    console.error('[OAuth] Error handling callback:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8081';
    return res.redirect(`${frontendUrl}/?error=auth_failed`);
  }
});

/**
 * Health check for auth routes
 */
authRouter.get('/health', (_req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    service: 'auth',
    routes: ['/auth/callback/google']
  });
});

export default authRouter;

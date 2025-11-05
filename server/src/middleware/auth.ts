/**
 * Authentication Middleware
 * Validates JWT tokens from Google OAuth or AWS Cognito
 * Creates/updates user in database on successful authentication
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { upsertUser } from '../utils/userManager.js';

// Simple in-memory cache to prevent repeated DB writes
const userCache = new Map<string, { userId: string; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Extend Express Request to include user info
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
      authProvider?: 'google' | 'cognito';
    }
  }
}

/**
 * Get or create user with caching to reduce DB calls
 */
async function getOrCreateUser(
  providerId: string,
  email: string,
  name: string | undefined,
  provider: 'google' | 'cognito'
): Promise<string> {
  const cacheKey = `${provider}:${providerId}`;
  const cached = userCache.get(cacheKey);
  
  // Return cached userId if still valid
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.userId;
  }
  
  // Create/update user in database
  const userId = await upsertUser({
    email,
    name,
    provider,
    providerId,
  });
  
  // Cache the result
  userCache.set(cacheKey, { userId, timestamp: Date.now() });
  
  return userId;
}

/**
 * Verify Google OAuth token
 */
async function verifyGoogleToken(token: string): Promise<{ 
  providerId: string; 
  email: string; 
  name?: string;
} | null> {
  try {
    // Decode JWT token
    const decoded = jwt.decode(token) as any;
    
    if (!decoded || !decoded.sub || !decoded.email) {
      return null;
    }

    // TODO: In production, verify signature with Google's public keys:
    // const { OAuth2Client } = require('google-auth-library');
    // const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    // const ticket = await client.verifyIdToken({
    //   idToken: token,
    //   audience: process.env.GOOGLE_CLIENT_ID
    // });
    // const payload = ticket.getPayload();

    return {
      providerId: decoded.sub,
      email: decoded.email,
      name: decoded.name || decoded.given_name || decoded.email.split('@')[0],
    };
  } catch (error) {
    console.error('[Auth] Google token verification failed:', error);
    return null;
  }
}

/**
 * Verify AWS Cognito token
 */
async function verifyCognitoToken(token: string): Promise<{ 
  providerId: string; 
  email: string; 
  name?: string;
} | null> {
  try {
    // Decode JWT token
    const decoded = jwt.decode(token) as any;
    
    if (!decoded || !decoded.sub || !decoded.email) {
      return null;
    }

    // TODO: In production, verify signature with Cognito's JWKs:
    // import { CognitoJwtVerifier } from 'aws-jwt-verify';
    // const verifier = CognitoJwtVerifier.create({
    //   userPoolId: process.env.COGNITO_USER_POOL_ID!,
    //   tokenUse: "id",
    //   clientId: process.env.COGNITO_CLIENT_ID!
    // });
    // const payload = await verifier.verify(token);

    return {
      providerId: decoded.sub,
      email: decoded.email,
      name: decoded.name || decoded['cognito:username'] || decoded.email.split('@')[0],
    };
  } catch (error) {
    console.error('[Auth] Cognito token verification failed:', error);
    return null;
  }
}

/**
 * Authentication middleware
 * Validates JWT token and attaches user info to request
 * Creates/updates user in database
 */
export async function authenticateUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No authorization token provided' });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer '

    // Try Google token first
    let userInfo = await verifyGoogleToken(token);
    if (userInfo) {
      // Create/update user in database (with caching)
      const userId = await getOrCreateUser(
        userInfo.providerId,
        userInfo.email,
        userInfo.name,
        'google'
      );

      req.userId = userId;
      req.userEmail = userInfo.email;
      req.authProvider = 'google';
      
      next();
      return;
    }

    // Try Cognito token
    userInfo = await verifyCognitoToken(token);
    if (userInfo) {
      // Create/update user in database (with caching)
      const userId = await getOrCreateUser(
        userInfo.providerId,
        userInfo.email,
        userInfo.name,
        'cognito'
      );

      req.userId = userId;
      req.userEmail = userInfo.email;
      req.authProvider = 'cognito';
      
      next();
      return;
    }

    // No valid token
    res.status(401).json({ error: 'Invalid authorization token' });
  } catch (error) {
    console.error('[Auth] Authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

/**
 * Optional authentication middleware
 * Allows requests without auth but attaches user info if present
 * Creates/updates user in database if authenticated
 */
export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  try {
    const token = authHeader.substring(7);
    
    let userInfo = await verifyGoogleToken(token);
    if (userInfo) {
      // Create/update user in database (with caching)
      const userId = await getOrCreateUser(
        userInfo.providerId,
        userInfo.email,
        userInfo.name,
        'google'
      );

      req.userId = userId;
      req.userEmail = userInfo.email;
      req.authProvider = 'google';
    } else {
      userInfo = await verifyCognitoToken(token);
      if (userInfo) {
        // Create/update user in database (with caching)
        const userId = await getOrCreateUser(
          userInfo.providerId,
          userInfo.email,
          userInfo.name,
          'cognito'
        );

        req.userId = userId;
        req.userEmail = userInfo.email;
        req.authProvider = 'cognito';
      }
    }
  } catch (error) {
    console.error('[Auth] Optional auth error:', error);
  }

  next();
}

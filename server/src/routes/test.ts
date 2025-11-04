/**
 * System Test Routes
 * Endpoints for testing connections, auth, caching, etc.
 */

import { Router } from 'express';
import { authenticateUser, optionalAuth } from '../middleware/auth.js';
import { getCredentials } from '../utils/credentialStore.js';
import { getUserCacheStats, getTimeUntilRefresh } from '../utils/cache.js';
import { getConversationMetadata } from '../utils/chatHistory.js';

const router = Router();

/**
 * GET /api/test/auth
 * Test authentication
 */
router.get('/auth', optionalAuth, async (req, res) => {
  try {
    if (req.userId) {
      res.json({
        success: true,
        authenticated: true,
        userId: req.userId,
        email: req.userEmail,
        provider: req.authProvider,
      });
    } else {
      res.json({
        success: true,
        authenticated: false,
        message: 'No authentication token provided',
      });
    }
  } catch (error) {
    res.status(500).json({ error: 'Auth test failed' });
  }
});

/**
 * GET /api/test/credentials
 * Test if user has credentials stored
 */
router.get('/credentials', authenticateUser, async (req, res) => {
  try {
    const userId = req.userId!;
    const credentials = await getCredentials(userId);
    
    res.json({
      success: true,
      hasCredentials: !!credentials,
      providers: credentials ? {
        aws: !!credentials.aws,
        azure: !!credentials.azure,
        gcp: !!credentials.gcp,
      } : null,
    });
  } catch (error) {
    res.status(500).json({ error: 'Credentials test failed' });
  }
});

/**
 * GET /api/test/cache
 * Get cache statistics for user
 */
router.get('/cache', authenticateUser, async (req, res) => {
  try {
    const userId = req.userId!;
    const stats = await getUserCacheStats(userId);
    
    const awsRefresh = getTimeUntilRefresh(userId, 'aws');
    const azureRefresh = getTimeUntilRefresh(userId, 'azure');
    const gcpRefresh = getTimeUntilRefresh(userId, 'gcp');
    
    res.json({
      success: true,
      cacheStats: stats,
      nextRefresh: {
        aws: {
          hours: awsRefresh.hours,
          minutes: awsRefresh.minutes,
          time: awsRefresh.nextRefreshTime,
        },
        azure: {
          hours: azureRefresh.hours,
          minutes: azureRefresh.minutes,
          time: azureRefresh.nextRefreshTime,
        },
        gcp: {
          hours: gcpRefresh.hours,
          minutes: gcpRefresh.minutes,
          time: gcpRefresh.nextRefreshTime,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Cache test failed' });
  }
});

/**
 * GET /api/test/chat-history
 * Get chat history stats
 */
router.get('/chat-history', authenticateUser, async (req, res) => {
  try {
    const userId = req.userId!;
    const metadata = await getConversationMetadata(userId);
    
    res.json({
      success: true,
      metadata,
    });
  } catch (error) {
    res.status(500).json({ error: 'Chat history test failed' });
  }
});

/**
 * GET /api/test/full
 * Full system test
 */
router.get('/full', authenticateUser, async (req, res) => {
  try {
    const userId = req.userId!;
    
    // Check auth
    const authStatus = {
      authenticated: true,
      userId,
      email: req.userEmail,
      provider: req.authProvider,
    };
    
    // Check credentials
    const credentials = await getCredentials(userId);
    const credStatus = {
      hasCredentials: !!credentials,
      providers: credentials ? {
        aws: !!credentials.aws,
        azure: !!credentials.azure,
        gcp: !!credentials.gcp,
      } : null,
    };
    
    // Check cache
    const cacheStats = await getUserCacheStats(userId);
    
    // Check chat history
    const chatMetadata = await getConversationMetadata(userId);
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      tests: {
        authentication: { status: 'PASS', data: authStatus },
        credentials: { status: 'PASS', data: credStatus },
        cache: { status: 'PASS', data: cacheStats },
        chatHistory: { status: 'PASS', data: chatMetadata },
      },
      overall: 'ALL SYSTEMS OPERATIONAL',
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: 'System test failed',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;

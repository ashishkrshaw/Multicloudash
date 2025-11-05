/**
 * Credentials API Routes
 * Secure endpoints for storing and retrieving encrypted cloud credentials
 */

import express from 'express';
import { authenticateUser } from '../middleware/auth.js';
import { credentialLimiter } from '../middleware/security.js';
import {
  storeCredentials,
  getCredentials,
  deleteCredentials,
  hasCredentials,
} from '../utils/credentialStore.js';

const router = express.Router();

// Apply rate limiting to all credential routes
router.use(credentialLimiter);

/**
 * POST /api/credentials
 * Store encrypted credentials for authenticated user
 */
router.post('/', authenticateUser, async (req, res) => {
  try {
    const userId = req.userId!;
    const { aws, azure, gcp } = req.body;

    // Validate that at least one credential is provided
    if (!aws && !azure && !gcp) {
      return res.status(400).json({ error: 'At least one cloud credential is required' });
    }

    // Validate format (should be base64 strings)
    const validateBase64 = (str: string) => {
      try {
        return Buffer.from(str, 'base64').toString('base64') === str;
      } catch {
        return false;
      }
    };

    if (aws && !validateBase64(aws)) {
      return res.status(400).json({ error: 'Invalid AWS credential format' });
    }

    if (azure && !validateBase64(azure)) {
      return res.status(400).json({ error: 'Invalid Azure credential format' });
    }

    if (gcp && !validateBase64(gcp)) {
      return res.status(400).json({ error: 'Invalid GCP credential format' });
    }

    // Store encrypted credentials
    await storeCredentials(userId, { aws, azure, gcp });

    console.log(`[Credentials] Stored for user ${req.userEmail} (${userId})`);
    
    return res.json({
      success: true,
      message: 'Credentials stored successfully',
      providers: {
        aws: !!aws,
        azure: !!azure,
        gcp: !!gcp,
      },
    });
  } catch (error) {
    console.error('[Credentials] Store error:', error);
    return res.status(500).json({ error: 'Failed to store credentials' });
  }
});

/**
 * GET /api/credentials
 * Retrieve encrypted credentials for authenticated user
 */
router.get('/', authenticateUser, async (req, res) => {
  try {
    const userId = req.userId!;
    
    const credentials = await getCredentials(userId);
    
    if (!credentials) {
      return res.json({
        success: true,
        credentials: null,
        hasCredentials: false,
      });
    }

    return res.json({
      success: true,
      credentials,
      hasCredentials: true,
      providers: {
        aws: !!credentials.aws,
        azure: !!credentials.azure,
        gcp: !!credentials.gcp,
      },
    });
  } catch (error) {
    console.error('[Credentials] Get error:', error);
    return res.status(500).json({ error: 'Failed to retrieve credentials' });
  }
});

/**
 * DELETE /api/credentials/:provider
 * Delete credentials for a specific provider
 */
router.delete('/:provider', authenticateUser, async (req, res) => {
  try {
    const userId = req.userId!;
    const { provider } = req.params;

    if (!['aws', 'azure', 'gcp'].includes(provider)) {
      return res.status(400).json({ error: 'Invalid provider' });
    }

    const credentials = await getCredentials(userId);
    if (!credentials) {
      return res.status(404).json({ error: 'No credentials found' });
    }

    // Remove specific provider
    const updated = { ...credentials };
    delete updated[provider as keyof typeof updated];

    if (Object.keys(updated).length === 0) {
      // If no credentials left, delete entire entry
      await deleteCredentials(userId);
    } else {
      await storeCredentials(userId, updated);
    }

    console.log(`[Credentials] Deleted ${provider} for user ${req.userEmail}`);

    return res.json({
      success: true,
      message: `${provider.toUpperCase()} credentials deleted`,
    });
  } catch (error) {
    console.error('[Credentials] Delete error:', error);
    return res.status(500).json({ error: 'Failed to delete credentials' });
  }
});

/**
 * DELETE /api/credentials
 * Delete all credentials for authenticated user
 */
router.delete('/', authenticateUser, async (req, res) => {
  try {
    const userId = req.userId!;
    
    const deleted = await deleteCredentials(userId);
    
    if (!deleted) {
      return res.status(404).json({ error: 'No credentials found' });
    }

    console.log(`[Credentials] Deleted all for user ${req.userEmail}`);

    return res.json({
      success: true,
      message: 'All credentials deleted',
    });
  } catch (error) {
    console.error('[Credentials] Delete all error:', error);
    return res.status(500).json({ error: 'Failed to delete credentials' });
  }
});

/**
 * GET /api/credentials/status
 * Check if user has credentials stored
 */
router.get('/status', authenticateUser, async (req, res) => {
  try {
    const userId = req.userId!;
    const has = await hasCredentials(userId);
    
    return res.json({
      success: true,
      hasCredentials: has,
    });
  } catch (error) {
    console.error('[Credentials] Status error:', error);
    return res.status(500).json({ error: 'Failed to check credentials' });
  }
});

export default router;

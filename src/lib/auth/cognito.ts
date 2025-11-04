/**
 * AWS Cognito Authentication Service
 * Handles user sign-up, sign-in, and session management with Cognito
 */

import { calculateSecretHash, getCognitoConfig } from './cognitoSecretHash';

export interface CognitoUser {
  username: string;
  email: string;
  sub: string;
  email_verified: boolean;
}

export interface CognitoTokens {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  expiresIn: number;
}

const COGNITO_REGION = import.meta.env.VITE_AWS_COGNITO_REGION;
const USER_POOL_ID = import.meta.env.VITE_AWS_COGNITO_USER_POOL_ID;
const CLIENT_ID = import.meta.env.VITE_AWS_COGNITO_CLIENT_ID;
const CLIENT_SECRET = import.meta.env.VITE_AWS_COGNITO_CLIENT_SECRET;

function getCognitoEndpoint(): string {
  return `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/`;
}

/**
 * Sign up a new user with Cognito
 */
export async function signUpWithCognito(
  username: string,
  email: string,
  password: string,
  name?: string
): Promise<{ userSub: string; needsConfirmation: boolean }> {
  if (!CLIENT_ID || CLIENT_ID.includes('placeholder')) {
    throw new Error('AWS Cognito not configured. Please set VITE_AWS_COGNITO_CLIENT_ID in .env');
  }

  const requestBody: any = {
    ClientId: CLIENT_ID,
    Username: username,
    Password: password,
    UserAttributes: [
      { Name: 'email', Value: email },
      { Name: 'preferred_username', Value: username },
    ],
  };

  // Add name if provided
  if (name) {
    requestBody.UserAttributes.push({ Name: 'name', Value: name });
  }

  // Add SECRET_HASH if client secret is configured
  if (CLIENT_SECRET && !CLIENT_SECRET.includes('PASTE')) {
    requestBody.SecretHash = await calculateSecretHash(username, CLIENT_ID, CLIENT_SECRET);
  }

  const response = await fetch(getCognitoEndpoint(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': 'AWSCognitoIdentityProviderService.SignUp',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Sign up failed');
  }

  const data = await response.json();
  
  return {
    userSub: data.UserSub,
    needsConfirmation: !data.UserConfirmed,
  };
}

/**
 * Confirm user sign-up with verification code
 */
export async function confirmSignUp(username: string, code: string): Promise<void> {
  const requestBody: any = {
    ClientId: CLIENT_ID,
    Username: username,
    ConfirmationCode: code,
  };

  // Add SECRET_HASH if client secret is configured
  if (CLIENT_SECRET && !CLIENT_SECRET.includes('PASTE')) {
    requestBody.SecretHash = await calculateSecretHash(username, CLIENT_ID, CLIENT_SECRET);
  }

  const response = await fetch(getCognitoEndpoint(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': 'AWSCognitoIdentityProviderService.ConfirmSignUp',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Confirmation failed');
  }
}

/**
 * Sign in with username and password
 */
export async function signInWithCognito(
  username: string,
  password: string
): Promise<CognitoTokens> {
  if (!CLIENT_ID || CLIENT_ID.includes('placeholder')) {
    throw new Error('AWS Cognito not configured. Please set VITE_AWS_COGNITO_CLIENT_ID in .env');
  }

  const authParameters: any = {
    USERNAME: username,
    PASSWORD: password,
  };

  // Add SECRET_HASH if client secret is configured
  if (CLIENT_SECRET && !CLIENT_SECRET.includes('PASTE')) {
    authParameters.SECRET_HASH = await calculateSecretHash(username, CLIENT_ID, CLIENT_SECRET);
  }

  const response = await fetch(getCognitoEndpoint(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
    },
    body: JSON.stringify({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: CLIENT_ID,
      AuthParameters: authParameters,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    const errorMessage = error.message || error.__type || 'Sign in failed';
    
    // Provide helpful error message for common issues
    if (errorMessage.includes('USER_PASSWORD_AUTH')) {
      throw new Error(
        'Authentication flow not enabled. Please enable ALLOW_USER_PASSWORD_AUTH in your Cognito app client settings. See COGNITO_AUTH_FLOW_FIX.md for instructions.'
      );
    }
    
    throw new Error(errorMessage);
  }

  const data = await response.json();
  const tokens: CognitoTokens = {
    accessToken: data.AuthenticationResult.AccessToken,
    idToken: data.AuthenticationResult.IdToken,
    refreshToken: data.AuthenticationResult.RefreshToken,
    expiresIn: data.AuthenticationResult.ExpiresIn,
  };

  // Store tokens
  localStorage.setItem('cognito_access_token', tokens.accessToken);
  localStorage.setItem('cognito_id_token', tokens.idToken);
  localStorage.setItem('cognito_refresh_token', tokens.refreshToken);
  localStorage.setItem('cognito_token_expiry', String(Date.now() + tokens.expiresIn * 1000));

  return tokens;
}

/**
 * Get current user from ID token
 */
export async function getCurrentCognitoUser(): Promise<CognitoUser | null> {
  const accessToken = localStorage.getItem('cognito_access_token');
  const expiry = localStorage.getItem('cognito_token_expiry');

  if (!accessToken || !expiry) {
    return null;
  }

  // Check if token expired
  if (Date.now() >= Number(expiry)) {
    await refreshCognitoToken();
    return getCurrentCognitoUser();
  }

  try {
    const response = await fetch(getCognitoEndpoint(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.GetUser',
      },
      body: JSON.stringify({
        AccessToken: accessToken,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    
    const getAttributeValue = (name: string) => {
      const attr = data.UserAttributes.find((a: any) => a.Name === name);
      return attr?.Value || '';
    };

    return {
      username: data.Username,
      email: getAttributeValue('email'),
      sub: getAttributeValue('sub'),
      email_verified: getAttributeValue('email_verified') === 'true',
    };
  } catch {
    return null;
  }
}

/**
 * Refresh access token using refresh token
 */
async function refreshCognitoToken(): Promise<void> {
  const refreshToken = localStorage.getItem('cognito_refresh_token');

  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  const authParameters: any = {
    REFRESH_TOKEN: refreshToken,
  };

  // Add SECRET_HASH if client secret is configured
  // For refresh token flow, we need to get the username from stored data
  if (CLIENT_SECRET && !CLIENT_SECRET.includes('PASTE')) {
    // Get current user to retrieve username for SECRET_HASH
    const idToken = localStorage.getItem('cognito_id_token');
    if (idToken) {
      try {
        // Decode ID token to get username (email)
        const payload = JSON.parse(atob(idToken.split('.')[1]));
        const username = payload['cognito:username'] || payload.email;
        if (username) {
          authParameters.SECRET_HASH = await calculateSecretHash(username, CLIENT_ID, CLIENT_SECRET);
        }
      } catch (e) {
        console.warn('Failed to decode ID token for SECRET_HASH:', e);
      }
    }
  }

  const response = await fetch(getCognitoEndpoint(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
    },
    body: JSON.stringify({
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      ClientId: CLIENT_ID,
      AuthParameters: authParameters,
    }),
  });

  if (!response.ok) {
    throw new Error('Token refresh failed');
  }

  const data = await response.json();
  localStorage.setItem('cognito_access_token', data.AuthenticationResult.AccessToken);
  localStorage.setItem('cognito_id_token', data.AuthenticationResult.IdToken);
  localStorage.setItem(
    'cognito_token_expiry',
    String(Date.now() + data.AuthenticationResult.ExpiresIn * 1000)
  );
}

/**
 * Request password reset
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const requestBody: any = {
    ClientId: CLIENT_ID,
    Username: email,
  };

  // Add SECRET_HASH if client secret is configured
  if (CLIENT_SECRET && !CLIENT_SECRET.includes('PASTE')) {
    requestBody.SecretHash = await calculateSecretHash(email, CLIENT_ID, CLIENT_SECRET);
  }

  const response = await fetch(getCognitoEndpoint(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': 'AWSCognitoIdentityProviderService.ForgotPassword',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Password reset request failed');
  }
}

/**
 * Confirm password reset with code
 */
export async function confirmPasswordReset(
  email: string,
  code: string,
  newPassword: string
): Promise<void> {
  const requestBody: any = {
    ClientId: CLIENT_ID,
    Username: email,
    ConfirmationCode: code,
    Password: newPassword,
  };

  // Add SECRET_HASH if client secret is configured
  if (CLIENT_SECRET && !CLIENT_SECRET.includes('PASTE')) {
    requestBody.SecretHash = await calculateSecretHash(email, CLIENT_ID, CLIENT_SECRET);
  }

  const response = await fetch(getCognitoEndpoint(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': 'AWSCognitoIdentityProviderService.ConfirmForgotPassword',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Password reset confirmation failed');
  }
}

/**
 * Sign out and clear tokens
 */
export function signOutCognito(): void {
  localStorage.removeItem('cognito_access_token');
  localStorage.removeItem('cognito_id_token');
  localStorage.removeItem('cognito_refresh_token');
  localStorage.removeItem('cognito_token_expiry');
}

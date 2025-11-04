/**
 * Cognito SECRET_HASH Calculator
 * Required when using a Cognito app client with a client secret
 */

/**
 * Calculate the SECRET_HASH for AWS Cognito authentication
 * Formula: Base64(HMAC_SHA256(username + clientId, clientSecret))
 * 
 * @param username - The username or email
 * @param clientId - Cognito App Client ID
 * @param clientSecret - Cognito App Client Secret
 * @returns Base64 encoded SECRET_HASH
 */
export async function calculateSecretHash(
  username: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  // Create the message to hash: username + clientId
  const message = username + clientId;
  
  // Convert client secret and message to Uint8Array
  const encoder = new TextEncoder();
  const keyData = encoder.encode(clientSecret);
  const messageData = encoder.encode(message);
  
  // Import the secret as a CryptoKey for HMAC-SHA256
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  // Calculate HMAC-SHA256
  const signature = await crypto.subtle.sign('HMAC', key, messageData);
  
  // Convert to Base64
  const hashArray = Array.from(new Uint8Array(signature));
  const hashBase64 = btoa(String.fromCharCode(...hashArray));
  
  return hashBase64;
}

/**
 * Get Cognito credentials from environment
 */
export function getCognitoConfig() {
  const clientId = import.meta.env.VITE_AWS_COGNITO_CLIENT_ID;
  const clientSecret = import.meta.env.VITE_AWS_COGNITO_CLIENT_SECRET;
  const userPoolId = import.meta.env.VITE_AWS_COGNITO_USER_POOL_ID;
  const region = import.meta.env.VITE_AWS_COGNITO_REGION;

  if (!clientId || !userPoolId || !region) {
    throw new Error('Cognito configuration missing in environment variables');
  }

  return {
    clientId,
    clientSecret,
    userPoolId,
    region,
    hasSecret: !!clientSecret,
  };
}

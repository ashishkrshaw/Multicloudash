import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { 
  generateEncryptionKey, 
  encryptData as cryptoEncrypt, 
  decryptData as cryptoDecrypt,
  exportKey,
  importKey
} from "@/lib/crypto";

export interface CloudCredentials {
  aws?: {
    accessKeyId: string;
    secretAccessKey: string;
    region?: string;
  };
  azure?: {
    subscriptionId: string;
    clientId: string;
    clientSecret: string;
    tenantId: string;
  };
  gcp?: {
    projectId: string;
    privateKey: string;
    clientEmail: string;
  };
}

interface CredentialsContextType {
  hasAwsCredentials: boolean;
  hasAzureCredentials: boolean;
  hasGcpCredentials: boolean;
  setCredentials: (provider: "aws" | "azure" | "gcp", creds: any) => Promise<void>;
  clearCredentials: (provider: "aws" | "azure" | "gcp") => Promise<void>;
  getEncryptedCredentials: () => CloudCredentials;
  isLoading: boolean;
}

const CredentialsContext = createContext<CredentialsContextType | undefined>(undefined);

export const useCredentials = () => {
  const context = useContext(CredentialsContext);
  if (!context) {
    throw new Error("useCredentials must be used within a CredentialsProvider");
  }
  return context;
};

// Hook to check if we should show mock data
export const useShouldShowMockData = (provider: "aws" | "azure" | "gcp") => {
  const credentials = useCredentials();
  const hasCredentialsMap = {
    aws: credentials.hasAwsCredentials,
    azure: credentials.hasAzureCredentials,
    gcp: credentials.hasGcpCredentials,
  };
  return !hasCredentialsMap[provider];
};

// Encryption key management - stored per user session
let encryptionKey: CryptoKey | null = null;

const getOrCreateEncryptionKey = async (): Promise<CryptoKey> => {
  if (encryptionKey) return encryptionKey;

  // Try to load existing key from localStorage
  const storedKey = localStorage.getItem('encryption_key');
  if (storedKey) {
    try {
      encryptionKey = await importKey(storedKey);
      return encryptionKey;
    } catch (error) {
      console.error('Failed to import encryption key:', error);
    }
  }

  // Generate new key if none exists
  encryptionKey = await generateEncryptionKey();
  const exported = await exportKey(encryptionKey);
  localStorage.setItem('encryption_key', exported);
  
  return encryptionKey;
};

// Secure encryption helpers using Web Crypto API
const encryptData = async (data: string): Promise<string> => {
  const key = await getOrCreateEncryptionKey();
  return await cryptoEncrypt(data, key);
};

const decryptData = async (encrypted: string): Promise<string> => {
  try {
    const key = await getOrCreateEncryptionKey();
    return await cryptoDecrypt(encrypted, key);
  } catch (error) {
    console.error("Failed to decrypt:", error);
    return "";
  }
};

const STORAGE_KEY = "cloudctrl_encrypted_creds";

export const CredentialsProvider = ({ children }: { children: ReactNode }) => {
  const [credentials, setCredentialsState] = useState<CloudCredentials>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadCredentials = async () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const decrypted = await decryptData(stored);
          setCredentialsState(JSON.parse(decrypted));
        }
      } catch (error) {
        console.error("Failed to load credentials:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadCredentials();
  }, []);

  const setCredentials = async (provider: "aws" | "azure" | "gcp", creds: any) => {
    const updated = { ...credentials, [provider]: creds };
    setCredentialsState(updated);

    // Encrypt and store locally
    const encrypted = await encryptData(JSON.stringify(updated));
    localStorage.setItem(STORAGE_KEY, encrypted);

    // Sync to backend if user is authenticated
    try {
      // Get ID token (used for authentication, not access token)
      const googleToken = localStorage.getItem('google_id_token');
      const cognitoToken = localStorage.getItem('cognito_id_token');
      const token = googleToken || cognitoToken;
      
      if (token) {
        // Backend expects base64-encoded JSON (NOT encrypted)
        // Encode credentials as base64 for backend storage
        const base64Encoded = btoa(JSON.stringify(creds));
        
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/credentials`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ [provider]: base64Encoded }),
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          throw new Error(errorBody.error || `Failed to save credentials: ${response.status}`);
        }

        console.log(`✅ ${provider.toUpperCase()} credentials saved to backend`);
      }
    } catch (error) {
      console.error('Failed to sync credentials to backend:', error);
      throw error; // Re-throw so UI can show error
    }
  };

  const clearCredentials = async (provider: "aws" | "azure" | "gcp") => {
    const updated = { ...credentials };
    delete updated[provider];
    setCredentialsState(updated);

    const encrypted = await encryptData(JSON.stringify(updated));
    localStorage.setItem(STORAGE_KEY, encrypted);

    // Sync to backend
    try {
      // Get ID token (used for authentication, not access token)
      const googleToken = localStorage.getItem('google_id_token');
      const cognitoToken = localStorage.getItem('cognito_id_token');
      const token = googleToken || cognitoToken;
      
      if (token) {
        await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/credentials/${provider}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
      }
    } catch (error) {
      console.error('Failed to delete credentials from backend:', error);
    }
  };

  const getEncryptedCredentials = (): CloudCredentials => {
    return credentials;
  };

  return (
    <CredentialsContext.Provider
      value={{
        hasAwsCredentials: !!credentials.aws,
        hasAzureCredentials: !!credentials.azure,
        hasGcpCredentials: !!credentials.gcp,
        setCredentials,
        clearCredentials,
        getEncryptedCredentials,
        isLoading,
      }}
    >
      {children}
    </CredentialsContext.Provider>
  );
};

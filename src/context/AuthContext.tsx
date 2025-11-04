import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { 
  initiateGoogleSignIn, 
  getCurrentGoogleUser, 
  signOutGoogle,
  type GoogleUser 
} from "@/lib/auth/google";
import { 
  signInWithCognito, 
  signUpWithCognito, 
  confirmSignUp as cognitoConfirmSignUp,
  getCurrentCognitoUser, 
  signOutCognito,
  type CognitoUser 
} from "@/lib/auth/cognito";
import { startTokenRefresh, stopTokenRefresh } from "@/lib/auth/tokenRefresh";

export interface User {
  id: string;
  email: string;
  name?: string;
  provider: "google" | "cognito";
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (provider: "google" | "email", credentials?: { username: string; password: string }) => Promise<void>;
  signUp: (username: string, email: string, password: string, name?: string) => Promise<void>;
  confirmSignUp: (username: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session from Google or Cognito
    const checkSession = async () => {
      try {
        // Try Google first
        const googleUser = await getCurrentGoogleUser();
        if (googleUser) {
          const user: User = {
            id: googleUser.id,
            email: googleUser.email,
            name: googleUser.name,
            provider: "google",
          };
          setUser(user);
          localStorage.setItem("cloudctrl_user", JSON.stringify(user));
          
          // Start token refresh
          startTokenRefresh();
          return;
        }

        // Try Cognito
        const cognitoUser = await getCurrentCognitoUser();
        if (cognitoUser) {
          const user: User = {
            id: cognitoUser.sub,
            email: cognitoUser.email,
            name: cognitoUser.username,
            provider: "cognito",
          };
          setUser(user);
          localStorage.setItem("cloudctrl_user", JSON.stringify(user));
          
          // Start token refresh
          startTokenRefresh();
          return;
        }

        // No active session
        localStorage.removeItem("cloudctrl_user");
      } catch (error) {
        console.error("Failed to restore session:", error);
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();

    // Cleanup on unmount
    return () => {
      stopTokenRefresh();
    };
  }, []);

  const signIn = async (provider: "google" | "email", credentials?: { username: string; password: string }) => {
    setIsLoading(true);
    try {
      if (provider === "google") {
        // Initiate Google OAuth flow (will redirect)
        await initiateGoogleSignIn();
        // Note: User will be redirected, so this won't complete here
      } else if (provider === "email" && credentials) {
        // Sign in with Cognito
        await signInWithCognito(credentials.username, credentials.password);
        
        // Get user info
        const cognitoUser = await getCurrentCognitoUser();
        if (cognitoUser) {
          const user: User = {
            id: cognitoUser.sub,
            email: cognitoUser.email,
            name: cognitoUser.username,
            provider: "cognito",
          };
          setUser(user);
          localStorage.setItem("cloudctrl_user", JSON.stringify(user));
        }
      }
    } catch (error) {
      console.error("Sign-in failed:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (username: string, email: string, password: string, name?: string) => {
    setIsLoading(true);
    try {
      // Sign up with Cognito
      const result = await signUpWithCognito(username, email, password, name);
      
      if (result.needsConfirmation) {
        // User needs to verify email - don't throw error, just return
        // The UI will handle showing the verification code input
        return;
      }

      // Auto sign-in after successful signup (if no confirmation needed)
      await signIn("email", { username, password });
    } catch (error) {
      console.error("Sign-up failed:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const confirmSignUp = async (username: string, code: string) => {
    setIsLoading(true);
    try {
      // Confirm the sign-up with the verification code
      await cognitoConfirmSignUp(username, code);
    } catch (error) {
      console.error("Verification failed:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      // Stop token refresh
      stopTokenRefresh();
      
      // Sign out from both providers
      signOutGoogle();
      signOutCognito();
      
      // Clear local state
      localStorage.removeItem("cloudctrl_user");
      setUser(null);
    } catch (error) {
      console.error("Sign-out failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        signIn,
        signUp,
        confirmSignUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

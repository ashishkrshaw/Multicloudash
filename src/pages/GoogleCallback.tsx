import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { handleGoogleCallback } from "@/lib/auth/google";
import { Loader2 } from "lucide-react";

export default function GoogleCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    const processCallback = async () => {
      try {
        console.log("[GoogleCallback] Processing OAuth callback...");
        console.log("[GoogleCallback] URL:", window.location.href);
        
        // Get authorization code from URL
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        const errorParam = params.get("error");

        console.log("[GoogleCallback] Code:", code ? "present" : "missing");
        console.log("[GoogleCallback] Error param:", errorParam);

        if (errorParam) {
          const errorMessage = `OAuth error: ${errorParam}`;
          console.error("[GoogleCallback]", errorMessage);
          setError(errorMessage);
          setProcessing(false);
          setTimeout(() => navigate("/"), 3000);
          return;
        }

        if (!code) {
          const errorMessage = "No authorization code received";
          console.error("[GoogleCallback]", errorMessage);
          setError(errorMessage);
          setProcessing(false);
          setTimeout(() => navigate("/"), 3000);
          return;
        }

        console.log("[GoogleCallback] Exchanging code for tokens...");
        // Exchange code for tokens and get user
        const googleUser = await handleGoogleCallback(code);
        console.log("[GoogleCallback] User authenticated:", googleUser.email);

        // Store user in localStorage
        const user = {
          id: googleUser.id,
          email: googleUser.email,
          name: googleUser.name,
          provider: "google" as const,
        };
        localStorage.setItem("cloudctrl_user", JSON.stringify(user));
        console.log("[GoogleCallback] User stored in localStorage");

        // Small delay to ensure storage is written
        await new Promise(resolve => setTimeout(resolve, 100));

        // Redirect to dashboard
        console.log("[GoogleCallback] Redirecting to dashboard...");
        navigate("/");
        
        // Reload to trigger auth context update
        setTimeout(() => {
          window.location.reload();
        }, 100);
      } catch (err) {
        console.error("[GoogleCallback] Error processing callback:", err);
        const errorMessage = err instanceof Error ? err.message : "Authentication failed";
        setError(errorMessage);
        setProcessing(false);
        setTimeout(() => navigate("/"), 3000);
      }
    };

    processCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4 p-6">
        {error ? (
          <>
            <div className="text-destructive text-lg font-semibold">{error}</div>
            <div className="text-muted-foreground">Redirecting to homepage...</div>
          </>
        ) : processing ? (
          <>
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <div className="text-lg font-semibold">Completing sign-in...</div>
            <div className="text-muted-foreground">Please wait</div>
          </>
        ) : (
          <>
            <div className="text-lg font-semibold text-success">Sign-in successful!</div>
            <div className="text-muted-foreground">Redirecting...</div>
          </>
        )}
      </div>
    </div>
  );
}

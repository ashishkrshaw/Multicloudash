import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { handleOAuthCallback } from "@/lib/auth/google";
import { Loader2 } from "lucide-react";

export default function GoogleCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    const processCallback = async () => {
      try {
        console.log("[GoogleCallback] Processing OAuth callback from backend...");
        console.log("[GoogleCallback] URL:", window.location.href);
        
        // Handle OAuth callback - backend already processed the code exchange
        const user = await handleOAuthCallback();

        if (!user) {
          const params = new URLSearchParams(window.location.search);
          const errorParam = params.get('error');
          const errorMessage = errorParam || "Authentication failed - no user data received";
          console.error("[GoogleCallback]", errorMessage);
          setError(errorMessage);
          setProcessing(false);
          setTimeout(() => navigate("/"), 3000);
          return;
        }

        console.log("[GoogleCallback] User authenticated:", user.email);
        setProcessing(false);

        // Redirect to dashboard
        console.log("[GoogleCallback] Redirecting to dashboard...");
        setTimeout(() => {
          navigate("/");
          window.location.reload();
        }, 500);
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

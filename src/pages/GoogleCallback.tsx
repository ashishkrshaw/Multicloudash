import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { handleGoogleCallback } from "@/lib/auth/google";
import { Loader2 } from "lucide-react";

export default function GoogleCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processCallback = async () => {
      try {
        // Get authorization code from URL
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        const errorParam = params.get("error");

        if (errorParam) {
          setError(`OAuth error: ${errorParam}`);
          setTimeout(() => navigate("/"), 3000);
          return;
        }

        if (!code) {
          setError("No authorization code received");
          setTimeout(() => navigate("/"), 3000);
          return;
        }

        // Exchange code for tokens and get user
        const googleUser = await handleGoogleCallback(code);

        // Store user in localStorage
        const user = {
          id: googleUser.id,
          email: googleUser.email,
          name: googleUser.name,
          provider: "google" as const,
        };
        localStorage.setItem("cloudctrl_user", JSON.stringify(user));

        // Redirect to dashboard
        navigate("/");
        
        // Reload to trigger auth context update
        window.location.reload();
      } catch (err) {
        console.error("Google callback error:", err);
        setError(err instanceof Error ? err.message : "Authentication failed");
        setTimeout(() => navigate("/"), 3000);
      }
    };

    processCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        {error ? (
          <>
            <div className="text-destructive text-lg font-semibold">{error}</div>
            <div className="text-muted-foreground">Redirecting to homepage...</div>
          </>
        ) : (
          <>
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <div className="text-lg font-semibold">Completing sign-in...</div>
            <div className="text-muted-foreground">Please wait</div>
          </>
        )}
      </div>
    </div>
  );
}

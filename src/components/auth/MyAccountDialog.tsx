import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Mail, AlertCircle } from "lucide-react";
import { GoogleIcon } from "@/components/ui/google-icon";

interface MyAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const MyAccountDialog = ({ open, onOpenChange }: MyAccountDialogProps) => {
  const { user, isAuthenticated, signIn, signUp, confirmSignUp, signOut, isLoading } = useAuth();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [awaitingVerification, setAwaitingVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationUsername, setVerificationUsername] = useState("");
  const [verificationPassword, setVerificationPassword] = useState("");

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      await signIn("google");
      // Will redirect, so no need to stop loading
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
      setLoading(false);
    }
  };

  const handleEmailSignIn = async () => {
    setError(null);
    if (!username || !password) {
      setError("Username and password are required");
      return;
    }
    setLoading(true);
    try {
      await signIn("email", { username, password });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    setError(null);
    if (!username || !email || !password || !confirmPassword) {
      setError("All fields are required");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    // Username validation
    if (username.length < 3) {
      setError("Username must be at least 3 characters");
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setError("Username can only contain letters, numbers, and underscores");
      return;
    }
    setLoading(true);
    try {
      await signUp(username, email, password, name);
      // If we reach here, sign-up initiated successfully
      // Save credentials for later auto sign-in
      setVerificationUsername(username);
      setVerificationPassword(password);
      setAwaitingVerification(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-up failed");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    setError(null);
    if (!verificationCode || verificationCode.length !== 6) {
      setError("Please enter the 6-digit verification code");
      return;
    }
    setLoading(true);
    try {
      await confirmSignUp(verificationUsername, verificationCode);
      // Auto sign-in after successful verification
      await signIn("email", { username: verificationUsername, password: verificationPassword });
      // Reset states
      setAwaitingVerification(false);
      setVerificationCode("");
      setVerificationUsername("");
      setVerificationPassword("");
      setUsername("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setName("");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setError(null);
    setLoading(true);
    try {
      // Resend by initiating sign-up again
      await signUp(verificationUsername, email, verificationPassword, name);
      setError("Verification code resent! Please check your email.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend code");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await signOut();
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  if (isAuthenticated && user) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>My Account</DialogTitle>
            <DialogDescription>Manage your CloudCTRL account</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <div className="rounded-lg border bg-muted/50 p-3 text-sm">{user.email}</div>
            </div>
            {user.name && (
              <div className="space-y-2">
                <Label>Name</Label>
                <div className="rounded-lg border bg-muted/50 p-3 text-sm">{user.name}</div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Provider</Label>
              <div className="rounded-lg border bg-muted/50 p-3 text-sm capitalize">
                {user.provider === "google" ? "Google OAuth" : "Email/Password"}
              </div>
            </div>
            <Button onClick={handleSignOut} variant="destructive" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing out...
                </>
              ) : (
                "Sign Out"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle>Sign In to CloudCTRL</DialogTitle>
          <DialogDescription>Sign in to securely store your cloud credentials</DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 -mx-6 px-6">
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="space-y-4 mt-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

            <Button
              onClick={handleGoogleSignIn}
              variant="outline"
              className="w-full gap-2 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Redirecting...
                </>
              ) : (
                <>
                  <GoogleIcon className="h-5 w-5" />
                  <span className="font-medium">Sign in with Google</span>
                </>
              )}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="signin-username">Username</Label>
                <Input
                  id="signin-username"
                  type="text"
                  placeholder="your_username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signin-password">Password</Label>
                <Input
                  id="signin-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  onKeyDown={(e) => e.key === 'Enter' && handleEmailSignIn()}
                />
              </div>
              <Button onClick={handleEmailSignIn} className="w-full gap-2" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4" />
                    Sign In
                  </>
                )}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="signup" className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {awaitingVerification ? (
              // Show verification code input
              <div className="space-y-4">
                <Alert>
                  <Mail className="h-4 w-4" />
                  <AlertDescription>
                    We've sent a verification code to your email. 
                    Please check your inbox and enter the code below.
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <Label htmlFor="verification-code">Verification Code</Label>
                  <Input
                    id="verification-code"
                    type="text"
                    placeholder="Enter 6-digit code"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    disabled={loading}
                    maxLength={6}
                    onKeyDown={(e) => e.key === 'Enter' && handleVerifyCode()}
                    className="text-center text-2xl tracking-widest"
                  />
                </div>

                <Button onClick={handleVerifyCode} className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    "Verify Email"
                  )}
                </Button>

                <Button 
                  onClick={handleResendCode} 
                  variant="outline" 
                  className="w-full" 
                  disabled={loading}
                >
                  Resend Code
                </Button>

                <Button 
                  onClick={() => {
                    setAwaitingVerification(false);
                    setVerificationCode("");
                    setError(null);
                  }} 
                  variant="ghost" 
                  className="w-full"
                  disabled={loading}
                >
                  Back to Sign Up
                </Button>
              </div>
            ) : (
              // Show sign-up form
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="signup-username">Username *</Label>
                  <Input
                    id="signup-username"
                    type="text"
                    placeholder="your_username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    disabled={loading}
                  />
                  <p className="text-xs text-muted-foreground">
                    3+ characters, letters, numbers, and underscores only
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email *</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Name (optional)</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="Your full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password *</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                  />
                  <p className="text-xs text-muted-foreground">
                    Minimum 8 characters
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-confirm-password">Confirm Password *</Label>
                  <Input
                    id="signup-confirm-password"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={loading}
                    onKeyDown={(e) => e.key === 'Enter' && handleSignUp()}
                  />
                </div>
                <Button onClick={handleSignUp} className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    "Create Account"
                  )}
                </Button>
              </div>
            )}

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or</span>
              </div>
            </div>

            <Button
              onClick={handleGoogleSignIn}
              variant="outline"
              className="w-full gap-2 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors"
              disabled={isLoading || awaitingVerification}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Redirecting...
                </>
              ) : (
                <>
                  <GoogleIcon className="h-5 w-5" />
                  <span className="font-medium">Sign up with Google</span>
                </>
              )}
            </Button>
          </TabsContent>
        </Tabs>

        <p className="text-center text-xs text-muted-foreground mt-4 pb-2">
          Your credentials are encrypted and stored securely in your browser.
        </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

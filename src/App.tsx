import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useState } from "react";
import Index from "./pages/Index";
import AwsPage from "./pages/AwsPage";
import AzurePage from "./pages/AzurePage";
import GcpPage from "./pages/GcpPage";
import GoogleCallback from "./pages/GoogleCallback";
import NotFound from "./pages/NotFound";
import { CurrencyProvider } from "@/context/CurrencyContext";
import { AuthProvider } from "@/context/AuthContext";
import { CredentialsProvider } from "@/context/CredentialsContext";
import { SplashScreen } from "@/components/layout/SplashScreen";

const queryClient = new QueryClient();

const App = () => {
  const [showSplash, setShowSplash] = useState(true);

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  return (
    <AuthProvider>
      <CredentialsProvider>
        <CurrencyProvider>
          <QueryClientProvider client={queryClient}>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/aws" element={<AwsPage />} />
                  <Route path="/azure" element={<AzurePage />} />
                  <Route path="/gcp" element={<GcpPage />} />
                  <Route path="/auth/callback/google" element={<GoogleCallback />} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </TooltipProvider>
          </QueryClientProvider>
        </CurrencyProvider>
      </CredentialsProvider>
    </AuthProvider>
  );
};

export default App;

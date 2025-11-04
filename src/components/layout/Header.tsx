import { useState } from "react";
import { Cloud, Loader2, Sparkles, User, Settings, Menu } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  SUPPORTED_CURRENCIES,
  useCurrency,
  type SupportedCurrency,
} from "@/context/CurrencyContext";
import { Button } from "@/components/ui/button";
import { AssistantPanel } from "@/components/assistant/AssistantPanel";
import { MyAccountDialog } from "@/components/auth/MyAccountDialog";
import { CloudCredentialsDialog } from "@/components/credentials/CloudCredentialsDialog";

export function Header() {
  const navLinks = [
    { to: "/", label: "Overview" },
    { to: "/aws", label: "AWS" },
    { to: "/azure", label: "Azure" },
    { to: "/gcp", label: "GCP" },
  ];

  const { currency, setCurrency, isLoading, lastUpdated, error } = useCurrency();
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [credentialsDialogOpen, setCredentialsDialogOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleCurrencyChange = (value: string) => {
    setCurrency(value as SupportedCurrency);
  };

  const lastUpdatedLabel = lastUpdated
    ? lastUpdated.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    : "—";

  return (
    <header className="border-b bg-card sticky top-0 z-50 shadow-sm">
      <div className="container mx-auto px-3 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-8">
            <NavLink to="/" className="flex items-center gap-2 sm:gap-3">
              <Cloud className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
              <div className="hidden sm:block">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Multi-Cloud Dashboard</h1>
                <p className="text-xs sm:text-sm text-muted-foreground">AWS · Azure · GCP Management</p>
              </div>
            </NavLink>
            
            {/* Mobile menu button */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64">
                <SheetHeader>
                  <SheetTitle>Navigation</SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col gap-2 mt-6">
                  {navLinks.map((link) => (
                    <NavLink
                      key={link.to}
                      to={link.to}
                      end
                      onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          "px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                        )
                      }
                    >
                      {link.label}
                    </NavLink>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>
            
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end
                  className={({ isActive }) =>
                    cn(
                      "px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    )
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>
          </div>
          
          <div className="flex items-center gap-1.5 sm:gap-3">
            <div className="hidden flex-col text-right text-xs text-muted-foreground lg:flex">
              <span className={cn(error && "text-destructive")}>
                {error ? "Rates unavailable" : isLoading ? "Rates refreshing" : "Rates updated"}
              </span>
              <span className={cn("font-medium text-foreground", error && "text-destructive")}>{lastUpdatedLabel}</span>
            </div>
            {isLoading && <Loader2 className="hidden h-4 w-4 animate-spin text-muted-foreground lg:inline-flex" />}
            <Button
              variant="outline"
              size="sm"
              className="hidden gap-2 rounded-xl border-border/70 bg-background/70 text-xs sm:text-sm font-medium text-foreground shadow-sm transition hover:border-primary hover:text-primary lg:flex"
              onClick={() => setAssistantOpen(true)}
            >
              <Sparkles className="h-4 w-4" />
              <span className="hidden xl:inline">Ask Copilot</span>
            </Button>
            <Select value={currency} onValueChange={handleCurrencyChange}>
              <SelectTrigger className="w-[80px] sm:w-[170px] rounded-xl border-border bg-background/60 text-xs sm:text-sm font-medium">
                <SelectValue placeholder="Currency" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-border bg-background/95 shadow-lg">
                {SUPPORTED_CURRENCIES.map((option) => (
                  <SelectItem key={option.code} value={option.code} className="flex flex-col gap-0.5">
                    <span className="text-xs sm:text-sm font-medium text-foreground">{option.symbol} {option.code}</span>
                    <span className="text-[10px] sm:text-xs text-muted-foreground hidden sm:inline">{option.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 sm:gap-2 rounded-xl border-border/70 bg-background/70 text-xs sm:text-sm font-medium text-foreground shadow-sm transition hover:border-primary hover:text-primary"
                >
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">Account</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setAccountDialogOpen(true)}>
                  <User className="mr-2 h-4 w-4" />
                  Account Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setCredentialsDialogOpen(true)}>
                  <Settings className="mr-2 h-4 w-4" />
                  Cloud Credentials
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="icon"
              className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full border border-border/70 text-foreground hover:bg-primary/10 hover:text-primary lg:hidden"
              onClick={() => setAssistantOpen(true)}
            >
              <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
          </div>
        </div>
      </div>
      <AssistantPanel open={assistantOpen} onOpenChange={setAssistantOpen} />
      <MyAccountDialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen} />
      <CloudCredentialsDialog open={credentialsDialogOpen} onOpenChange={setCredentialsDialogOpen} />
    </header>
  );
}

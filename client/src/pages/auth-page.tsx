// Referenced from blueprint:javascript_auth_all_persistance
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation, Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ShieldCheck, Building2, Loader2 } from "lucide-react";
import { SiAndroid, SiApple } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";
import guardTrackLogo from "@assets/GuardTrack Logo - Dynamic Blue Shades_1760219905891.png";

type CompanyLookup = {
  id: string;
  name: string;
  companyId: string;
};

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [companyCode, setCompanyCode] = useState("");
  const [resolvedCompany, setResolvedCompany] = useState<CompanyLookup | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // Mutation to lookup company by code
  const lookupCompanyMutation = useMutation({
    mutationFn: async (code: string): Promise<CompanyLookup> => {
      const response = await fetch(`/api/companies/lookup/${encodeURIComponent(code)}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Company not found");
      }
      return response.json();
    },
    onSuccess: (company) => {
      setResolvedCompany(company);
    },
    onError: (error: Error) => {
      setResolvedCompany(null);
      toast({
        title: "Company not found",
        description: "Please check your Company ID and try again.",
        variant: "destructive",
      });
    },
  });

  // Lookup company when code changes (with debounce effect)
  useEffect(() => {
    if (isSuperAdmin) {
      setResolvedCompany(null);
      return;
    }

    const trimmedCode = companyCode.trim();
    if (trimmedCode.length >= 3) {
      const timeoutId = setTimeout(() => {
        lookupCompanyMutation.mutate(trimmedCode);
      }, 500);
      return () => clearTimeout(timeoutId);
    } else {
      setResolvedCompany(null);
    }
  }, [companyCode, isSuperAdmin]);

  // Redirect if already logged in (using useEffect to avoid setState during render)
  useEffect(() => {
    if (user) {
      setLocation("/");
    }
  }, [user, setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isLogin) {
      // For super admin login, companyId is null; for company users, use the resolved company
      if (!isSuperAdmin && !resolvedCompany) {
        toast({
          title: "Company required",
          description: "Please enter a valid Company ID to log in.",
          variant: "destructive",
        });
        return;
      }
      
      loginMutation.mutate({ 
        username, 
        password, 
        companyId: isSuperAdmin ? null : resolvedCompany?.id || null
      });
    } else {
      registerMutation.mutate({
        username,
        password,
        firstName,
        lastName,
        role: 'guard',
      });
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-4">
            <div className="flex flex-col items-center gap-3">
              <img 
                src={guardTrackLogo} 
                alt="GuardTrack Logo" 
                className="h-10 w-auto"
                data-testid="img-guardtrack-logo"
              />
            </div>
            <CardDescription className="text-center">
              {isLogin ? "Sign in to your account" : "Create your account"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Company ID Input - only for login mode */}
              {isLogin && !isSuperAdmin && (
                <div className="space-y-2">
                  <Label htmlFor="companyCode">Company ID</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="companyCode"
                      data-testid="input-company-code"
                      type="text"
                      placeholder="e.g., DEMO999"
                      className="pl-10"
                      value={companyCode}
                      onChange={(e) => setCompanyCode(e.target.value.toUpperCase())}
                    />
                    {lookupCompanyMutation.isPending && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  {resolvedCompany ? (
                    <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3" />
                      {resolvedCompany.name}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Enter your Company ID to log in
                    </p>
                  )}
                </div>
              )}

              {/* Super Admin toggle - only for login mode */}
              {isLogin && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="superAdmin"
                    data-testid="checkbox-super-admin"
                    checked={isSuperAdmin}
                    onCheckedChange={(checked) => {
                      setIsSuperAdmin(checked === true);
                      if (checked) {
                        setCompanyCode("");
                        setResolvedCompany(null);
                      }
                    }}
                  />
                  <Label htmlFor="superAdmin" className="text-sm text-muted-foreground cursor-pointer">
                    Platform Administrator
                  </Label>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  data-testid="input-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  data-testid="input-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {!isLogin && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      data-testid="input-firstname"
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      data-testid="input-lastname"
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                    />
                  </div>
                </>
              )}

              <Button
                type="submit"
                className="w-full"
                data-testid={isLogin ? "button-login" : "button-register"}
                disabled={loginMutation.isPending || registerMutation.isPending || (isLogin && !isSuperAdmin && lookupCompanyMutation.isPending)}
              >
                {(loginMutation.isPending || registerMutation.isPending) ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isLogin ? "Signing in..." : "Creating account..."}
                  </>
                ) : (
                  isLogin ? "Sign In" : "Create Account"
                )}
              </Button>

              {isLogin && (
                <div className="text-center text-sm">
                  <Link href="/forgot-password">
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      data-testid="link-forgot-password"
                    >
                      Forgot password?
                    </button>
                  </Link>
                </div>
              )}

              <div className="text-center text-sm">
                <button
                  type="button"
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-primary hover:underline"
                  data-testid="button-toggle-auth-mode"
                >
                  {isLogin ? "Need an account? Register" : "Already have an account? Sign in"}
                </button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Download App Buttons */}
        <div className="w-full max-w-md mt-6">
          <div className="text-center space-y-3">
            <p className="text-sm text-muted-foreground">Download GuardTrack Mobile App</p>
            <div className="flex gap-3 justify-center">
              <Button
                variant="outline"
                className="flex items-center gap-2"
                onClick={() => {
                  alert('Android app coming soon! Link will be available after Play Store approval.');
                }}
                data-testid="button-download-android"
              >
                <SiAndroid className="h-5 w-5" />
                <div className="text-left">
                  <div className="text-xs text-muted-foreground">GET IT ON</div>
                  <div className="font-semibold">Google Play</div>
                </div>
              </Button>
              <Button
                variant="outline"
                className="flex items-center gap-2"
                onClick={() => {
                  alert('iOS app coming soon! Link will be available after App Store approval.');
                }}
                data-testid="button-download-ios"
              >
                <SiApple className="h-5 w-5" />
                <div className="text-left">
                  <div className="text-xs text-muted-foreground">Download on the</div>
                  <div className="font-semibold">App Store</div>
                </div>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Hero */}
      <div className="hidden lg:flex flex-1 bg-primary text-primary-foreground items-center justify-center p-12">
        <div className="max-w-md space-y-6">
          <h2 className="text-4xl font-bold">Security Guard Management</h2>
          <p className="text-lg opacity-90">
            Track shifts, manage attendance, and streamline security operations with GuardTrack.
          </p>
          <ul className="space-y-3">
            <li className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              <span>Real-time check-in/check-out tracking</span>
            </li>
            <li className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              <span>Automated billing and reporting</span>
            </li>
            <li className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              <span>Geolocation verification</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

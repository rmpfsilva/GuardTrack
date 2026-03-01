import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import guardTrackLogo from "@assets/GuardTrack Logo - Dynamic Blue Shades_1760219905891.png";

export default function AuthPage() {
  const { user, loginMutation } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    if (user) setLocation("/");
  }, [user, setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await loginMutation.mutateAsync({ email, password, isSuperAdmin });
      setLocation("/");
    } catch (error: any) {
      if (error?.needsActivation) {
        toast({
          title: "Account not activated",
          description: "Check your email for an activation link, or ask your manager to resend the invite.",
          variant: "destructive",
        });
      } else if (error?.multipleCompanies) {
        toast({
          title: "Multiple accounts found",
          description: "Multiple company accounts detected for this email. Please contact your administrator.",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left — login form */}
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
              Sign in to your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{isSuperAdmin ? "Email or username" : "Email address"}</Label>
                <Input
                  id="email"
                  type={isSuperAdmin ? "text" : "email"}
                  placeholder={isSuperAdmin ? "Email or username" : "you@example.com"}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  data-testid="input-email"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <button
                    type="button"
                    onClick={() => setLocation("/forgot-password")}
                    className="text-xs text-muted-foreground hover:underline"
                    data-testid="link-forgot-password"
                  >
                    Forgot password?
                  </button>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  data-testid="input-password"
                />
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="superadmin"
                  checked={isSuperAdmin}
                  onCheckedChange={v => setIsSuperAdmin(!!v)}
                  data-testid="checkbox-super-admin"
                />
                <Label htmlFor="superadmin" className="text-sm font-normal text-muted-foreground cursor-pointer">
                  Platform administrator
                </Label>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loginMutation.isPending}
                data-testid="button-sign-in"
              >
                {loginMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Signing in...</>
                ) : (
                  <><ShieldCheck className="h-4 w-4 mr-2" />Sign In</>
                )}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                New to GuardTrack?{" "}
                <button
                  type="button"
                  onClick={() => setLocation("/activate")}
                  className="text-primary hover:underline"
                  data-testid="link-activate-account"
                >
                  Activate your account
                </button>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Right — hero panel */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-blue-900 to-blue-700 items-center justify-center p-12">
        <div className="text-white text-center max-w-md space-y-4">
          <ShieldCheck className="h-16 w-16 mx-auto opacity-80" />
          <h2 className="text-3xl font-bold">GuardTrack</h2>
          <p className="text-blue-200 text-lg leading-relaxed">
            Security guard shift management, real-time monitoring, and attendance tracking — all in one platform.
          </p>
        </div>
      </div>
    </div>
  );
}

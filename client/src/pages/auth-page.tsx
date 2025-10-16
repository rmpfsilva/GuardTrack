// Referenced from blueprint:javascript_auth_all_persistance
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck } from "lucide-react";
import { SiAndroid, SiApple } from "react-icons/si";
import guardTrackLogo from "@assets/GuardTrack Logo - Dynamic Blue Shades_1760219905891.png";

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const [, setLocation] = useLocation();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  // Redirect if already logged in (using useEffect to avoid setState during render)
  useEffect(() => {
    if (user) {
      setLocation("/");
    }
  }, [user, setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isLogin) {
      loginMutation.mutate({ username, password });
    } else {
      registerMutation.mutate({
        username,
        password,
        firstName,
        lastName,
        role: 'guard', // Default role
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
                disabled={loginMutation.isPending || registerMutation.isPending}
              >
                {isLogin ? "Sign In" : "Create Account"}
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
                  // Placeholder - will be replaced with actual store link
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
                  // Placeholder - will be replaced with actual store link
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

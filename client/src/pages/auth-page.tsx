// Referenced from blueprint:javascript_auth_all_persistance
import { useState, useEffect } from "react";
import { useAuth, CompanyOption } from "@/hooks/use-auth";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Building2, Loader2, ShieldCheck, Youtube, ExternalLink, Share, Copy, Mail, X, Link2, ArrowRight } from "lucide-react";
import { SiAndroid, SiApple } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";
import guardTrackLogo from "@assets/GuardTrack Logo - Dynamic Blue Shades_1760219905891.png";

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true;
}

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  
  // For handling multiple company conflict
  const [companyOptions, setCompanyOptions] = useState<CompanyOption[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  
  // App store dialogs
  const [showIOSDialog, setShowIOSDialog] = useState(false);
  const [showAndroidDialog, setShowAndroidDialog] = useState(false);

  // Post-install: detect standalone + no pending invite
  const [standaloneMode] = useState(() => isStandalone());
  const [hasPendingInvite] = useState(() => !!localStorage.getItem('pendingInviteToken'));
  const [showInvitePaste, setShowInvitePaste] = useState(false);
  const [pastedLink, setPastedLink] = useState("");
  const [inviteLinkError, setInviteLinkError] = useState("");

  const handlePastedInviteLink = () => {
    setInviteLinkError("");
    try {
      const url = new URL(pastedLink.trim());
      // Accept /install/:companyId?inviteToken=... or /register?token=...
      const inviteToken = url.searchParams.get('inviteToken') || url.searchParams.get('token');
      const pathParts = url.pathname.split('/').filter(Boolean);
      if (inviteToken) {
        localStorage.setItem('pendingInviteToken', inviteToken);
        if (pathParts[0] === 'install' && pathParts[1]) {
          localStorage.setItem('installCompanyId', pathParts[1]);
        }
        setLocation(`/register?token=${inviteToken}`);
      } else {
        setInviteLinkError("No invite token found in this link. Check you copied the full link from your manager.");
      }
    } catch {
      setInviteLinkError("That doesn't look like a valid link. Paste the full link your manager sent you.");
    }
  };

  // Redirect if already logged in (using useEffect to avoid setState during render)
  useEffect(() => {
    if (user) {
      setLocation("/");
    }
  }, [user, setLocation]);

  // Handle login mutation result for multi-company conflict
  useEffect(() => {
    if (loginMutation.isSuccess && loginMutation.data) {
      const result = loginMutation.data as any;
      if (result.requiresCompanySelection && result.companies) {
        // Show company selection
        setCompanyOptions(result.companies);
      }
    }
  }, [loginMutation.isSuccess, loginMutation.data]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Reset company selection state
    setCompanyOptions([]);
    setSelectedCompanyId(null);
    
    if (isLogin) {
      loginMutation.mutate({ 
        username, 
        password, 
        isSuperAdmin
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

  const handleCompanySelection = (companyId: string) => {
    setSelectedCompanyId(companyId);
    // Retry login with selected company
    loginMutation.mutate({ 
      username, 
      password, 
      companyId 
    });
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
              {/* Company selection - shown only when multiple companies have same username */}
              {companyOptions.length > 0 && (
                <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Building2 className="h-4 w-4" />
                    <span>Select your company</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Your username exists in multiple companies. Please select which one to log into:
                  </p>
                  <div className="space-y-2">
                    {companyOptions.map((company) => (
                      <Button
                        key={company.companyId}
                        type="button"
                        variant={selectedCompanyId === company.companyId ? "default" : "outline"}
                        className="w-full justify-start"
                        onClick={() => handleCompanySelection(company.companyId)}
                        disabled={loginMutation.isPending}
                        data-testid={`button-company-${company.companyCode}`}
                      >
                        <Building2 className="h-4 w-4 mr-2" />
                        {company.companyName}
                        <span className="ml-auto text-xs opacity-70">{company.companyCode}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Super Admin toggle - only for login mode */}
              {isLogin && companyOptions.length === 0 && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="superAdmin"
                    data-testid="checkbox-super-admin"
                    checked={isSuperAdmin}
                    onCheckedChange={(checked) => {
                      setIsSuperAdmin(checked === true);
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
                disabled={loginMutation.isPending || registerMutation.isPending}
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

              {/* In standalone mode without invite: show invite link section instead of generic register */}
              {standaloneMode && !hasPendingInvite ? (
                <div className="border-t pt-4 space-y-3">
                  <p className="text-center text-sm text-muted-foreground">
                    New here? You need a personal invite link from your manager to register.
                  </p>
                  {!showInvitePaste ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => setShowInvitePaste(true)}
                      data-testid="button-have-invite-link"
                    >
                      <Link2 className="h-4 w-4 mr-2" />
                      I have an invite link
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      <Label className="text-sm">Paste your invite link</Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="https://guardtrack.live/install/..."
                          value={pastedLink}
                          onChange={e => { setPastedLink(e.target.value); setInviteLinkError(""); }}
                          className="flex-1 text-sm"
                          data-testid="input-paste-invite-link"
                        />
                        <Button
                          type="button"
                          onClick={handlePastedInviteLink}
                          disabled={!pastedLink.trim()}
                          data-testid="button-go-invite-link"
                        >
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>
                      {inviteLinkError && (
                        <p className="text-xs text-destructive" data-testid="text-invite-link-error">
                          {inviteLinkError}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Copy the link your manager sent via WhatsApp or email and paste it here.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
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
              )}
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
                onClick={() => setShowAndroidDialog(true)}
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
                onClick={() => setShowIOSDialog(true)}
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

      {/* iOS App Store Dialog */}
      <Dialog open={showIOSDialog} onOpenChange={setShowIOSDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SiApple className="h-6 w-6" />
              iOS App Coming Soon
            </DialogTitle>
            <DialogDescription>
              The GuardTrack app will be available on the App Store soon. In the meantime, you can add the app to your iPhone home screen for quick access.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="font-medium text-sm mb-3">How to install on iPhone/iPad:</p>
              <ol className="text-sm space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0">1</span>
                  <span>Open the app in Safari browser</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0">2</span>
                  <span>Tap the <Share className="h-4 w-4 inline" /> Share button</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0">3</span>
                  <span>Scroll down and tap "Add to Home Screen"</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0">4</span>
                  <span>Tap "Add" to install</span>
                </li>
              </ol>
            </div>
            
            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-3 flex items-center gap-2">
                <Youtube className="h-5 w-5 text-red-600" />
                Watch Video Tutorial
              </p>
              <div className="flex flex-wrap gap-2">
                <a 
                  href="https://www.youtube.com/watch?v=QpFbExFHXe0" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex-1"
                >
                  <Button variant="default" size="sm" className="w-full" data-testid="button-watch-ios-video-dialog">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Watch Video
                  </Button>
                </a>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    navigator.clipboard.writeText("https://www.youtube.com/watch?v=QpFbExFHXe0");
                    toast({ title: "Link copied!", description: "Video link copied to clipboard" });
                  }}
                  data-testid="button-copy-ios-video-dialog"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Link
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    const subject = encodeURIComponent("How to Install GuardTrack on iPhone");
                    const body = encodeURIComponent("Watch this video to learn how to install the GuardTrack app on your iPhone:\n\nhttps://www.youtube.com/watch?v=QpFbExFHXe0\n\nThen visit the app at: " + window.location.origin + "/guard/app");
                    window.open(`mailto:?subject=${subject}&body=${body}`);
                  }}
                  data-testid="button-email-ios-video-dialog"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Email
                </Button>
              </div>
            </div>
            
            <div className="flex justify-end pt-2">
              <Button variant="secondary" onClick={() => setShowIOSDialog(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Android Play Store Dialog */}
      <Dialog open={showAndroidDialog} onOpenChange={setShowAndroidDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SiAndroid className="h-6 w-6" />
              Android App Coming Soon
            </DialogTitle>
            <DialogDescription>
              The GuardTrack app will be available on the Google Play Store soon. In the meantime, you can add the app to your Android home screen for quick access.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="font-medium text-sm mb-3">How to install on Android:</p>
              <ol className="text-sm space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0">1</span>
                  <span>Open the app in Chrome browser</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0">2</span>
                  <span>Tap the menu (three dots) in the top right</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0">3</span>
                  <span>Tap "Install app" or "Add to Home screen"</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0">4</span>
                  <span>Tap "Install" to add the app</span>
                </li>
              </ol>
            </div>
            
            <div className="flex justify-end pt-2">
              <Button variant="secondary" onClick={() => setShowAndroidDialog(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

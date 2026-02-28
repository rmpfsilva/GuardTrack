import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Shield, UserPlus, Loader2, Building2, ArrowRight, KeyRound } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import guardTrackLogo from "@assets/GuardTrack Logo - Dynamic Blue Shades_1760219905891.png";

const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type RegisterForm = z.infer<typeof registerSchema>;

interface InvitationInfo {
  valid: boolean;
  email: string;
  role: string;
  companyName: string;
  companyCode: string;
  expiresAt?: string;
  error?: string;
}

function extractToken(input: string): string {
  const trimmed = input.trim();
  try {
    const url = new URL(trimmed);
    const t = url.searchParams.get("inviteToken") || url.searchParams.get("token");
    if (t) return t;
  } catch {}
  if (/^[a-zA-Z0-9_\-\.]+$/.test(trimmed) && trimmed.length > 10) return trimmed;
  return "";
}

export default function RegisterPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [step, setStep] = useState<"enter-code" | "validating" | "register">("enter-code");
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState("");
  const [invitationToken, setInvitationToken] = useState<string | null>(null);
  const [invitationInfo, setInvitationInfo] = useState<InvitationInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { username: "", password: "", confirmPassword: "", firstName: "", lastName: "" },
  });

  const validateToken = async (token: string) => {
    setStep("validating");
    setCodeError("");
    try {
      const response = await fetch(`/api/invitation/validate/${token}`);
      const data = await response.json();
      if (!response.ok || !data.valid) {
        setCodeError(data.error || "This invite code is invalid or has expired. Ask your manager to send a new one.");
        setStep("enter-code");
        return;
      }
      setInvitationToken(token);
      setInvitationInfo(data);
      setStep("register");
    } catch {
      setCodeError("Could not validate the invite code. Check your connection and try again.");
      setStep("enter-code");
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("token") || params.get("inviteToken");
    const localToken = localStorage.getItem("pendingInviteToken");
    const token = urlToken || localToken;
    if (token) {
      setCodeInput(token);
      validateToken(token);
    }
  }, []);

  const handleCodeSubmit = () => {
    const token = extractToken(codeInput);
    if (!token) {
      setCodeError("Paste the full invite link your manager sent, or the invite code itself.");
      return;
    }
    validateToken(token);
  };

  const onSubmit = async (data: RegisterForm) => {
    if (!invitationToken) return;
    setIsLoading(true);
    try {
      await apiRequest("POST", "/api/register", {
        username: data.username,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
        invitationToken,
      });
      localStorage.removeItem("pendingInviteToken");
      toast({ title: "Account created!", description: "Welcome to GuardTrack. You can now log in." });
      setLocation("/");
    } catch (error: any) {
      toast({ title: "Registration failed", description: error.message || "Please try again", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">

        {/* Logo */}
        <div className="flex justify-center pb-2">
          <img src={guardTrackLogo} alt="GuardTrack" className="h-10 w-auto" data-testid="img-register-logo" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {step === "register" ? (
                <><UserPlus className="h-5 w-5" />Create Your Account</>
              ) : (
                <><KeyRound className="h-5 w-5" />Enter Your Invite Code</>
              )}
            </CardTitle>
            <CardDescription>
              {step === "register" && invitationInfo ? (
                <span className="flex items-center gap-1.5 text-sm">
                  <Building2 className="h-4 w-4 shrink-0" />
                  <span>
                    Joining <strong>{invitationInfo.companyName}</strong> as <strong>{invitationInfo.role}</strong>
                    {invitationInfo.email && <> · {invitationInfo.email}</>}
                  </span>
                </span>
              ) : (
                "Your manager sent you an invite link or code. Paste it below."
              )}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {/* Step 1: Enter invite code */}
            {(step === "enter-code" || step === "validating") && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-code">Invite link or code</Label>
                  <Input
                    id="invite-code"
                    placeholder="Paste your invite link here..."
                    value={codeInput}
                    onChange={e => { setCodeInput(e.target.value); setCodeError(""); }}
                    onKeyDown={e => e.key === "Enter" && handleCodeSubmit()}
                    disabled={step === "validating"}
                    data-testid="input-invite-code"
                  />
                  {codeError && (
                    <p className="text-sm text-destructive" data-testid="text-code-error">{codeError}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    This is the link your manager sent via WhatsApp, email, or SMS. You can paste the full link or just the code.
                  </p>
                </div>

                <Button
                  className="w-full"
                  onClick={handleCodeSubmit}
                  disabled={step === "validating" || !codeInput.trim()}
                  data-testid="button-validate-code"
                >
                  {step === "validating" ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Validating...</>
                  ) : (
                    <><ArrowRight className="h-4 w-4 mr-2" />Continue</>
                  )}
                </Button>

                <div className="text-center text-sm text-muted-foreground">
                  <button
                    type="button"
                    onClick={() => setLocation("/auth")}
                    className="text-primary hover:underline"
                    data-testid="link-go-to-login"
                  >
                    Already have an account? Sign in
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Registration form */}
            {step === "register" && (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="John" data-testid="input-first-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Smith" data-testid="input-last-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="johnsmith" autoCapitalize="none" data-testid="input-username" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input {...field} type="password" placeholder="Min. 6 characters" data-testid="input-password" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm Password</FormLabel>
                        <FormControl>
                          <Input {...field} type="password" placeholder="Repeat your password" data-testid="input-confirm-password" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-create-account">
                    {isLoading ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating account...</>
                    ) : (
                      <><Shield className="h-4 w-4 mr-2" />Create Account</>
                    )}
                  </Button>

                  <div className="text-center text-sm">
                    <button
                      type="button"
                      onClick={() => { setStep("enter-code"); setInvitationToken(null); setInvitationInfo(null); }}
                      className="text-muted-foreground hover:underline text-xs"
                      data-testid="button-back-to-code"
                    >
                      Use a different invite code
                    </button>
                  </div>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

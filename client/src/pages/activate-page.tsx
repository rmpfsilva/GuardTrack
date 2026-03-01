import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Shield, Loader2, Building2, KeyRound, ArrowRight, CheckCircle2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import guardTrackLogo from "@assets/GuardTrack Logo - Dynamic Blue Shades_1760219905891.png";

const activateSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type ActivateForm = z.infer<typeof activateSchema>;

interface TokenInfo {
  valid: boolean;
  email: string;
  role: string;
  companyName: string;
  expiresAt?: string;
  error?: string;
}

function extractToken(input: string): string {
  const trimmed = input.trim();
  try {
    const url = new URL(trimmed);
    const t = url.searchParams.get("token") || url.searchParams.get("inviteToken");
    if (t) return t;
  } catch {}
  if (/^[a-zA-Z0-9_\-\.]+$/.test(trimmed) && trimmed.length > 10) return trimmed;
  return "";
}

export default function ActivatePage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [tokenInput, setTokenInput] = useState("");
  const [tokenError, setTokenError] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [step, setStep] = useState<"enter-code" | "validating" | "form" | "done">("enter-code");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ActivateForm>({
    resolver: zodResolver(activateSchema),
    defaultValues: { firstName: "", lastName: "", password: "", confirmPassword: "" },
  });

  const validateToken = async (t: string) => {
    setStep("validating");
    setTokenError("");
    try {
      const res = await fetch(`/api/activate?token=${encodeURIComponent(t)}`);
      const data: TokenInfo = await res.json();
      if (!res.ok || !data.valid) {
        setTokenError(data.error || "This invite link is invalid or has expired. Ask your manager to resend the invite.");
        setStep("enter-code");
        return;
      }
      setToken(t);
      setTokenInfo(data);
      setStep("form");
    } catch {
      setTokenError("Could not validate the invite link. Check your connection and try again.");
      setStep("enter-code");
    }
  };

  // Auto-detect token from URL on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("token") || params.get("inviteToken");
    const localToken = localStorage.getItem("pendingInviteToken");
    const autoToken = urlToken || localToken;
    if (autoToken) {
      setTokenInput(autoToken);
      validateToken(autoToken);
    }
  }, []);

  const handleCodeSubmit = () => {
    const t = extractToken(tokenInput);
    if (!t) {
      setTokenError("Paste the full invite link your manager sent, or the invite code itself.");
      return;
    }
    validateToken(t);
  };

  const onSubmit = async (data: ActivateForm) => {
    if (!token) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          password: data.password,
          firstName: data.firstName,
          lastName: data.lastName,
        }),
        credentials: "include",
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message || "Activation failed");

      localStorage.removeItem("pendingInviteToken");
      queryClient.setQueryData(["/api/user"], result);
      setStep("done");

      setTimeout(() => setLocation("/"), 1500);
    } catch (error: any) {
      toast({ title: "Activation failed", description: error.message || "Please try again", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === "done") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8 space-y-3">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
            <h2 className="text-xl font-semibold">Account activated!</h2>
            <p className="text-muted-foreground text-sm">Taking you to your dashboard...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">

        <div className="flex justify-center pb-2">
          <img src={guardTrackLogo} alt="GuardTrack" className="h-10 w-auto" data-testid="img-activate-logo" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {step === "form" ? (
                <><Shield className="h-5 w-5" />Activate Your Account</>
              ) : (
                <><KeyRound className="h-5 w-5" />Enter Your Invite Code</>
              )}
            </CardTitle>
            <CardDescription>
              {step === "form" && tokenInfo ? (
                <span className="flex items-center gap-1.5 text-sm">
                  <Building2 className="h-4 w-4 shrink-0" />
                  <span>
                    Joining <strong>{tokenInfo.companyName}</strong> as <strong>{tokenInfo.role}</strong>
                    {tokenInfo.email && <> &middot; {tokenInfo.email}</>}
                  </span>
                </span>
              ) : (
                "Your manager sent you an invite link. Paste it below to get started."
              )}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {/* Step 1: Enter invite code */}
            {(step === "enter-code" || step === "validating") && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Invite link or code</label>
                  <Input
                    placeholder="Paste your invite link here..."
                    value={tokenInput}
                    onChange={e => { setTokenInput(e.target.value); setTokenError(""); }}
                    onKeyDown={e => e.key === "Enter" && handleCodeSubmit()}
                    disabled={step === "validating"}
                    data-testid="input-invite-code"
                  />
                  {tokenError && (
                    <p className="text-sm text-destructive" data-testid="text-code-error">{tokenError}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    This is the link your manager sent via email. You can paste the full link or just the code.
                  </p>
                </div>

                <Button
                  className="w-full"
                  onClick={handleCodeSubmit}
                  disabled={step === "validating" || !tokenInput.trim()}
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

            {/* Step 2: Set name + password */}
            {step === "form" && (
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

                  {tokenInfo?.email && (
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Email</label>
                      <Input value={tokenInfo.email} disabled className="bg-muted" data-testid="input-email-readonly" />
                    </div>
                  )}

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Create Password</FormLabel>
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

                  <Button type="submit" className="w-full" disabled={isSubmitting} data-testid="button-activate">
                    {isSubmitting ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Activating...</>
                    ) : (
                      <><Shield className="h-4 w-4 mr-2" />Activate Account</>
                    )}
                  </Button>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => { setStep("enter-code"); setToken(null); setTokenInfo(null); }}
                      className="text-xs text-muted-foreground hover:underline"
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

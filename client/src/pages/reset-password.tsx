import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useLocation, useSearch } from "wouter";
import { Lock, CheckCircle } from "lucide-react";
import proForceLogo from "@assets/download_1760019684165.png";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const resetPasswordSchema = z.object({
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const searchParams = useSearch();
  const token = new URLSearchParams(searchParams).get("token");
  const [resetSuccess, setResetSuccess] = useState(false);

  const form = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  // Verify token on mount
  const { data: tokenValidation, isLoading: verifying } = useQuery({
    queryKey: ["/api/auth/verify-reset-token", token],
    queryFn: async () => {
      if (!token) throw new Error("No token provided");
      const response = await fetch(`/api/auth/verify-reset-token/${token}`);
      if (!response.ok) {
        throw new Error("Invalid or expired token");
      }
      return response.json();
    },
    enabled: !!token,
    retry: false,
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (data: { token: string; newPassword: string }) => {
      return await apiRequest("POST", "/api/auth/reset-password", data);
    },
    onSuccess: () => {
      setResetSuccess(true);
      toast({
        title: "Success",
        description: "Password reset successfully! Redirecting to login...",
      });
      setTimeout(() => {
        navigate("/auth");
      }, 3000);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ResetPasswordForm) => {
    if (!token) {
      toast({
        title: "Error",
        description: "No reset token found",
        variant: "destructive",
      });
      return;
    }

    resetPasswordMutation.mutate({
      token,
      newPassword: data.newPassword,
    });
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invalid Reset Link</CardTitle>
            <CardDescription>No reset token was provided</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/auth")} className="w-full" data-testid="button-back-to-login">
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (verifying) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <img src={proForceLogo} alt="ProForce Security" className="h-16 mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Verifying reset token...</p>
        </div>
      </div>
    );
  }

  if (!tokenValidation?.valid) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invalid or Expired Token</CardTitle>
            <CardDescription>This password reset link is no longer valid</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/forgot-password")} className="w-full" data-testid="button-request-new">
              Request New Reset Link
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (resetSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-6 w-6 text-green-500" />
              Password Reset Successful
            </CardTitle>
            <CardDescription>Your password has been reset successfully</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Redirecting to login page...
            </p>
            <Button onClick={() => navigate("/auth")} className="w-full" data-testid="button-go-to-login">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src={proForceLogo} alt="ProForce Security" className="h-12 mx-auto mb-4" />
          <h1 className="text-3xl font-bold">Reset Password</h1>
          <p className="text-muted-foreground mt-2">Enter your new password</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Choose New Password
            </CardTitle>
            <CardDescription>
              Your new password must be at least 6 characters long
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Enter new password (min 6 characters)"
                          {...field}
                          data-testid="input-new-password"
                        />
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
                      <FormLabel>Confirm New Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Confirm new password"
                          {...field}
                          data-testid="input-confirm-password"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={resetPasswordMutation.isPending}
                  data-testid="button-reset-password"
                >
                  {resetPasswordMutation.isPending ? "Resetting Password..." : "Reset Password"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

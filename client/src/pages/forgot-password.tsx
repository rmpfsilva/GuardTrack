import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { ArrowLeft, Mail } from "lucide-react";
import guardTrackLogo from "@assets/GuardTrack Logo - Dynamic Blue Shades_1760219905891.png";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const forgotPasswordSchema = z.object({
  username: z.string().min(1, "Username is required"),
});

type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const { toast } = useToast();

  const form = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      username: "",
    },
  });

  const requestResetMutation = useMutation({
    mutationFn: async (data: { username: string }) => {
      const res = await apiRequest("POST", "/api/auth/request-password-reset", data);
      return res.json();
    },
    onSuccess: (data: { message: string }) => {
      toast({
        title: "Request Submitted",
        description: data.message,
        duration: 8000,
      });
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ForgotPasswordForm) => {
    requestResetMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src={guardTrackLogo} alt="GuardTrack" className="h-12 mx-auto mb-4" />
          <h1 className="text-3xl font-bold">Forgot Password</h1>
          <p className="text-muted-foreground mt-2">Enter your username to request a password reset</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Password Reset Request
            </CardTitle>
            <CardDescription>
              We'll generate a reset link for your administrator to share with you
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter your username"
                          {...field}
                          data-testid="input-username"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={requestResetMutation.isPending}
                  data-testid="button-request-reset"
                >
                  {requestResetMutation.isPending ? "Sending Request..." : "Request Password Reset"}
                </Button>
              </form>
            </Form>

            <div className="mt-6 text-center">
              <Link href="/auth">
                <Button variant="ghost" size="sm" className="gap-2" data-testid="link-back-to-login">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Login
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { ArrowLeft, Lock, IdCard, Calendar, UserCog, Building2, Timer, Check, AlertTriangle, MessageSquare } from "lucide-react";
import type { User, Company } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import InvoiceSettings from "@/components/invoice-settings";
import CompanySupportMessages from "@/components/company-support-messages";
import GuardAppTabSettings from "@/components/guard-app-tab-settings";
import { BrandingSettings } from "@/components/branding-settings";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
  confirmPassword: z.string().min(1, "Please confirm your new password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

const profileSchema = z.object({
  email: z.string().email("Invalid email address").optional(),
  firstName: z.string().min(1, "First name is required").optional(),
  lastName: z.string().min(1, "Last name is required").optional(),
});

const credentialsSchema = z.object({
  siaNumber: z.string().optional(),
  siaExpiryDate: z.coerce.date().optional().nullable(),
  stewardId: z.string().optional(),
  stewardIdExpiryDate: z.coerce.date().optional().nullable(),
});

const resetUserPasswordSchema = z.object({
  userId: z.string().min(1, "Please select a user"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
  confirmPassword: z.string().min(1, "Please confirm the new password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type ProfileForm = z.infer<typeof profileSchema>;
type ChangePasswordForm = z.infer<typeof changePasswordSchema>;
type CredentialsForm = z.infer<typeof credentialsSchema>;
type ResetUserPasswordForm = z.infer<typeof resetUserPasswordSchema>;

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      email: "",
      firstName: "",
      lastName: "",
    },
  });

  const form = useForm<ChangePasswordForm>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const credentialsForm = useForm<CredentialsForm>({
    resolver: zodResolver(credentialsSchema),
    defaultValues: {
      siaNumber: "",
      siaExpiryDate: undefined,
      stewardId: "",
      stewardIdExpiryDate: undefined,
    },
  });

  const resetUserPasswordForm = useForm<ResetUserPasswordForm>({
    resolver: zodResolver(resetUserPasswordSchema),
    defaultValues: {
      userId: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  // Fetch all users for super admin password reset
  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ['/api/admin/users'],
    enabled: user?.role === 'super_admin',
  });

  // Fetch company information
  const { data: company } = useQuery<Company>({
    queryKey: ['/api/companies', user?.companyId],
    enabled: !!user?.companyId,
  });

  // Fetch trial status (for admins and above)
  const { data: trialStatus } = useQuery<{ isActive: boolean; daysRemaining: number; status: string }>({
    queryKey: [`/api/companies/${user?.companyId}/trial/status`],
    enabled: !!user?.companyId && (user?.role === 'admin' || user?.role === 'super_admin'),
  });

  // Reset profile form when user data loads
  useEffect(() => {
    if (user) {
      profileForm.reset({
        email: user.email || "",
        firstName: user.firstName || "",
        lastName: user.lastName || "",
      });
    }
  }, [user, profileForm]);

  // Reset credentials form when user data loads
  useEffect(() => {
    if (user) {
      credentialsForm.reset({
        siaNumber: user.siaNumber || "",
        siaExpiryDate: user.siaExpiryDate ? new Date(user.siaExpiryDate) : undefined,
        stewardId: user.stewardId || "",
        stewardIdExpiryDate: user.stewardIdExpiryDate ? new Date(user.stewardIdExpiryDate) : undefined,
      });
    }
  }, [user, credentialsForm]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileForm) => {
      return await apiRequest("PATCH", "/api/user/profile", data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      return await apiRequest("POST", "/api/user/change-password", data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Password changed successfully",
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

  const updateCredentialsMutation = useMutation({
    mutationFn: async (data: CredentialsForm) => {
      return await apiRequest("PATCH", "/api/user/credentials", data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Credentials updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const [notificationEmail, setNotificationEmail] = useState("");
  useEffect(() => {
    if (company?.email !== undefined) setNotificationEmail(company.email ?? "");
  }, [company?.email]);

  const updateCompanyEmailMutation = useMutation({
    mutationFn: async (email: string) =>
      await apiRequest("PATCH", "/api/companies/my-company/email", { email }),
    onSuccess: () => {
      toast({ title: "Saved", description: "Notification email updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/companies", user?.companyId] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const onProfileSubmit = (data: ProfileForm) => {
    updateProfileMutation.mutate(data);
  };

  const onSubmit = (data: ChangePasswordForm) => {
    changePasswordMutation.mutate({
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
    });
  };

  const onCredentialsSubmit = (data: CredentialsForm) => {
    updateCredentialsMutation.mutate(data);
  };

  const resetUserPasswordMutation = useMutation({
    mutationFn: async (data: { userId: string; newPassword: string }) => {
      return await apiRequest("PATCH", `/api/admin/users/${data.userId}/reset-password`, { 
        newPassword: data.newPassword 
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "User password reset successfully",
      });
      resetUserPasswordForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onResetUserPasswordSubmit = (data: ResetUserPasswordForm) => {
    resetUserPasswordMutation.mutate({
      userId: data.userId,
      newPassword: data.newPassword,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="flex flex-col">
        {/* Header */}
        <header className="border-b">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/")}
                data-testid="button-back"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-2xl font-bold">Settings</h1>
            </div>
            <div className="text-sm text-muted-foreground">
              {user?.firstName} {user?.lastName}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Company Information Section */}
            {company && (
              <Card data-testid="card-company-info">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Company Information
                  </CardTitle>
                  <CardDescription>
                    Your company details and unique identifier
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Company Name</label>
                      <p className="text-base" data-testid="text-company-name">{company.name}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Company ID</label>
                      <p className="text-base font-mono" data-testid="text-company-id">{company.companyId}</p>
                    </div>
                    {trialStatus && (user?.role === 'admin' || user?.role === 'super_admin') && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Account Status</label>
                        <div className="flex items-center gap-2 mt-1">
                          {trialStatus.status === 'trial' && (
                            <>
                              <Badge variant="outline" className="border-amber-500 text-amber-600" data-testid="badge-trial-status">
                                <Timer className="h-3 w-3 mr-1" />
                                Trial ({trialStatus.daysRemaining} days remaining)
                              </Badge>
                              {trialStatus.daysRemaining <= 3 && (
                                <p className="text-sm text-amber-600 flex items-center gap-1">
                                  <AlertTriangle className="h-4 w-4" />
                                  Trial expires soon
                                </p>
                              )}
                            </>
                          )}
                          {trialStatus.status === 'full' && (
                            <Badge variant="outline" className="border-green-500 text-green-600" data-testid="badge-full-status">
                              <Check className="h-3 w-3 mr-1" />
                              Full Version
                            </Badge>
                          )}
                          {trialStatus.status === 'expired' && (
                            <Badge variant="destructive" data-testid="badge-expired-status">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Trial Expired
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                    {(user?.role === 'admin' || user?.role === 'super_admin') && (
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-muted-foreground">
                          Notification Email
                        </label>
                        <p className="text-xs text-muted-foreground">
                          Job share alerts and system emails are sent to this address
                        </p>
                        <div className="flex gap-2">
                          <Input
                            type="email"
                            value={notificationEmail}
                            onChange={(e) => setNotificationEmail(e.target.value)}
                            placeholder="notifications@yourcompany.com"
                            data-testid="input-company-notification-email"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            disabled={
                              updateCompanyEmailMutation.isPending ||
                              notificationEmail === (company.email ?? "")
                            }
                            onClick={() => updateCompanyEmailMutation.mutate(notificationEmail)}
                            data-testid="button-save-company-email"
                          >
                            {updateCompanyEmailMutation.isPending ? "Saving…" : "Save"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Brand Colour — admins can set their own company colour */}
            {company && (user?.role === 'admin' || user?.role === 'super_admin') && (
              <BrandingSettings
                companyId={company.id}
                companyName={company.name}
                currentColour={company.brandColor}
                isSuperAdmin={user?.role === 'super_admin'}
              />
            )}

            {/* Profile Update Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IdCard className="h-5 w-5" />
                  Profile Information
                </CardTitle>
                <CardDescription>
                  Update your email address and personal information
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...profileForm}>
                  <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
                    <FormField
                      control={profileForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Address</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="your.email@example.com"
                              {...field}
                              data-testid="input-profile-email"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid md:grid-cols-2 gap-4">
                      <FormField
                        control={profileForm.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>First Name</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="John"
                                {...field}
                                data-testid="input-profile-first-name"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={profileForm.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Last Name</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Smith"
                                {...field}
                                data-testid="input-profile-last-name"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={updateProfileMutation.isPending}
                      data-testid="button-update-profile"
                    >
                      {updateProfileMutation.isPending ? "Updating..." : "Update Profile"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>

            {/* Change Password Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Change Password
                </CardTitle>
                <CardDescription>
                  Update your password to keep your account secure
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="currentPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Current Password</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder="Enter current password"
                              {...field}
                              data-testid="input-current-password"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

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
                      disabled={changePasswordMutation.isPending}
                      data-testid="button-change-password"
                    >
                      {changePasswordMutation.isPending ? "Changing Password..." : "Change Password"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>

            {/* Reset User Password Section - Super Admin Only */}
            {user?.role === 'super_admin' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserCog className="h-5 w-5" />
                    Reset User Password
                  </CardTitle>
                  <CardDescription>
                    Reset password for any user in the system
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...resetUserPasswordForm}>
                    <form onSubmit={resetUserPasswordForm.handleSubmit(onResetUserPasswordSubmit)} className="space-y-4">
                      <FormField
                        control={resetUserPasswordForm.control}
                        name="userId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Select User</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-user-for-reset">
                                  <SelectValue placeholder="Choose a user..." />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {allUsers.map((u) => (
                                  <SelectItem key={u.id} value={u.id}>
                                    {u.firstName} {u.lastName} ({u.username}) - {u.role}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={resetUserPasswordForm.control}
                        name="newPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>New Password</FormLabel>
                            <FormControl>
                              <Input
                                type="password"
                                placeholder="Enter new password (min 6 characters)"
                                {...field}
                                data-testid="input-reset-password"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={resetUserPasswordForm.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Confirm New Password</FormLabel>
                            <FormControl>
                              <Input
                                type="password"
                                placeholder="Confirm new password"
                                {...field}
                                data-testid="input-reset-confirm-password"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button
                        type="submit"
                        className="w-full"
                        disabled={resetUserPasswordMutation.isPending}
                        data-testid="button-reset-user-password"
                      >
                        {resetUserPasswordMutation.isPending ? "Resetting Password..." : "Reset User Password"}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            )}

            {/* Professional Credentials - Hidden for Super Admin */}
            {user?.role !== 'super_admin' && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <IdCard className="h-5 w-5" />
                    Professional Credentials
                  </CardTitle>
                  <CardDescription>
                    Manage your SIA license and Steward ID information
                  </CardDescription>
                </CardHeader>
              <CardContent>
                <Form {...credentialsForm}>
                  <form onSubmit={credentialsForm.handleSubmit(onCredentialsSubmit)} className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <FormField
                        control={credentialsForm.control}
                        name="siaNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>SIA Number</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Enter SIA number"
                                {...field}
                                data-testid="input-sia-number"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={credentialsForm.control}
                        name="siaExpiryDate"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>SIA Expiry Date</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    className={cn(
                                      "w-full justify-start text-left font-normal",
                                      !field.value && "text-muted-foreground"
                                    )}
                                    data-testid="button-sia-expiry-date"
                                  >
                                    <Calendar className="mr-2 h-4 w-4" />
                                    {field.value ? format(field.value, "PPP") : "Pick a date"}
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <CalendarComponent
                                  mode="single"
                                  selected={field.value || undefined}
                                  onSelect={field.onChange}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <FormField
                        control={credentialsForm.control}
                        name="stewardId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Steward ID</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Enter Steward ID"
                                {...field}
                                data-testid="input-steward-id"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={credentialsForm.control}
                        name="stewardIdExpiryDate"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>Steward ID Expiry Date</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    className={cn(
                                      "w-full justify-start text-left font-normal",
                                      !field.value && "text-muted-foreground"
                                    )}
                                    data-testid="button-steward-expiry-date"
                                  >
                                    <Calendar className="mr-2 h-4 w-4" />
                                    {field.value ? format(field.value, "PPP") : "Pick a date"}
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <CalendarComponent
                                  mode="single"
                                  selected={field.value || undefined}
                                  onSelect={field.onChange}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={updateCredentialsMutation.isPending}
                      data-testid="button-update-credentials"
                    >
                      {updateCredentialsMutation.isPending ? "Updating..." : "Update Credentials"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
            )}

            {/* Invoice Settings - Admin and Super Admin */}
            {(user?.role === 'admin' || user?.role === 'super_admin' || (user as any)?.roles?.includes('admin') || (user as any)?.roles?.includes('super_admin')) && <InvoiceSettings />}

            {/* Guard App Tab Configuration - Platform Admin (Super Admin) only */}
            {(user?.role === 'super_admin' || (user as any)?.roles?.includes('super_admin')) && <GuardAppTabSettings />}

            {/* Support Messages - Company Admin only (not Super Admin) */}
            {(user?.role === 'admin' || (user as any)?.roles?.includes('admin')) && user?.role !== 'super_admin' && !(user as any)?.roles?.includes('super_admin') && <CompanySupportMessages />}
          </div>
        </main>
      </div>
    </div>
  );
}

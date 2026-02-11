import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Mail, UserPlus, Ban, Trash2, CheckCircle2, Clock, XCircle } from "lucide-react";
import { format } from "date-fns";
import type { Invitation } from "@shared/schema";

const invitationFormSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  role: z.enum(["guard", "steward", "supervisor", "admin"]),
  expiresAt: z.string().optional(),
  companyId: z.string().optional(),
});

type InvitationFormData = z.infer<typeof invitationFormSchema>;

export default function InvitationManagement() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';

  const form = useForm<InvitationFormData>({
    resolver: zodResolver(invitationFormSchema),
    defaultValues: {
      email: "",
      role: "guard",
      expiresAt: "",
      companyId: "",
    },
  });

  const { data: companies = [] } = useQuery<any[]>({
    queryKey: ["/api/super-admin/clients"],
    enabled: isSuperAdmin,
  });

  const { data: invitations = [], isLoading } = useQuery<Invitation[]>({
    queryKey: ["/api/admin/invitations"],
  });

  // Create invitation mutation
  const createMutation = useMutation({
    mutationFn: async (data: InvitationFormData) => {
      const response = await fetch("/api/admin/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create invitation");
      }
      return response.json();
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/invitations"] });
      
      if (result.emailSent === false && result.emailError) {
        toast({
          title: "Invitation created - Email failed",
          description: `The invitation was created but the email could not be sent: ${result.emailError}. You may need to share the registration link manually.`,
          variant: "destructive",
        });
      } else if (result.emailSent === false) {
        toast({
          title: "Invitation created",
          description: "The invitation was created but no email was sent. The user can register using their email address.",
        });
      } else {
        toast({
          title: "Invitation sent",
          description: "The user will receive an email with instructions to create their account.",
        });
      }
      form.reset();
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) return;
      toast({
        title: "Error",
        description: error.message || "Failed to create invitation",
        variant: "destructive",
      });
    },
  });

  // Revoke invitation mutation
  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/admin/invitations/${id}/revoke`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to revoke invitation");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/invitations"] });
      toast({
        title: "Invitation revoked",
        description: "This invitation can no longer be used.",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) return;
      toast({
        title: "Error",
        description: error.message || "Failed to revoke invitation",
        variant: "destructive",
      });
    },
  });

  // Delete invitation mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/admin/invitations/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete invitation");
      }
      return;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/invitations"] });
      toast({
        title: "Invitation deleted",
        description: "The invitation has been permanently deleted.",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) return;
      toast({
        title: "Error",
        description: error.message || "Failed to delete invitation",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: InvitationFormData) => {
    const payload = {
      ...data,
      expiresAt: data.expiresAt ? new Date(data.expiresAt).toISOString() : undefined,
    };
    createMutation.mutate(payload);
  };

  const getStatusBadge = (invitation: Invitation) => {
    if (invitation.status === "accepted") {
      return (
        <Badge variant="default" className="gap-1" data-testid={`badge-status-${invitation.id}`}>
          <CheckCircle2 className="h-3 w-3" />
          Accepted
        </Badge>
      );
    } else if (invitation.status === "revoked") {
      return (
        <Badge variant="destructive" className="gap-1" data-testid={`badge-status-${invitation.id}`}>
          <XCircle className="h-3 w-3" />
          Revoked
        </Badge>
      );
    } else {
      return (
        <Badge variant="secondary" className="gap-1" data-testid={`badge-status-${invitation.id}`}>
          <Clock className="h-3 w-3" />
          Pending
        </Badge>
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Create Invitation Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Send Invitation
          </CardTitle>
          <CardDescription>
            Invite a new user to join GuardTrack. They'll be able to create an account using the email address you specify.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              {isSuperAdmin && (
                <FormField
                  control={form.control}
                  name="companyId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-invitation-company">
                            <SelectValue placeholder="Select a company" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {companies.map((c: any) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name} ({c.companyId})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        placeholder="user@example.com"
                        data-testid="input-invitation-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Initial Role</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-invitation-role">
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="guard">Guard</SelectItem>
                        <SelectItem value="steward">Steward</SelectItem>
                        <SelectItem value="supervisor">Supervisor</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="expiresAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expiry Date (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="date"
                        data-testid="input-invitation-expiry"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                disabled={createMutation.isPending}
                data-testid="button-send-invitation"
              >
                <Mail className="h-4 w-4 mr-2" />
                {createMutation.isPending ? "Sending..." : "Send Invitation"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Invitations List */}
      <Card>
        <CardHeader>
          <CardTitle>All Invitations</CardTitle>
          <CardDescription>
            Manage pending, accepted, and revoked invitations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading invitations...</div>
          ) : invitations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No invitations sent yet. Create your first invitation above.
            </div>
          ) : (
            <div className="space-y-3">
              {invitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover-elevate"
                  data-testid={`invitation-item-${invitation.id}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium" data-testid={`text-email-${invitation.id}`}>
                        {invitation.email}
                      </span>
                      {getStatusBadge(invitation)}
                      <Badge variant="outline" data-testid={`badge-role-${invitation.id}`}>
                        {invitation.role}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground ml-7">
                      Created {format(new Date(invitation.createdAt!), "MMM d, yyyy 'at' h:mm a")}
                      {invitation.acceptedAt && (
                        <> • Accepted {format(new Date(invitation.acceptedAt), "MMM d, yyyy")}</>
                      )}
                      {invitation.expiresAt && (
                        <> • Expires {format(new Date(invitation.expiresAt), "MMM d, yyyy")}</>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {invitation.status === "pending" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => revokeMutation.mutate(invitation.id)}
                        disabled={revokeMutation.isPending}
                        data-testid={`button-revoke-${invitation.id}`}
                      >
                        <Ban className="h-4 w-4 mr-1" />
                        Revoke
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(invitation.id)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-${invitation.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

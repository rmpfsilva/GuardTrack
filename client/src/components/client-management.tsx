import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Building2, Ban, Clock, Mail, CreditCard, Calendar, BarChart3, UserPlus, Trash2, CheckCircle, XCircle, AlertCircle, Shield, Check, X, GitMerge, Palette } from "lucide-react";
import { BrandingSettings } from "@/components/branding-settings";
import { format, formatDistanceToNow } from "date-fns";
import type { Company } from "@shared/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Crown } from "lucide-react";

interface ClientWithStatus extends Company {
  trialStatus: 'trial' | 'full' | 'expired';
  daysRemaining?: number;
  daysSinceJoined?: number;
}

interface TrialInvitation {
  id: string;
  email: string;
  companyName: string | null;
  durationDays: string;
  token: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
}

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string | null;
  monthlyPrice: string;
  features: Record<string, boolean>;
  limits: { maxSites: number | null; maxUsers: number | null };
  isActive: boolean;
}

export default function ClientManagement() {
  const { toast } = useToast();
  const [selectedClient, setSelectedClient] = useState<ClientWithStatus | null>(null);
  const [isTrialDialogOpen, setIsTrialDialogOpen] = useState(false);
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isMessageDialogOpen, setIsMessageDialogOpen] = useState(false);
  const [isInviteTrialDialogOpen, setIsInviteTrialDialogOpen] = useState(false);
  const [isPermissionsDialogOpen, setIsPermissionsDialogOpen] = useState(false);
  const [isDeleteInvitationDialogOpen, setIsDeleteInvitationDialogOpen] = useState(false);
  const [selectedInvitation, setSelectedInvitation] = useState<TrialInvitation | null>(null);
  const [trialDays, setTrialDays] = useState<number>(14);
  const [messageSubject, setMessageSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [blockReason, setBlockReason] = useState("");
  
  // Trial invitation form state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteCompanyName, setInviteCompanyName] = useState("");
  const [inviteDuration, setInviteDuration] = useState<"3" | "7" | "14">("14");
  
  // Plan assignment state
  const [isPlanDialogOpen, setIsPlanDialogOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState<string>("");
  const [isBrandingDialogOpen, setIsBrandingDialogOpen] = useState(false);

  const { data: clients = [], isLoading } = useQuery<ClientWithStatus[]>({
    queryKey: ["/api/super-admin/clients"],
  });

  const { data: trialInvitations = [], isLoading: isLoadingInvitations } = useQuery<TrialInvitation[]>({
    queryKey: ["/api/super-admin/trial-invitations"],
  });
  
  const { data: subscriptionPlans = [] } = useQuery<SubscriptionPlan[]>({
    queryKey: ["/api/subscription-plans"],
  });

  const blockClientMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      return await apiRequest("POST", `/api/companies/${id}/block`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      setIsBlockDialogOpen(false);
      setSelectedClient(null);
      setBlockReason("");
      toast({
        title: "Client blocked",
        description: "Client has been blocked from accessing the platform.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to block client",
        variant: "destructive",
      });
    },
  });

  const unblockClientMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("POST", `/api/companies/${id}/unblock`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      toast({
        title: "Client unblocked",
        description: "Client access has been restored.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to unblock client",
        variant: "destructive",
      });
    },
  });
  
  const assignPlanMutation = useMutation({
    mutationFn: async ({ companyId, planId }: { companyId: string; planId: string | null }) => {
      return await apiRequest("POST", `/api/companies/${companyId}/assign-plan`, {
        planId,
        subscriptionStatus: planId ? 'active' : 'trial',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      setIsPlanDialogOpen(false);
      setSelectedClient(null);
      setSelectedPlanId(null);
      toast({
        title: "Plan assigned",
        description: "Subscription plan has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to assign plan",
        variant: "destructive",
      });
    },
  });

  const deleteClientMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/companies/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      setIsDeleteDialogOpen(false);
      setSelectedClient(null);
      toast({
        title: "Client deleted",
        description: "Client and all associated data has been permanently deleted.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete client",
        variant: "destructive",
      });
    },
  });

  const mergeCompanyMutation = useMutation({
    mutationFn: async ({ sourceId, targetId }: { sourceId: string; targetId: string }) => {
      return await apiRequest("POST", `/api/companies/${sourceId}/merge-into/${targetId}`);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      setIsMergeDialogOpen(false);
      setSelectedClient(null);
      setMergeTargetId("");
      toast({
        title: "Companies merged",
        description: `All data has been moved to the target company. The duplicate has been removed.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Merge failed",
        description: error.message || "Failed to merge companies",
        variant: "destructive",
      });
    },
  });

  const setTrialMutation = useMutation({
    mutationFn: async ({ id, trialDays }: { id: string; trialDays: number }) => {
      return await apiRequest("POST", `/api/companies/${id}/trial`, { trialDays });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      setIsTrialDialogOpen(false);
      setSelectedClient(null);
      toast({
        title: "Trial updated",
        description: `Client trial has been set to ${trialDays} days.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update trial",
        variant: "destructive",
      });
    },
  });

  const removeTrialMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("POST", `/api/companies/${id}/trial/convert-to-full`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      setSelectedClient(null);
      toast({
        title: "Trial removed",
        description: "Client has been converted to full version.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove trial",
        variant: "destructive",
      });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ clientId, subject, body }: { clientId: string; subject: string; body: string }) => {
      return await apiRequest("POST", `/api/super-admin/send-message`, { clientId, subject, body });
    },
    onSuccess: () => {
      setIsMessageDialogOpen(false);
      setSelectedClient(null);
      setMessageSubject("");
      setMessageBody("");
      toast({
        title: "Message sent",
        description: "Your message has been sent to the client.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
        variant: "destructive",
      });
    },
  });

  const inviteTrialMutation = useMutation({
    mutationFn: async ({ email, companyName, durationDays }: { email: string; companyName: string; durationDays: string }) => {
      const response = await apiRequest("POST", `/api/super-admin/invite-trial`, { email, companyName, durationDays });
      return await response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/trial-invitations"] });
      setIsInviteTrialDialogOpen(false);
      setInviteEmail("");
      setInviteCompanyName("");
      setInviteDuration("14");
      
      if (data.emailSent) {
        toast({
          title: "Trial invitation sent",
          description: "The trial invitation email has been sent successfully.",
        });
      } else {
        toast({
          title: "Invitation created",
          description: data.message || "Invitation created but email delivery failed. The invitation appears in the Invitations tab.",
          variant: "default",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send trial invitation",
        variant: "destructive",
      });
    },
  });

  const deleteInvitationMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/super-admin/trial-invitations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/trial-invitations"] });
      setIsDeleteInvitationDialogOpen(false);
      setSelectedInvitation(null);
      toast({
        title: "Invitation deleted",
        description: "The trial invitation has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete invitation",
        variant: "destructive",
      });
    },
  });

  const getInvitationStatusBadge = (invitation: TrialInvitation) => {
    const now = new Date();
    const expiresAt = new Date(invitation.expiresAt);
    
    if (invitation.status === 'accepted') {
      return <Badge variant="default" className="bg-green-600" data-testid={`badge-invitation-status-${invitation.id}`}>
        <CheckCircle className="h-3 w-3 mr-1" />
        Accepted
      </Badge>;
    }
    if (invitation.status === 'expired' || expiresAt < now) {
      return <Badge variant="destructive" data-testid={`badge-invitation-status-${invitation.id}`}>
        <XCircle className="h-3 w-3 mr-1" />
        Expired
      </Badge>;
    }
    if (invitation.status === 'pending') {
      return <Badge variant="secondary" className="bg-amber-600 text-white" data-testid={`badge-invitation-status-${invitation.id}`}>
        <AlertCircle className="h-3 w-3 mr-1" />
        Pending
      </Badge>;
    }
    return <Badge variant="outline" data-testid={`badge-invitation-status-${invitation.id}`}>{invitation.status}</Badge>;
  };

  const getStatusBadge = (client: ClientWithStatus) => {
    if (client.isBlocked) {
      return <Badge variant="destructive" className="bg-red-700" data-testid={`badge-status-${client.id}`}>Blocked</Badge>;
    }
    if (client.trialStatus === 'expired') {
      return <Badge variant="destructive" data-testid={`badge-status-${client.id}`}>Expired Trial</Badge>;
    }
    if (client.trialStatus === 'trial') {
      return <Badge variant="secondary" className="bg-amber-600 text-white" data-testid={`badge-status-${client.id}`}>Trial - {client.daysRemaining} days left</Badge>;
    }
    return <Badge variant="default" className="bg-green-600" data-testid={`badge-status-${client.id}`}>Full Version</Badge>;
  };

  const getPlanName = (client: ClientWithStatus) => {
    if (!client.planId) return null;
    const plan = subscriptionPlans.find(p => p.id === client.planId);
    return plan ? plan.name : null;
  };

  const getPlanBadge = (client: ClientWithStatus) => {
    const planName = getPlanName(client);
    if (!planName) {
      return <Badge variant="outline" className="text-xs" data-testid={`badge-plan-${client.id}`}>No Plan</Badge>;
    }
    if (planName === 'Pro') {
      return <Badge variant="default" className="font-semibold" data-testid={`badge-plan-${client.id}`}><Crown className="w-3 h-3 mr-1" />{planName}</Badge>;
    }
    if (planName === 'Standard') {
      return <Badge variant="secondary" data-testid={`badge-plan-${client.id}`}>{planName}</Badge>;
    }
    return <Badge variant="outline" data-testid={`badge-plan-${client.id}`}>{planName}</Badge>;
  };

  const getDurationInfo = (client: ClientWithStatus) => {
    if (client.trialStatus === 'trial' || client.trialStatus === 'expired') {
      return client.trialEndDate ? `Trial ends ${format(new Date(client.trialEndDate), 'MMM d, yyyy')}` : 'Trial period';
    }
    // For full clients, show how long they've been a client
    return client.daysSinceJoined ? `Client for ${client.daysSinceJoined} days` : 'Full client';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Loading clients...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Client Management</h2>
          <p className="text-muted-foreground">Manage client subscriptions, trials, and communications</p>
        </div>
        <Button 
          onClick={() => setIsInviteTrialDialogOpen(true)}
          data-testid="button-invite-trial"
        >
          <UserPlus className="mr-2 h-4 w-4" />
          Invite Trial Client
        </Button>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all" data-testid="tab-all-clients">All Clients ({clients.length})</TabsTrigger>
          <TabsTrigger value="trial" data-testid="tab-trial-clients">
            Trial ({clients.filter(c => c.trialStatus === 'trial').length})
          </TabsTrigger>
          <TabsTrigger value="full" data-testid="tab-full-clients">
            Full ({clients.filter(c => c.trialStatus === 'full').length})
          </TabsTrigger>
          <TabsTrigger value="expired" data-testid="tab-expired-clients">
            Expired ({clients.filter(c => c.trialStatus === 'expired').length})
          </TabsTrigger>
          <TabsTrigger value="invitations" data-testid="tab-invitations">
            Invitations ({trialInvitations.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <div className="grid gap-4">
            {clients.map((client) => (
              <Card key={client.id} data-testid={`card-client-${client.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5" />
                        {client.name}
                        <button
                          onClick={() => { setSelectedClient(client); setIsBrandingDialogOpen(true); }}
                          title="Set brand colour"
                          className="w-5 h-5 rounded-full flex-shrink-0 border-2 border-background shadow-sm hover:scale-110 transition-transform"
                          style={{ background: (client as any).brandColor || '#2563eb' }}
                          data-testid={`swatch-header-${client.id}`}
                        />
                      </CardTitle>
                      <CardDescription>
                        {client.companyId} • {client.email}
                      </CardDescription>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex items-center gap-2">
                        {getPlanBadge(client)}
                        {getStatusBadge(client)}
                      </div>
                      <p className="text-xs text-muted-foreground">{getDurationInfo(client)}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {client.trialStatus !== 'full' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedClient(client);
                          setIsTrialDialogOpen(true);
                        }}
                        data-testid={`button-manage-trial-${client.id}`}
                      >
                        <Clock className="h-4 w-4 mr-2" />
                        Manage Trial
                      </Button>
                    )}
                    {client.trialStatus === 'trial' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedClient(client);
                          removeTrialMutation.mutate(client.id);
                        }}
                        disabled={removeTrialMutation.isPending}
                        data-testid={`button-remove-trial-${client.id}`}
                      >
                        <CreditCard className="h-4 w-4 mr-2" />
                        Convert to Full
                      </Button>
                    )}
                    {client.isBlocked ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-green-600 text-green-600 hover:bg-green-50"
                        onClick={() => unblockClientMutation.mutate(client.id)}
                        disabled={unblockClientMutation.isPending}
                        data-testid={`button-unblock-${client.id}`}
                      >
                        <Check className="h-4 w-4 mr-2" />
                        Unblock
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-red-600 text-red-600 hover:bg-red-50"
                        onClick={() => {
                          setSelectedClient(client);
                          setIsBlockDialogOpen(true);
                        }}
                        data-testid={`button-block-${client.id}`}
                      >
                        <Ban className="h-4 w-4 mr-2" />
                        Block
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setSelectedClient(client);
                        setIsDeleteDialogOpen(true);
                      }}
                      data-testid={`button-delete-${client.id}`}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Client
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedClient(client);
                        setMergeTargetId("");
                        setIsMergeDialogOpen(true);
                      }}
                      data-testid={`button-merge-${client.id}`}
                    >
                      <GitMerge className="h-4 w-4 mr-2" />
                      Merge Into...
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedClient(client);
                        setIsMessageDialogOpen(true);
                      }}
                      data-testid={`button-message-${client.id}`}
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      Send Message
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedClient(client);
                        setIsPermissionsDialogOpen(true);
                      }}
                      data-testid={`button-view-permissions-${client.id}`}
                    >
                      <Shield className="h-4 w-4 mr-2" />
                      View Permissions
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedClient(client);
                        setSelectedPlanId(client.planId || null);
                        setIsPlanDialogOpen(true);
                      }}
                      data-testid={`button-assign-plan-${client.id}`}
                    >
                      <Crown className="h-4 w-4 mr-2" />
                      Assign Plan
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedClient(client);
                        setIsBrandingDialogOpen(true);
                      }}
                      data-testid={`button-brand-colour-${client.id}`}
                    >
                      <Palette className="h-4 w-4 mr-2" />
                      Brand Colour
                    </Button>
                    {client.isBlocked && client.blockReason && (
                      <div className="w-full mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                        Block reason: {client.blockReason}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            {clients.length === 0 && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No clients registered yet</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="trial" className="mt-6">
          <div className="grid gap-4">
            {clients.filter(c => c.trialStatus === 'trial').map((client) => (
              <Card key={client.id} data-testid={`card-trial-client-${client.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5" />
                        {client.name}
                        <button
                          onClick={() => { setSelectedClient(client); setIsBrandingDialogOpen(true); }}
                          title="Set brand colour"
                          className="w-5 h-5 rounded-full flex-shrink-0 border-2 border-background shadow-sm hover:scale-110 transition-transform"
                          style={{ background: (client as any).brandColor || '#2563eb' }}
                          data-testid={`swatch-header-trial-${client.id}`}
                        />
                      </CardTitle>
                      <CardDescription>
                        {client.companyId} • {client.email}
                      </CardDescription>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex items-center gap-2">
                        {getPlanBadge(client)}
                        {getStatusBadge(client)}
                      </div>
                      <p className="text-xs text-muted-foreground">{getDurationInfo(client)}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedClient(client);
                        setIsTrialDialogOpen(true);
                      }}
                      data-testid={`button-manage-trial-${client.id}`}
                    >
                      <Clock className="h-4 w-4 mr-2" />
                      Manage Trial
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedClient(client);
                        removeTrialMutation.mutate(client.id);
                      }}
                      disabled={removeTrialMutation.isPending}
                      data-testid={`button-remove-trial-${client.id}`}
                    >
                      <CreditCard className="h-4 w-4 mr-2" />
                      Convert to Full
                    </Button>
                    {client.isBlocked ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-green-600 text-green-600 hover:bg-green-50"
                        onClick={() => unblockClientMutation.mutate(client.id)}
                        disabled={unblockClientMutation.isPending}
                        data-testid={`button-unblock-${client.id}`}
                      >
                        <Check className="h-4 w-4 mr-2" />
                        Unblock
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-red-600 text-red-600 hover:bg-red-50"
                        onClick={() => {
                          setSelectedClient(client);
                          setIsBlockDialogOpen(true);
                        }}
                        data-testid={`button-block-${client.id}`}
                      >
                        <Ban className="h-4 w-4 mr-2" />
                        Block
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setSelectedClient(client);
                        setIsDeleteDialogOpen(true);
                      }}
                      data-testid={`button-delete-${client.id}`}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Client
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedClient(client);
                        setMergeTargetId("");
                        setIsMergeDialogOpen(true);
                      }}
                      data-testid={`button-merge-${client.id}`}
                    >
                      <GitMerge className="h-4 w-4 mr-2" />
                      Merge Into...
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedClient(client);
                        setIsMessageDialogOpen(true);
                      }}
                      data-testid={`button-message-${client.id}`}
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      Send Message
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedClient(client);
                        setIsBrandingDialogOpen(true);
                      }}
                      data-testid={`button-brand-colour-trial-${client.id}`}
                    >
                      <Palette className="h-4 w-4 mr-2" />
                      Brand Colour
                    </Button>
                    {client.isBlocked && client.blockReason && (
                      <div className="w-full mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                        Block reason: {client.blockReason}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="full" className="mt-6">
          <div className="grid gap-4">
            {clients.filter(c => c.trialStatus === 'full').map((client) => (
              <Card key={client.id} data-testid={`card-full-client-${client.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5" />
                        {client.name}
                        <button
                          onClick={() => { setSelectedClient(client); setIsBrandingDialogOpen(true); }}
                          title="Set brand colour"
                          className="w-5 h-5 rounded-full flex-shrink-0 border-2 border-background shadow-sm hover:scale-110 transition-transform"
                          style={{ background: (client as any).brandColor || '#2563eb' }}
                          data-testid={`swatch-header-full-${client.id}`}
                        />
                      </CardTitle>
                      <CardDescription>
                        {client.companyId} • {client.email}
                      </CardDescription>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex items-center gap-2">
                        {getPlanBadge(client)}
                        {getStatusBadge(client)}
                      </div>
                      <p className="text-xs text-muted-foreground">{getDurationInfo(client)}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {client.isBlocked ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-green-600 text-green-600 hover:bg-green-50"
                        onClick={() => unblockClientMutation.mutate(client.id)}
                        disabled={unblockClientMutation.isPending}
                        data-testid={`button-unblock-${client.id}`}
                      >
                        <Check className="h-4 w-4 mr-2" />
                        Unblock
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-red-600 text-red-600 hover:bg-red-50"
                        onClick={() => {
                          setSelectedClient(client);
                          setIsBlockDialogOpen(true);
                        }}
                        data-testid={`button-block-${client.id}`}
                      >
                        <Ban className="h-4 w-4 mr-2" />
                        Block
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setSelectedClient(client);
                        setIsDeleteDialogOpen(true);
                      }}
                      data-testid={`button-delete-${client.id}`}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Client
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedClient(client);
                        setMergeTargetId("");
                        setIsMergeDialogOpen(true);
                      }}
                      data-testid={`button-merge-${client.id}`}
                    >
                      <GitMerge className="h-4 w-4 mr-2" />
                      Merge Into...
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedClient(client);
                        setIsMessageDialogOpen(true);
                      }}
                      data-testid={`button-message-${client.id}`}
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      Send Message
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedClient(client);
                        setIsBrandingDialogOpen(true);
                      }}
                      data-testid={`button-brand-colour-full-${client.id}`}
                    >
                      <Palette className="h-4 w-4 mr-2" />
                      Brand Colour
                    </Button>
                    {client.isBlocked && client.blockReason && (
                      <div className="w-full mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                        Block reason: {client.blockReason}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="expired" className="mt-6">
          <div className="grid gap-4">
            {clients.filter(c => c.trialStatus === 'expired').map((client) => (
              <Card key={client.id} data-testid={`card-expired-client-${client.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5" />
                        {client.name}
                        <button
                          onClick={() => { setSelectedClient(client); setIsBrandingDialogOpen(true); }}
                          title="Set brand colour"
                          className="w-5 h-5 rounded-full flex-shrink-0 border-2 border-background shadow-sm hover:scale-110 transition-transform"
                          style={{ background: (client as any).brandColor || '#2563eb' }}
                          data-testid={`swatch-header-expired-${client.id}`}
                        />
                      </CardTitle>
                      <CardDescription>
                        {client.companyId} • {client.email}
                      </CardDescription>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex items-center gap-2">
                        {getPlanBadge(client)}
                        {getStatusBadge(client)}
                      </div>
                      <p className="text-xs text-muted-foreground">{getDurationInfo(client)}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedClient(client);
                        setIsTrialDialogOpen(true);
                      }}
                      data-testid={`button-manage-trial-${client.id}`}
                    >
                      <Clock className="h-4 w-4 mr-2" />
                      Extend Trial
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedClient(client);
                        removeTrialMutation.mutate(client.id);
                      }}
                      disabled={removeTrialMutation.isPending}
                      data-testid={`button-remove-trial-${client.id}`}
                    >
                      <CreditCard className="h-4 w-4 mr-2" />
                      Convert to Full
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedClient(client);
                        setIsMessageDialogOpen(true);
                      }}
                      data-testid={`button-message-${client.id}`}
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      Send Message
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setSelectedClient(client);
                        setIsDeleteDialogOpen(true);
                      }}
                      data-testid={`button-delete-expired-${client.id}`}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Client
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedClient(client);
                        setIsBrandingDialogOpen(true);
                      }}
                      data-testid={`button-brand-colour-expired-${client.id}`}
                    >
                      <Palette className="h-4 w-4 mr-2" />
                      Brand Colour
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="invitations" className="mt-6">
          {isLoadingInvitations ? (
            <div className="flex items-center justify-center p-8">
              <p className="text-muted-foreground">Loading invitations...</p>
            </div>
          ) : trialInvitations.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center p-8">
                <Mail className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">
                  No trial invitations sent yet. Click "Invite Trial Client" to send your first invitation.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {trialInvitations.map((invitation) => (
                <Card key={invitation.id} data-testid={`card-invitation-${invitation.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2">
                          <Mail className="h-5 w-5" />
                          {invitation.email}
                        </CardTitle>
                        <CardDescription>
                          {invitation.companyName || 'Company name not provided'} • {invitation.durationDays} day trial
                        </CardDescription>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {getInvitationStatusBadge(invitation)}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span>Sent: {format(new Date(invitation.createdAt), 'MMM d, yyyy h:mm a')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          <span>
                            {invitation.status === 'accepted' && invitation.acceptedAt
                              ? `Accepted: ${format(new Date(invitation.acceptedAt), 'MMM d, yyyy h:mm a')}`
                              : `Expires: ${format(new Date(invitation.expiresAt), 'MMM d, yyyy h:mm a')}`
                            }
                          </span>
                        </div>
                        {invitation.status === 'pending' && new Date(invitation.expiresAt) > new Date() && (
                          <div className="flex items-center gap-2 text-amber-600">
                            <AlertCircle className="h-4 w-4" />
                            <span>
                              Expires {formatDistanceToNow(new Date(invitation.expiresAt), { addSuffix: true })}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 pt-2 border-t">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            setSelectedInvitation(invitation);
                            setIsDeleteInvitationDialogOpen(true);
                          }}
                          data-testid={`button-delete-invitation-${invitation.id}`}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Trial Management Dialog */}
      <Dialog open={isTrialDialogOpen} onOpenChange={setIsTrialDialogOpen}>
        <DialogContent data-testid="dialog-manage-trial">
          <DialogHeader>
            <DialogTitle>Manage Trial Period</DialogTitle>
            <DialogDescription>
              Set or extend trial period for {selectedClient?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setTrialDays(3)}
                data-testid="button-trial-3-days"
              >
                3 Days
              </Button>
              <Button
                variant="outline"
                onClick={() => setTrialDays(7)}
                data-testid="button-trial-7-days"
              >
                7 Days
              </Button>
              <Button
                variant="outline"
                onClick={() => setTrialDays(14)}
                data-testid="button-trial-14-days"
              >
                14 Days
              </Button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="trial-days">Custom Days</Label>
              <Input
                id="trial-days"
                type="number"
                value={trialDays}
                onChange={(e) => setTrialDays(parseInt(e.target.value) || 0)}
                data-testid="input-trial-days"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsTrialDialogOpen(false)}
              data-testid="button-cancel-trial"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedClient) {
                  setTrialMutation.mutate({ id: selectedClient.id, trialDays });
                }
              }}
              disabled={setTrialMutation.isPending}
              data-testid="button-set-trial"
            >
              {setTrialMutation.isPending ? "Setting..." : "Set Trial"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Block Client Dialog */}
      <Dialog open={isBlockDialogOpen} onOpenChange={(open) => {
        setIsBlockDialogOpen(open);
        if (!open) setBlockReason("");
      }}>
        <DialogContent data-testid="dialog-block-client">
          <DialogHeader>
            <DialogTitle>Block Client</DialogTitle>
            <DialogDescription>
              Are you sure you want to block {selectedClient?.name}? They will lose access to the platform.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="blockReason">Reason for blocking (optional)</Label>
              <Textarea
                id="blockReason"
                placeholder="Enter the reason for blocking this client..."
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                data-testid="input-block-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsBlockDialogOpen(false)}
              data-testid="button-cancel-block"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedClient) {
                  blockClientMutation.mutate({ id: selectedClient.id, reason: blockReason || undefined });
                }
              }}
              disabled={blockClientMutation.isPending}
              data-testid="button-confirm-block"
            >
              {blockClientMutation.isPending ? "Blocking..." : "Block Client"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Plan Assignment Dialog */}
      <Dialog open={isPlanDialogOpen} onOpenChange={(open) => {
        setIsPlanDialogOpen(open);
        if (!open) {
          setSelectedPlanId(null);
        }
      }}>
        <DialogContent data-testid="dialog-assign-plan">
          <DialogHeader>
            <DialogTitle>Assign Subscription Plan</DialogTitle>
            <DialogDescription>
              Select a subscription plan for {selectedClient?.name}. This will determine which features they can access.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="plan-select">Subscription Plan</Label>
              <Select
                value={selectedPlanId || "none"}
                onValueChange={(value) => setSelectedPlanId(value === "none" ? null : value)}
              >
                <SelectTrigger data-testid="select-plan">
                  <SelectValue placeholder="Select a plan..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Plan (Basic Access)</SelectItem>
                  {subscriptionPlans.filter(p => p.isActive).map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name} - ${plan.monthlyPrice}/mo
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedPlanId && (() => {
              const plan = subscriptionPlans.find(p => p.id === selectedPlanId);
              if (!plan) return null;
              return (
                <div className="p-4 bg-muted rounded-lg space-y-3">
                  <div>
                    <span className="font-semibold">{plan.name}</span>
                    <span className="text-muted-foreground ml-2">${plan.monthlyPrice}/month</span>
                  </div>
                  {plan.description && (
                    <p className="text-sm text-muted-foreground">{plan.description}</p>
                  )}
                  <div className="text-sm">
                    <div className="font-medium mb-1">Limits:</div>
                    <div className="flex gap-4">
                      <span>Sites: {plan.limits.maxSites ?? 'Unlimited'}</span>
                      <span>Users: {plan.limits.maxUsers ?? 'Unlimited'}</span>
                    </div>
                  </div>
                  <div className="text-sm">
                    <div className="font-medium mb-1">Features:</div>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(plan.features)
                        .filter(([_, enabled]) => enabled)
                        .map(([feature]) => (
                          <Badge key={feature} variant="secondary" className="text-xs">
                            {feature.replace(/([A-Z])/g, ' $1').trim()}
                          </Badge>
                        ))}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsPlanDialogOpen(false)}
              data-testid="button-cancel-plan"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedClient) {
                  assignPlanMutation.mutate({ 
                    companyId: selectedClient.id, 
                    planId: selectedPlanId 
                  });
                }
              }}
              disabled={assignPlanMutation.isPending}
              data-testid="button-confirm-plan"
            >
              {assignPlanMutation.isPending ? "Assigning..." : "Assign Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Client Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent data-testid="dialog-delete-client">
          <DialogHeader>
            <DialogTitle>Delete Client</DialogTitle>
            <DialogDescription className="space-y-2">
              <p className="text-destructive font-semibold">
                ⚠️ Warning: This action cannot be undone!
              </p>
              <p>
                Are you sure you want to permanently delete {selectedClient?.name}? 
                This will remove all associated data including:
              </p>
              <ul className="list-disc list-inside text-sm">
                <li>All users belonging to this company</li>
                <li>All shifts and check-ins</li>
                <li>All sites and settings</li>
                <li>All billing records</li>
              </ul>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              data-testid="button-cancel-delete"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedClient) {
                  deleteClientMutation.mutate(selectedClient.id);
                }
              }}
              disabled={deleteClientMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteClientMutation.isPending ? "Deleting..." : "Permanently Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Trial Invitation Dialog */}
      <Dialog open={isDeleteInvitationDialogOpen} onOpenChange={setIsDeleteInvitationDialogOpen}>
        <DialogContent data-testid="dialog-delete-invitation">
          <DialogHeader>
            <DialogTitle>Delete Trial Invitation</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the trial invitation for <strong>{selectedInvitation?.email}</strong>?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteInvitationDialogOpen(false);
                setSelectedInvitation(null);
              }}
              data-testid="button-cancel-delete-invitation"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedInvitation) {
                  deleteInvitationMutation.mutate(selectedInvitation.id);
                }
              }}
              disabled={deleteInvitationMutation.isPending}
              data-testid="button-confirm-delete-invitation"
            >
              {deleteInvitationMutation.isPending ? "Deleting..." : "Delete Invitation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Message Dialog */}
      <Dialog open={isMessageDialogOpen} onOpenChange={setIsMessageDialogOpen}>
        <DialogContent data-testid="dialog-send-message">
          <DialogHeader>
            <DialogTitle>Send Message to Client</DialogTitle>
            <DialogDescription>
              Send an email message to {selectedClient?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="message-subject">Subject</Label>
              <Input
                id="message-subject"
                value={messageSubject}
                onChange={(e) => setMessageSubject(e.target.value)}
                placeholder="Enter message subject"
                data-testid="input-message-subject"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="message-body">Message</Label>
              <Textarea
                id="message-body"
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                placeholder="Enter your message"
                rows={5}
                data-testid="input-message-body"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsMessageDialogOpen(false);
                setMessageSubject("");
                setMessageBody("");
              }}
              data-testid="button-cancel-message"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedClient) {
                  sendMessageMutation.mutate({
                    clientId: selectedClient.id,
                    subject: messageSubject,
                    body: messageBody,
                  });
                }
              }}
              disabled={sendMessageMutation.isPending || !messageSubject || !messageBody}
              data-testid="button-send-message"
            >
              {sendMessageMutation.isPending ? "Sending..." : "Send Message"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite Trial Client Dialog */}
      <Dialog open={isInviteTrialDialogOpen} onOpenChange={setIsInviteTrialDialogOpen}>
        <DialogContent data-testid="dialog-invite-trial">
          <DialogHeader>
            <DialogTitle>Invite Trial Client</DialogTitle>
            <DialogDescription>
              Send a trial invitation to a potential client
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email Address *</Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="client@example.com"
                data-testid="input-invite-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-company">Company Name (Optional)</Label>
              <Input
                id="invite-company"
                value={inviteCompanyName}
                onChange={(e) => setInviteCompanyName(e.target.value)}
                placeholder="Company name"
                data-testid="input-invite-company"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-duration">Trial Duration</Label>
              <select
                id="invite-duration"
                value={inviteDuration}
                onChange={(e) => setInviteDuration(e.target.value as "3" | "7" | "14")}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                data-testid="select-invite-duration"
              >
                <option value="3">3 Days</option>
                <option value="7">7 Days</option>
                <option value="14">14 Days</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsInviteTrialDialogOpen(false);
                setInviteEmail("");
                setInviteCompanyName("");
                setInviteDuration("14");
              }}
              data-testid="button-cancel-invite"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                inviteTrialMutation.mutate({
                  email: inviteEmail,
                  companyName: inviteCompanyName,
                  durationDays: inviteDuration,
                });
              }}
              disabled={inviteTrialMutation.isPending || !inviteEmail}
              data-testid="button-send-invite"
            >
              {inviteTrialMutation.isPending ? "Sending..." : "Send Invitation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Trial Permissions Dialog */}
      <Dialog open={isPermissionsDialogOpen} onOpenChange={setIsPermissionsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="dialog-trial-permissions">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Trial Access & Permissions
            </DialogTitle>
            <DialogDescription>
              {selectedClient?.trialStatus === 'trial' 
                ? `Trial users for ${selectedClient?.name} have access to the following features during their trial period` 
                : selectedClient?.trialStatus === 'expired'
                ? `Trial has expired for ${selectedClient?.name}. Limited features available until upgrade.`
                : `Full access granted to ${selectedClient?.name}`
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Full Access Section */}
            {selectedClient?.trialStatus === 'full' && (
              <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 mb-3">
                  <Check className="h-5 w-5 text-green-600" />
                  <h3 className="font-semibold text-green-900 dark:text-green-100">Full Version Access</h3>
                </div>
                <p className="text-sm text-green-800 dark:text-green-200">
                  This client has full access to all GuardTrack features with no restrictions.
                </p>
              </div>
            )}

            {/* Available Features */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Check className="h-4 w-4 text-green-600" />
                {selectedClient?.trialStatus === 'expired' ? 'Limited Features (View Only)' : 'Available Features'}
              </h3>
              <div className="grid gap-2">
                <div className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <strong>User Management:</strong> View and manage guard profiles and roles
                  </div>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <strong>Dashboard Access:</strong> View analytics and key metrics
                  </div>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <strong>Reports Viewing:</strong> Access to basic attendance and shift reports
                  </div>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <strong>Settings:</strong> Configure company information and preferences
                  </div>
                </div>
                {selectedClient?.trialStatus !== 'expired' && (
                  <>
                    <div className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <strong>Check-in/Check-out:</strong> Guards can log their shifts with geolocation
                      </div>
                    </div>
                    <div className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <strong>Shift Scheduling:</strong> Create and manage guard shift schedules
                      </div>
                    </div>
                    <div className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <strong>Site Management:</strong> Configure security sites and locations
                      </div>
                    </div>
                    <div className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <strong>Break Tracking:</strong> Monitor and approve guard break times
                      </div>
                    </div>
                    <div className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <strong>Overtime Management:</strong> Track and approve overtime requests
                      </div>
                    </div>
                    <div className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <strong>Leave Requests:</strong> Submit and manage time-off requests
                      </div>
                    </div>
                    <div className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <strong>Notice Board:</strong> Post and view company announcements
                      </div>
                    </div>
                    <div className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <strong>Push Notifications:</strong> Real-time alerts for important events
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Restricted Features for Expired Trials */}
            {selectedClient?.trialStatus === 'expired' && (
              <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
                <h3 className="font-semibold mb-3 flex items-center gap-2 text-red-900 dark:text-red-100">
                  <X className="h-4 w-4" />
                  Restricted Features (Upgrade Required)
                </h3>
                <div className="grid gap-2">
                  <div className="flex items-start gap-2 text-sm text-red-800 dark:text-red-200">
                    <X className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div><strong>Check-in/Check-out:</strong> Shift logging is disabled</div>
                  </div>
                  <div className="flex items-start gap-2 text-sm text-red-800 dark:text-red-200">
                    <X className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div><strong>Shift Management:</strong> Cannot create or edit shifts</div>
                  </div>
                  <div className="flex items-start gap-2 text-sm text-red-800 dark:text-red-200">
                    <X className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div><strong>Site Management:</strong> Cannot add or modify sites</div>
                  </div>
                  <div className="flex items-start gap-2 text-sm text-red-800 dark:text-red-200">
                    <X className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div><strong>Company Partnerships:</strong> Cannot request or manage partnerships</div>
                  </div>
                  <div className="flex items-start gap-2 text-sm text-red-800 dark:text-red-200">
                    <X className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div><strong>Job Sharing:</strong> Cannot share or receive job requests</div>
                  </div>
                  <div className="flex items-start gap-2 text-sm text-red-800 dark:text-red-200">
                    <X className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div><strong>Notices:</strong> Cannot post announcements</div>
                  </div>
                  <div className="flex items-start gap-2 text-sm text-red-800 dark:text-red-200">
                    <X className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div><strong>Leave Requests:</strong> Cannot submit new leave requests</div>
                  </div>
                </div>
              </div>
            )}

            {/* Trial Information */}
            {selectedClient?.trialStatus !== 'full' && (
              <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <h3 className="font-semibold mb-2 text-blue-900 dark:text-blue-100">Trial Information</h3>
                <div className="space-y-1 text-sm text-blue-800 dark:text-blue-200">
                  <p><strong>Status:</strong> {selectedClient?.trialStatus === 'trial' ? `Active (${selectedClient?.daysRemaining} days remaining)` : 'Expired'}</p>
                  <p><strong>Access Level:</strong> {selectedClient?.trialStatus === 'trial' ? 'Full features during trial' : 'Limited to view-only'}</p>
                  {selectedClient?.trialStatus === 'expired' && (
                    <p className="mt-2 font-medium">Users from this company are blocked from logging in until the trial is extended or upgraded to full version.</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsPermissionsDialogOpen(false)}
              data-testid="button-close-permissions"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Brand Colour Dialog */}
      <Dialog open={isBrandingDialogOpen} onOpenChange={(open) => {
        setIsBrandingDialogOpen(open);
        if (!open) setSelectedClient(null);
      }}>
        <DialogContent className="max-w-lg" data-testid="dialog-brand-colour">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-primary" />
              Brand Colour
            </DialogTitle>
            <DialogDescription>
              Set a brand colour for <strong>{selectedClient?.name}</strong>. This themes their GuardTrack dashboard.
            </DialogDescription>
          </DialogHeader>
          {selectedClient && (
            <BrandingSettings
              companyId={selectedClient.id}
              companyName={selectedClient.name}
              currentColour={(selectedClient as any).brandColor ?? null}
              isSuperAdmin={true}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Merge Companies Dialog */}
      <Dialog open={isMergeDialogOpen} onOpenChange={(open) => {
        setIsMergeDialogOpen(open);
        if (!open) { setMergeTargetId(""); setSelectedClient(null); }
      }}>
        <DialogContent data-testid="dialog-merge-company">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitMerge className="h-5 w-5 text-primary" />
              Merge Company
            </DialogTitle>
            <DialogDescription>
              Move all data from <strong>{selectedClient?.name}</strong> into another company, then permanently delete this duplicate.
              This cannot be undone. Users, sites, shifts, invoices, and all other data will be transferred.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="merge-target">Merge into (keep this company)</Label>
              <Select value={mergeTargetId} onValueChange={setMergeTargetId}>
                <SelectTrigger id="merge-target" data-testid="select-merge-target">
                  <SelectValue placeholder="Select the company to keep..." />
                </SelectTrigger>
                <SelectContent>
                  {clients
                    .filter(c => c.id !== selectedClient?.id)
                    .map(c => (
                      <SelectItem key={c.id} value={c.id} data-testid={`merge-option-${c.id}`}>
                        {c.name} ({c.companyId})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {mergeTargetId && (
              <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-300 space-y-1">
                <p className="font-semibold">What will happen:</p>
                <ul className="list-disc list-inside space-y-0.5 text-xs">
                  <li>All users, sites, shifts, and data from <strong>{selectedClient?.name}</strong> will move to <strong>{clients.find(c => c.id === mergeTargetId)?.name}</strong></li>
                  <li><strong>{selectedClient?.name}</strong> will be permanently deleted</li>
                  <li>Users who belong to both companies will be deduplicated automatically</li>
                </ul>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setIsMergeDialogOpen(false)} data-testid="button-cancel-merge">
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!mergeTargetId || mergeCompanyMutation.isPending}
              onClick={() => {
                if (selectedClient && mergeTargetId) {
                  mergeCompanyMutation.mutate({ sourceId: selectedClient.id, targetId: mergeTargetId });
                }
              }}
              data-testid="button-confirm-merge"
            >
              {mergeCompanyMutation.isPending ? "Merging..." : "Confirm Merge"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

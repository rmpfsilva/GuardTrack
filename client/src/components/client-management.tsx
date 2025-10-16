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
import { Building2, Ban, Clock, Mail, CreditCard, Calendar, BarChart3, UserPlus } from "lucide-react";
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

interface ClientWithStatus extends Company {
  trialStatus: 'trial' | 'full' | 'expired';
  daysRemaining?: number;
  daysSinceJoined?: number;
}

export default function ClientManagement() {
  const { toast } = useToast();
  const [selectedClient, setSelectedClient] = useState<ClientWithStatus | null>(null);
  const [isTrialDialogOpen, setIsTrialDialogOpen] = useState(false);
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false);
  const [isMessageDialogOpen, setIsMessageDialogOpen] = useState(false);
  const [isInviteTrialDialogOpen, setIsInviteTrialDialogOpen] = useState(false);
  const [trialDays, setTrialDays] = useState<number>(14);
  const [messageSubject, setMessageSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  
  // Trial invitation form state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteCompanyName, setInviteCompanyName] = useState("");
  const [inviteDuration, setInviteDuration] = useState<"3" | "7" | "14">("14");

  const { data: clients = [], isLoading } = useQuery<ClientWithStatus[]>({
    queryKey: ["/api/super-admin/clients"],
  });

  const blockClientMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("POST", `/api/companies/${id}/block`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      setIsBlockDialogOpen(false);
      setSelectedClient(null);
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
      return await apiRequest("POST", `/api/super-admin/invite-trial`, { email, companyName, durationDays });
    },
    onSuccess: () => {
      setIsInviteTrialDialogOpen(false);
      setInviteEmail("");
      setInviteCompanyName("");
      setInviteDuration("14");
      toast({
        title: "Trial invitation sent",
        description: "The trial invitation has been sent successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send trial invitation",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (client: ClientWithStatus) => {
    if (client.trialStatus === 'expired') {
      return <Badge variant="destructive" data-testid={`badge-status-${client.id}`}>Expired Trial</Badge>;
    }
    if (client.trialStatus === 'trial') {
      return <Badge variant="secondary" className="bg-amber-600 text-white" data-testid={`badge-status-${client.id}`}>Trial - {client.daysRemaining} days left</Badge>;
    }
    return <Badge variant="default" className="bg-green-600" data-testid={`badge-status-${client.id}`}>Full Version</Badge>;
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
                      </CardTitle>
                      <CardDescription>
                        {client.companyId} • {client.email}
                      </CardDescription>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {getStatusBadge(client)}
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
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedClient(client);
                        setIsBlockDialogOpen(true);
                      }}
                      data-testid={`button-block-${client.id}`}
                    >
                      <Ban className="h-4 w-4 mr-2" />
                      Block Client
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
                {/* Same card content as "all" tab */}
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5" />
                        {client.name}
                      </CardTitle>
                      <CardDescription>
                        {client.companyId} • {client.email}
                      </CardDescription>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {getStatusBadge(client)}
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
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedClient(client);
                        setIsBlockDialogOpen(true);
                      }}
                      data-testid={`button-block-${client.id}`}
                    >
                      <Ban className="h-4 w-4 mr-2" />
                      Block Client
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
                {/* Same card content */}
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5" />
                        {client.name}
                      </CardTitle>
                      <CardDescription>
                        {client.companyId} • {client.email}
                      </CardDescription>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {getStatusBadge(client)}
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
                      Set Trial
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedClient(client);
                        setIsBlockDialogOpen(true);
                      }}
                      data-testid={`button-block-${client.id}`}
                    >
                      <Ban className="h-4 w-4 mr-2" />
                      Block Client
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
                {/* Same card content */}
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5" />
                        {client.name}
                      </CardTitle>
                      <CardDescription>
                        {client.companyId} • {client.email}
                      </CardDescription>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {getStatusBadge(client)}
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
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
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
      <Dialog open={isBlockDialogOpen} onOpenChange={setIsBlockDialogOpen}>
        <DialogContent data-testid="dialog-block-client">
          <DialogHeader>
            <DialogTitle>Block Client</DialogTitle>
            <DialogDescription>
              Are you sure you want to block {selectedClient?.name}? They will lose access to the platform.
            </DialogDescription>
          </DialogHeader>
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
                  blockClientMutation.mutate(selectedClient.id);
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
    </div>
  );
}

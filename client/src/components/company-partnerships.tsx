import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertCompanyPartnershipSchema } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { CompanyPartnershipWithDetails, Company } from "@shared/schema";
import { Search, Send, CheckCircle, XCircle, Clock, Trash2 } from "lucide-react";

const partnershipFormSchema = insertCompanyPartnershipSchema.omit({
  toCompanyId: true,
  fromCompanyId: true,
  requestedBy: true,
});

type PartnershipFormData = z.infer<typeof partnershipFormSchema>;

export default function CompanyPartnerships() {
  const { toast } = useToast();
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchedCompany, setSearchedCompany] = useState<Company | null>(null);
  const [deletingPartnershipId, setDeletingPartnershipId] = useState<string | null>(null);

  // Fetch partnerships
  const { data: sentPartnerships = [], isLoading: loadingSent } = useQuery<CompanyPartnershipWithDetails[]>({
    queryKey: ['/api/partnerships/sent'],
  });

  const { data: receivedPartnerships = [], isLoading: loadingReceived } = useQuery<CompanyPartnershipWithDetails[]>({
    queryKey: ['/api/partnerships/received'],
  });

  const { data: acceptedPartnerships = [], isLoading: loadingAccepted } = useQuery<CompanyPartnershipWithDetails[]>({
    queryKey: ['/api/partnerships/accepted'],
  });

  // Search for company mutation
  const searchCompanyMutation = useMutation({
    mutationFn: async (searchTerm: string) => {
      const response = await apiRequest('POST', '/api/partnerships/search', { searchTerm });
      const data = await response.json();
      return data as Company;
    },
    onSuccess: (data: Company) => {
      setSearchedCompany(data);
      toast({
        title: "Company found",
        description: `Found: ${data.name}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Company not found",
        description: error.message || "No company found with that name or email",
        variant: "destructive",
      });
      setSearchedCompany(null);
    },
  });

  // Form for sending partnership request
  const form = useForm<PartnershipFormData>({
    resolver: zodResolver(partnershipFormSchema),
    defaultValues: {
      message: "",
      status: "pending",
    },
  });

  // Create partnership mutation
  const createPartnershipMutation = useMutation({
    mutationFn: async (data: PartnershipFormData) => {
      const response = await apiRequest('POST', '/api/partnerships', data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/partnerships/sent'] });
      queryClient.invalidateQueries({ queryKey: ['/api/partnerships/received'] });
      queryClient.invalidateQueries({ queryKey: ['/api/partnerships/accepted'] });
      setSearchDialogOpen(false);
      setSearchedCompany(null);
      setSearchTerm("");
      form.reset();
      toast({
        title: "Partnership request sent",
        description: "The company will be notified of your request",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send request",
        description: error.message || "Could not send partnership request",
        variant: "destructive",
      });
    },
  });

  // Accept/Reject partnership mutation
  const updatePartnershipMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await apiRequest('PATCH', `/api/partnerships/${id}`, { status });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/partnerships/sent'] });
      queryClient.invalidateQueries({ queryKey: ['/api/partnerships/received'] });
      queryClient.invalidateQueries({ queryKey: ['/api/partnerships/accepted'] });
      toast({
        title: "Partnership updated",
        description: "Partnership status has been updated",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update partnership",
        description: error.message || "Could not update partnership",
        variant: "destructive",
      });
    },
  });

  // Delete/Cancel partnership handler
  const handleDeletePartnership = async (id: string) => {
    setDeletingPartnershipId(id);
    try {
      await apiRequest('DELETE', `/api/partnerships/${id}`);
      queryClient.invalidateQueries({ queryKey: ['/api/partnerships/sent'] });
      queryClient.invalidateQueries({ queryKey: ['/api/partnerships/received'] });
      queryClient.invalidateQueries({ queryKey: ['/api/partnerships/accepted'] });
      toast({
        title: "Partnership cancelled",
        description: "The partnership has been cancelled",
      });
    } catch (error: any) {
      toast({
        title: "Failed to cancel partnership",
        description: error.message || "Could not cancel partnership",
        variant: "destructive",
      });
    } finally {
      setDeletingPartnershipId(null);
    }
  };

  const handleSearch = () => {
    if (searchTerm.trim()) {
      searchCompanyMutation.mutate(searchTerm);
    }
  };

  const onSubmit = (data: PartnershipFormData) => {
    if (!searchedCompany) {
      toast({
        title: "Error",
        description: "Please search and select a company first",
        variant: "destructive",
      });
      return;
    }

    const partnershipData = {
      ...data,
      toCompanyId: searchedCompany.id,
    };

    createPartnershipMutation.mutate(partnershipData);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" data-testid={`badge-status-pending`}><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'accepted':
        return <Badge variant="default" data-testid={`badge-status-accepted`}><CheckCircle className="w-3 h-3 mr-1" />Accepted</Badge>;
      case 'rejected':
        return <Badge variant="destructive" data-testid={`badge-status-rejected`}><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="outline" data-testid={`badge-status-${status}`}>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6" data-testid="container-partnerships">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" data-testid="heading-partnerships">Company Partnerships</h2>
          <p className="text-muted-foreground" data-testid="text-partnerships-description">
            Establish partnerships with other companies to share job opportunities
          </p>
        </div>
        <Dialog open={searchDialogOpen} onOpenChange={setSearchDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-request-partnership">
              <Send className="w-4 h-4 mr-2" />
              Request Partnership
            </Button>
          </DialogTrigger>
          <DialogContent data-testid="dialog-request-partnership">
            <DialogHeader>
              <DialogTitle data-testid="heading-dialog-title">Request Company Partnership</DialogTitle>
              <DialogDescription data-testid="text-dialog-description">
                Search for a company by name or admin email to send a partnership request
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Company ID, name, or admin email"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  data-testid="input-search-company"
                />
                <Button
                  onClick={handleSearch}
                  disabled={searchCompanyMutation.isPending || !searchTerm.trim()}
                  data-testid="button-search-company"
                >
                  <Search className="w-4 h-4" />
                </Button>
              </div>

              {searchedCompany && (
                <Card data-testid="card-searched-company">
                  <CardHeader>
                    <CardTitle data-testid="text-company-name">{searchedCompany.name}</CardTitle>
                    <CardDescription data-testid="text-company-id">
                      Company ID: {searchedCompany.companyId}
                    </CardDescription>
                    <CardDescription data-testid="text-company-email">{searchedCompany.email}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                          control={form.control}
                          name="message"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Message (Optional)</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="Add a message with your partnership request..."
                                  {...field}
                                  value={field.value || ""}
                                  data-testid="input-partnership-message"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <Button
                          type="submit"
                          disabled={createPartnershipMutation.isPending}
                          className="w-full"
                          data-testid="button-send-request"
                        >
                          {createPartnershipMutation.isPending ? "Sending..." : "Send Partnership Request"}
                        </Button>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="received" data-testid="tabs-partnerships">
        <TabsList data-testid="tablist-partnerships">
          <TabsTrigger value="received" data-testid="tab-received-requests">Received Requests</TabsTrigger>
          <TabsTrigger value="sent" data-testid="tab-sent-requests">Sent Requests</TabsTrigger>
          <TabsTrigger value="active" data-testid="tab-active-partnerships">Active Partnerships</TabsTrigger>
        </TabsList>

        <TabsContent value="received" className="space-y-4" data-testid="content-received">
          {loadingReceived ? (
            <p data-testid="text-loading-received">Loading...</p>
          ) : receivedPartnerships.length === 0 ? (
            <Card data-testid="card-no-received">
              <CardContent className="py-8 text-center text-muted-foreground">
                No partnership requests received
              </CardContent>
            </Card>
          ) : (
            receivedPartnerships.map((partnership) => (
              <Card key={partnership.id} data-testid={`card-partnership-${partnership.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle data-testid={`text-from-company-${partnership.id}`}>{partnership.fromCompany.name}</CardTitle>
                      <CardDescription data-testid={`text-requester-${partnership.id}`}>
                        Requested by: {partnership.requester.firstName} {partnership.requester.lastName}
                      </CardDescription>
                    </div>
                    {getStatusBadge(partnership.status)}
                  </div>
                </CardHeader>
                {partnership.message && (
                  <CardContent>
                    <p className="text-sm text-muted-foreground" data-testid={`text-message-${partnership.id}`}>
                      "{partnership.message}"
                    </p>
                  </CardContent>
                )}
                {partnership.status === 'pending' && (
                  <CardContent className="flex gap-2">
                    <Button
                      onClick={() => updatePartnershipMutation.mutate({ id: partnership.id, status: 'accepted' })}
                      disabled={updatePartnershipMutation.isPending}
                      data-testid={`button-accept-${partnership.id}`}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Accept
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => updatePartnershipMutation.mutate({ id: partnership.id, status: 'rejected' })}
                      disabled={updatePartnershipMutation.isPending}
                      data-testid={`button-reject-${partnership.id}`}
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Reject
                    </Button>
                  </CardContent>
                )}
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="sent" className="space-y-4" data-testid="content-sent">
          {loadingSent ? (
            <p data-testid="text-loading-sent">Loading...</p>
          ) : sentPartnerships.length === 0 ? (
            <Card data-testid="card-no-sent">
              <CardContent className="py-8 text-center text-muted-foreground">
                No partnership requests sent
              </CardContent>
            </Card>
          ) : (
            sentPartnerships.map((partnership) => (
              <Card key={partnership.id} data-testid={`card-partnership-${partnership.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle data-testid={`text-to-company-${partnership.id}`}>{partnership.toCompany.name}</CardTitle>
                      <CardDescription data-testid={`text-created-at-${partnership.id}`}>
                        Sent on: {new Date(partnership.createdAt!).toLocaleDateString()}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(partnership.status)}
                      {partnership.status === 'pending' && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDeletePartnership(partnership.id)}
                          disabled={deletingPartnershipId === partnership.id}
                          data-testid={`button-cancel-${partnership.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                {partnership.message && (
                  <CardContent>
                    <p className="text-sm text-muted-foreground" data-testid={`text-message-${partnership.id}`}>
                      "{partnership.message}"
                    </p>
                  </CardContent>
                )}
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="active" className="space-y-4" data-testid="content-active">
          {loadingAccepted ? (
            <p data-testid="text-loading-active">Loading...</p>
          ) : acceptedPartnerships.length === 0 ? (
            <Card data-testid="card-no-active">
              <CardContent className="py-8 text-center text-muted-foreground">
                No active partnerships yet
              </CardContent>
            </Card>
          ) : (
            acceptedPartnerships.map((partnership) => (
              <Card key={partnership.id} data-testid={`card-partnership-${partnership.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle data-testid={`text-partner-company-${partnership.id}`}>
                        {partnership.fromCompanyId === partnership.fromCompany.id ? partnership.toCompany.name : partnership.fromCompany.name}
                      </CardTitle>
                      <CardDescription data-testid={`text-accepted-at-${partnership.id}`}>
                        Partnership established on: {partnership.reviewedAt ? new Date(partnership.reviewedAt).toLocaleDateString() : 'N/A'}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(partnership.status)}
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleDeletePartnership(partnership.id)}
                        disabled={deletingPartnershipId === partnership.id}
                        data-testid={`button-cancel-partnership-${partnership.id}`}
                        title="Cancel partnership"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

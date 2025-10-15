import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Briefcase, Building2, Calendar, DollarSign, Users, Plus, Check, X, Clock, MapPin } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertJobShareSchema } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { JobShareWithDetails, Company, Site } from "@shared/schema";

const jobShareFormSchema = insertJobShareSchema.extend({
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
});

type JobShareFormData = z.infer<typeof jobShareFormSchema>;

export default function JobSharing() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'offered' | 'received'>('offered');

  const form = useForm<JobShareFormData>({
    resolver: zodResolver(jobShareFormSchema),
    defaultValues: {
      toCompanyId: "",
      siteId: "",
      numberOfJobs: "1",
      startDate: "",
      endDate: "",
      workingRole: "guard",
      hourlyRate: "15.00",
      requirements: "",
    },
  });

  // Fetch companies (exclude current company) - using dedicated endpoint for job sharing
  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ['/api/companies/for-job-sharing'],
  });

  // Fetch sites (current company's sites)
  const { data: sites = [] } = useQuery<Site[]>({
    queryKey: ['/api/sites'],
    select: (data) => data.filter(s => s.companyId === user?.companyId),
  });

  // Fetch offered job shares
  const { data: offeredShares = [], refetch: refetchOffered } = useQuery<JobShareWithDetails[]>({
    queryKey: ['/api/job-shares/offered'],
  });

  // Fetch received job shares
  const { data: receivedShares = [], refetch: refetchReceived } = useQuery<JobShareWithDetails[]>({
    queryKey: ['/api/job-shares/received'],
  });

  // Create job share mutation
  const createMutation = useMutation({
    mutationFn: async (data: JobShareFormData) => {
      return await apiRequest('/api/job-shares', 'POST', {
        ...data,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Job share request sent successfully",
      });
      setIsCreateDialogOpen(false);
      form.reset();
      refetchOffered();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create job share",
        variant: "destructive",
      });
    },
  });

  // Accept/Reject job share mutations
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      return await apiRequest(`/api/job-shares/${id}`, 'PATCH', { status, reviewNotes: notes });
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Success",
        description: `Job share ${variables.status}`,
      });
      refetchReceived();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update job share",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: JobShareFormData) => {
    createMutation.mutate(data);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20">
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>;
      case 'accepted':
        return <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">
          <Check className="h-3 w-3 mr-1" />
          Accepted
        </Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20">
          <X className="h-3 w-3 mr-1" />
          Rejected
        </Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Job Sharing</h2>
          <p className="text-muted-foreground">Share guard job requests with other companies</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-job-share">
              <Plus className="h-4 w-4 mr-2" />
              Create Job Share
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Job Share Request</DialogTitle>
              <DialogDescription>
                Share available guard positions with another company
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="toCompanyId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-company">
                            <SelectValue placeholder="Select company" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {companies.map(company => (
                            <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="siteId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Site</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-site">
                            <SelectValue placeholder="Select site" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {sites.map(site => (
                            <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="numberOfJobs"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Number of Positions</FormLabel>
                        <FormControl>
                          <Input type="number" min="1" {...field} data-testid="input-number-of-jobs" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="workingRole"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-role">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="guard">Guard</SelectItem>
                            <SelectItem value="steward">Steward</SelectItem>
                            <SelectItem value="supervisor">Supervisor</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} data-testid="input-start-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} data-testid="input-end-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="hourlyRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hourly Rate (£)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="0" {...field} data-testid="input-hourly-rate" />
                      </FormControl>
                      <FormDescription>
                        Amount you're offering per hour
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="requirements"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Requirements</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Any special requirements or notes..." 
                          {...field} 
                          value={field.value || ""}
                          data-testid="textarea-requirements"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-job-share">
                    {createMutation.isPending ? "Creating..." : "Create Job Share"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabs for offered vs received */}
      <div className="flex gap-2 border-b">
        <Button
          variant={selectedTab === 'offered' ? 'default' : 'ghost'}
          onClick={() => setSelectedTab('offered')}
          data-testid="tab-offered-shares"
        >
          Offered to Others
        </Button>
        <Button
          variant={selectedTab === 'received' ? 'default' : 'ghost'}
          onClick={() => setSelectedTab('received')}
          data-testid="tab-received-shares"
        >
          Received from Others
        </Button>
      </div>

      {/* Offered Shares */}
      {selectedTab === 'offered' && (
        <div className="grid gap-4">
          {offeredShares.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No job shares offered yet. Create one to get started!
              </CardContent>
            </Card>
          ) : (
            offeredShares.map(share => (
              <Card key={share.id} data-testid={`job-share-${share.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5" />
                        {share.toCompany.name}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <MapPin className="h-4 w-4" />
                        {share.site.name}
                      </CardDescription>
                    </div>
                    {getStatusBadge(share.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Positions</p>
                      <p className="font-semibold flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {share.numberOfJobs}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Role</p>
                      <p className="font-semibold capitalize">{share.workingRole}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Rate</p>
                      <p className="font-semibold flex items-center gap-1">
                        <DollarSign className="h-4 w-4" />
                        £{share.hourlyRate}/hr
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Period</p>
                      <p className="text-sm font-semibold">
                        {format(new Date(share.startDate), "MMM d")} - {format(new Date(share.endDate), "MMM d, yyyy")}
                      </p>
                    </div>
                  </div>
                  {share.requirements && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Requirements</p>
                      <p className="text-sm">{share.requirements}</p>
                    </div>
                  )}
                  {share.reviewNotes && (
                    <div className="pt-2 border-t">
                      <p className="text-sm text-muted-foreground mb-1">Response</p>
                      <p className="text-sm">{share.reviewNotes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Received Shares */}
      {selectedTab === 'received' && (
        <div className="grid gap-4">
          {receivedShares.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No job share requests received yet
              </CardContent>
            </Card>
          ) : (
            receivedShares.map(share => (
              <Card key={share.id} data-testid={`received-share-${share.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5" />
                        {share.fromCompany.name}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <MapPin className="h-4 w-4" />
                        {share.site.name}
                      </CardDescription>
                    </div>
                    {getStatusBadge(share.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Positions</p>
                      <p className="font-semibold flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {share.numberOfJobs}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Role</p>
                      <p className="font-semibold capitalize">{share.workingRole}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Rate</p>
                      <p className="font-semibold flex items-center gap-1">
                        <DollarSign className="h-4 w-4" />
                        £{share.hourlyRate}/hr
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Period</p>
                      <p className="text-sm font-semibold">
                        {format(new Date(share.startDate), "MMM d")} - {format(new Date(share.endDate), "MMM d, yyyy")}
                      </p>
                    </div>
                  </div>
                  {share.requirements && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Requirements</p>
                      <p className="text-sm">{share.requirements}</p>
                    </div>
                  )}
                  
                  {share.status === 'pending' && (
                    <div className="flex gap-2 pt-2 border-t">
                      <Button
                        size="sm"
                        onClick={() => updateStatusMutation.mutate({ id: share.id, status: 'accepted' })}
                        disabled={updateStatusMutation.isPending}
                        data-testid={`button-accept-${share.id}`}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => updateStatusMutation.mutate({ id: share.id, status: 'rejected' })}
                        disabled={updateStatusMutation.isPending}
                        data-testid={`button-reject-${share.id}`}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Plus, Edit, Trash2, Building2, Timer, Check } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCompanySchema, type InsertCompany, type Company } from "@shared/schema";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";

export default function CompanyManagement() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [deletingCompany, setDeletingCompany] = useState<Company | null>(null);
  const [trialCompany, setTrialCompany] = useState<Company | null>(null);
  const [trialDays, setTrialDays] = useState<number>(14);

  const { data: companies = [], isLoading } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const createForm = useForm<InsertCompany>({
    resolver: zodResolver(insertCompanySchema),
    defaultValues: {
      name: "",
      address: "",
      email: "",
      phone: "",
      taxId: "",
      registrationNumber: "",
      logoUrl: "",
      isActive: true,
    },
  });

  const editForm = useForm<InsertCompany>({
    resolver: zodResolver(insertCompanySchema),
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertCompany) => {
      return await apiRequest("POST", "/api/companies", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      setIsCreateDialogOpen(false);
      createForm.reset();
      toast({
        title: "Company created",
        description: "The company has been created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create company",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertCompany> }) => {
      return await apiRequest("PATCH", `/api/companies/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      setEditingCompany(null);
      toast({
        title: "Company updated",
        description: "The company has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update company",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/companies/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      setDeletingCompany(null);
      toast({
        title: "Company deleted",
        description: "The company has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete company",
        variant: "destructive",
      });
    },
  });

  const setTrialMutation = useMutation({
    mutationFn: async ({ id, trialDays }: { id: string; trialDays: number }) => {
      return await apiRequest("POST", `/api/companies/${id}/trial`, { trialDays });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      setTrialCompany(null);
      toast({
        title: "Trial set",
        description: `Company trial has been set to ${trialDays} days.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to set trial",
        variant: "destructive",
      });
    },
  });

  const convertToFullMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("POST", `/api/companies/${id}/trial/convert-to-full`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      setTrialCompany(null);
      toast({
        title: "Converted to full",
        description: "Company has been converted to full version.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to convert to full",
        variant: "destructive",
      });
    },
  });

  const handleCreate = (data: InsertCompany) => {
    createMutation.mutate(data);
  };

  const handleEdit = (data: InsertCompany) => {
    if (editingCompany) {
      updateMutation.mutate({ id: editingCompany.id, data });
    }
  };

  const openEditDialog = (company: Company) => {
    setEditingCompany(company);
    editForm.reset({
      name: company.name,
      address: company.address || "",
      email: company.email || "",
      phone: company.phone || "",
      taxId: company.taxId || "",
      registrationNumber: company.registrationNumber || "",
      logoUrl: company.logoUrl || "",
      isActive: company.isActive,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Loading companies...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Company Management</h2>
          <p className="text-muted-foreground">Manage all companies in the system</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-company">
              <Plus className="h-4 w-4 mr-2" />
              Add Company
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Company</DialogTitle>
              <DialogDescription>
                Add a new security company to the platform
              </DialogDescription>
            </DialogHeader>
            <Form {...createForm}>
              <form onSubmit={createForm.handleSubmit(handleCreate)} className="space-y-4">
                <FormField
                  control={createForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Name *</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-company-name" placeholder="Acme Security Services" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={createForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" data-testid="input-company-email" placeholder="info@company.com" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-company-phone" placeholder="+1 234 567 890" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={createForm.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Textarea {...field} data-testid="input-company-address" placeholder="123 Main St, City, State, ZIP" rows={2} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={createForm.control}
                    name="taxId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tax ID</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-company-tax-id" placeholder="XX-XXXXXXX" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="registrationNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Registration Number</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-company-reg-number" placeholder="REG123456" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={createForm.control}
                  name="logoUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Logo URL</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-company-logo-url" placeholder="https://example.com/logo.png" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <FormLabel>Active Status</FormLabel>
                        <p className="text-sm text-muted-foreground">Enable or disable this company</p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-company-active"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                    data-testid="button-cancel-create"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-create">
                    {createMutation.isPending ? "Creating..." : "Create Company"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {companies.map((company) => (
          <Card key={company.id} data-testid={`card-company-${company.id}`}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg" data-testid={`text-company-name-${company.id}`}>{company.name}</CardTitle>
                    <div className="flex gap-2 mt-1">
                      <Badge variant={company.isActive ? "default" : "secondary"}>
                        {company.isActive ? "Active" : "Inactive"}
                      </Badge>
                      {company.trialStatus === 'trial' && (
                        <Badge variant="outline" className="border-amber-500 text-amber-600">
                          <Timer className="h-3 w-3 mr-1" />
                          Trial
                        </Badge>
                      )}
                      {company.trialStatus === 'full' && (
                        <Badge variant="outline" className="border-green-500 text-green-600">
                          <Check className="h-3 w-3 mr-1" />
                          Full
                        </Badge>
                      )}
                      {company.trialStatus === 'expired' && (
                        <Badge variant="destructive">
                          Expired
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {company.email && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Email:</span>{" "}
                  <span data-testid={`text-company-email-${company.id}`}>{company.email}</span>
                </div>
              )}
              {company.phone && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Phone:</span>{" "}
                  <span data-testid={`text-company-phone-${company.id}`}>{company.phone}</span>
                </div>
              )}
              {company.address && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Address:</span>{" "}
                  <span className="line-clamp-2" data-testid={`text-company-address-${company.id}`}>{company.address}</span>
                </div>
              )}
              <div className="flex gap-2 pt-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEditDialog(company)}
                  data-testid={`button-edit-company-${company.id}`}
                >
                  <Edit className="h-3 w-3 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setTrialCompany(company); setTrialDays(14); }}
                  data-testid={`button-manage-trial-${company.id}`}
                >
                  <Timer className="h-3 w-3 mr-1" />
                  Trial
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeletingCompany(company)}
                  data-testid={`button-delete-company-${company.id}`}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingCompany} onOpenChange={(open) => !open && setEditingCompany(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Company</DialogTitle>
            <DialogDescription>
              Update company information
            </DialogDescription>
          </DialogHeader>
          {editingCompany && (
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(handleEdit)} className="space-y-4">
                <FormField
                  control={editForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Name *</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-edit-company-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={editForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" data-testid="input-edit-company-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-edit-company-phone" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={editForm.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Textarea {...field} data-testid="input-edit-company-address" rows={2} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={editForm.control}
                    name="taxId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tax ID</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-edit-company-tax-id" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="registrationNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Registration Number</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-edit-company-reg-number" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={editForm.control}
                  name="logoUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Logo URL</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-edit-company-logo-url" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <FormLabel>Active Status</FormLabel>
                        <p className="text-sm text-muted-foreground">Enable or disable this company</p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-edit-company-active"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditingCompany(null)}
                    data-testid="button-cancel-edit"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updateMutation.isPending} data-testid="button-submit-edit">
                    {updateMutation.isPending ? "Updating..." : "Update Company"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingCompany} onOpenChange={(open) => !open && setDeletingCompany(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deletingCompany?.name}</strong> and all associated data. 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingCompany && deleteMutation.mutate(deletingCompany.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Trial Management Dialog */}
      <Dialog open={!!trialCompany} onOpenChange={(open) => !open && setTrialCompany(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Trial for {trialCompany?.name}</DialogTitle>
            <DialogDescription>
              Set or update the trial period for this company
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Current Status</Label>
              <div className="flex gap-2">
                {trialCompany?.trialStatus === 'trial' && (
                  <Badge variant="outline" className="border-amber-500 text-amber-600">
                    <Timer className="h-3 w-3 mr-1" />
                    Trial Active
                  </Badge>
                )}
                {trialCompany?.trialStatus === 'full' && (
                  <Badge variant="outline" className="border-green-500 text-green-600">
                    <Check className="h-3 w-3 mr-1" />
                    Full Version
                  </Badge>
                )}
                {trialCompany?.trialStatus === 'expired' && (
                  <Badge variant="destructive">Trial Expired</Badge>
                )}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="trial-days">Trial Duration (Days)</Label>
              <div className="flex gap-2">
                <Button
                  variant={trialDays === 3 ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTrialDays(3)}
                  data-testid="button-trial-3-days"
                >
                  3 Days
                </Button>
                <Button
                  variant={trialDays === 7 ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTrialDays(7)}
                  data-testid="button-trial-7-days"
                >
                  7 Days
                </Button>
                <Button
                  variant={trialDays === 14 ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTrialDays(14)}
                  data-testid="button-trial-14-days"
                >
                  14 Days
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="custom-days">Custom Days</Label>
              <Input
                id="custom-days"
                type="number"
                min="1"
                value={trialDays}
                onChange={(e) => setTrialDays(parseInt(e.target.value) || 14)}
                data-testid="input-custom-trial-days"
                placeholder="Enter number of days"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setTrialCompany(null)}
              data-testid="button-cancel-trial"
            >
              Cancel
            </Button>
            {trialCompany?.trialStatus !== 'full' && (
              <Button
                onClick={() => trialCompany && convertToFullMutation.mutate(trialCompany.id)}
                disabled={convertToFullMutation.isPending}
                data-testid="button-convert-to-full"
                variant="secondary"
              >
                <Check className="h-4 w-4 mr-2" />
                {convertToFullMutation.isPending ? "Converting..." : "Convert to Full"}
              </Button>
            )}
            <Button
              onClick={() => trialCompany && setTrialMutation.mutate({ id: trialCompany.id, trialDays })}
              disabled={setTrialMutation.isPending}
              data-testid="button-set-trial"
            >
              <Timer className="h-4 w-4 mr-2" />
              {setTrialMutation.isPending ? "Setting..." : "Set Trial"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

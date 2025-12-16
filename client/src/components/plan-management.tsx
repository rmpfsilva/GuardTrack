import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Form, FormField, FormItem, FormLabel, FormControl, FormDescription } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Package, 
  Plus, 
  Edit, 
  Trash2, 
  Check, 
  X, 
  Users, 
  Building2, 
  Calendar, 
  Bell, 
  Clock, 
  Shield,
  FileText,
  LayoutDashboard
} from "lucide-react";

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string | null;
  monthlyPrice: string;
  features: {
    userManagement: boolean;
    dashboardAccess: boolean;
    reportsViewing: boolean;
    checkInOut: boolean;
    shiftScheduling: boolean;
    siteManagement: boolean;
    breakTracking: boolean;
    overtimeManagement: boolean;
    leaveRequests: boolean;
    noticeBoard: boolean;
    pushNotifications: boolean;
  };
  limits: {
    maxSites: number | null;
    maxUsers: number | null;
  };
  isActive: boolean;
  sortOrder: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

const planFormSchema = z.object({
  name: z.string().min(1, "Plan name is required"),
  description: z.string().optional(),
  monthlyPrice: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid price format"),
  sortOrder: z.string().optional(),
  isActive: z.boolean(),
  features: z.object({
    userManagement: z.boolean(),
    dashboardAccess: z.boolean(),
    reportsViewing: z.boolean(),
    checkInOut: z.boolean(),
    shiftScheduling: z.boolean(),
    siteManagement: z.boolean(),
    breakTracking: z.boolean(),
    overtimeManagement: z.boolean(),
    leaveRequests: z.boolean(),
    noticeBoard: z.boolean(),
    pushNotifications: z.boolean(),
  }),
  limits: z.object({
    maxSites: z.number().nullable(),
    maxUsers: z.number().nullable(),
  }),
});

type PlanFormData = z.infer<typeof planFormSchema>;

const defaultFeatures = {
  userManagement: true,
  dashboardAccess: true,
  reportsViewing: false,
  checkInOut: true,
  shiftScheduling: false,
  siteManagement: false,
  breakTracking: false,
  overtimeManagement: false,
  leaveRequests: false,
  noticeBoard: false,
  pushNotifications: false,
};

const defaultLimits = {
  maxSites: 1,
  maxUsers: 10,
};

const featureLabels: Record<keyof typeof defaultFeatures, { label: string; icon: any }> = {
  userManagement: { label: "User Management", icon: Users },
  dashboardAccess: { label: "Dashboard Access", icon: LayoutDashboard },
  reportsViewing: { label: "Reports & Analytics", icon: FileText },
  checkInOut: { label: "Check In/Out", icon: Check },
  shiftScheduling: { label: "Shift Scheduling", icon: Calendar },
  siteManagement: { label: "Site Management", icon: Building2 },
  breakTracking: { label: "Break Tracking", icon: Clock },
  overtimeManagement: { label: "Overtime Management", icon: Clock },
  leaveRequests: { label: "Leave Requests", icon: Calendar },
  noticeBoard: { label: "Notice Board", icon: Bell },
  pushNotifications: { label: "Push Notifications", icon: Bell },
};

export function PlanManagement() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);

  const { data: plans = [], isLoading } = useQuery<SubscriptionPlan[]>({
    queryKey: ["/api/subscription-plans"],
  });

  const createPlanMutation = useMutation({
    mutationFn: async (data: PlanFormData) => {
      return await apiRequest("POST", "/api/subscription-plans", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscription-plans"] });
      toast({ title: "Plan created", description: "Subscription plan has been created successfully." });
      setIsCreateDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create plan", variant: "destructive" });
    },
  });

  const updatePlanMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: PlanFormData }) => {
      return await apiRequest("PATCH", `/api/subscription-plans/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscription-plans"] });
      toast({ title: "Plan updated", description: "Subscription plan has been updated successfully." });
      setIsEditDialogOpen(false);
      setSelectedPlan(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update plan", variant: "destructive" });
    },
  });

  const deletePlanMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/subscription-plans/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscription-plans"] });
      toast({ title: "Plan deleted", description: "Subscription plan has been deleted." });
      setIsDeleteDialogOpen(false);
      setSelectedPlan(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete plan", variant: "destructive" });
    },
  });

  const createForm = useForm<PlanFormData>({
    resolver: zodResolver(planFormSchema),
    defaultValues: {
      name: "",
      description: "",
      monthlyPrice: "0.00",
      sortOrder: "1",
      isActive: true,
      features: defaultFeatures,
      limits: defaultLimits,
    },
  });

  const editForm = useForm<PlanFormData>({
    resolver: zodResolver(planFormSchema),
    defaultValues: {
      name: "",
      description: "",
      monthlyPrice: "0.00",
      sortOrder: "1",
      isActive: true,
      features: defaultFeatures,
      limits: defaultLimits,
    },
  });

  const handleCreatePlan = (data: PlanFormData) => {
    createPlanMutation.mutate(data);
  };

  const handleEditPlan = (data: PlanFormData) => {
    if (selectedPlan) {
      updatePlanMutation.mutate({ id: selectedPlan.id, data });
    }
  };

  const openEditDialog = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
    editForm.reset({
      name: plan.name,
      description: plan.description || "",
      monthlyPrice: plan.monthlyPrice,
      sortOrder: plan.sortOrder || "1",
      isActive: plan.isActive,
      features: plan.features,
      limits: plan.limits,
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
    setIsDeleteDialogOpen(true);
  };

  const getFeatureCount = (features: SubscriptionPlan["features"]) => {
    return Object.values(features).filter(Boolean).length;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Loading subscription plans...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Subscription Plans</h2>
          <p className="text-muted-foreground">Manage subscription plans and feature access for clients.</p>
        </div>
        <Button onClick={() => {
          createForm.reset({
            name: "",
            description: "",
            monthlyPrice: "0.00",
            sortOrder: String(plans.length + 1),
            isActive: true,
            features: defaultFeatures,
            limits: defaultLimits,
          });
          setIsCreateDialogOpen(true);
        }} data-testid="button-create-plan">
          <Plus className="h-4 w-4 mr-2" />
          Create Plan
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.id} className={!plan.isActive ? "opacity-60" : ""} data-testid={`card-plan-${plan.id}`}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    {plan.name}
                  </CardTitle>
                  <CardDescription>
                    {plan.description || "No description"}
                  </CardDescription>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant={plan.isActive ? "default" : "secondary"}>
                    {plan.isActive ? "Active" : "Inactive"}
                  </Badge>
                  <span className="text-xl font-bold text-primary">
                    ${parseFloat(plan.monthlyPrice).toFixed(2)}
                    <span className="text-sm font-normal text-muted-foreground">/mo</span>
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Features ({getFeatureCount(plan.features)}/{Object.keys(plan.features).length})</h4>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(plan.features).map(([key, enabled]) => {
                    const feature = featureLabels[key as keyof typeof featureLabels];
                    const Icon = feature.icon;
                    return (
                      <div key={key} className={`flex items-center gap-1 text-xs ${enabled ? "text-foreground" : "text-muted-foreground"}`}>
                        {enabled ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <X className="h-3 w-3 text-red-400" />
                        )}
                        <span className="truncate">{feature.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="font-medium text-sm">Limits</h4>
                <div className="flex gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>{plan.limits.maxSites === null ? "Unlimited" : plan.limits.maxSites} sites</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>{plan.limits.maxUsers === null ? "Unlimited" : plan.limits.maxUsers} users</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => openEditDialog(plan)}
                  data-testid={`button-edit-plan-${plan.id}`}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => openDeleteDialog(plan)}
                  data-testid={`button-delete-plan-${plan.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {plans.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center p-8">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">
                No subscription plans yet. Create your first plan to start managing client subscriptions.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create Plan Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Subscription Plan</DialogTitle>
            <DialogDescription>
              Define a new subscription plan with features and limits.
            </DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(handleCreatePlan)} className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={createForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Plan Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Professional" {...field} data-testid="input-plan-name" />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="monthlyPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monthly Price ($)</FormLabel>
                      <FormControl>
                        <Input placeholder="29.99" {...field} data-testid="input-plan-price" />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={createForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input placeholder="Plan description..." {...field} data-testid="input-plan-description" />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={createForm.control}
                  name="sortOrder"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sort Order</FormLabel>
                      <FormControl>
                        <Input placeholder="1" {...field} data-testid="input-plan-sort-order" />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <FormLabel>Active</FormLabel>
                        <FormDescription className="text-xs">
                          Make this plan available for assignment
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-plan-active"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="font-medium">Features</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  {Object.entries(featureLabels).map(([key, { label, icon: Icon }]) => (
                    <FormField
                      key={key}
                      control={createForm.control}
                      name={`features.${key as keyof typeof defaultFeatures}`}
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-3">
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            <FormLabel className="text-sm font-normal">{label}</FormLabel>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid={`switch-feature-${key}`}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="font-medium">Limits</h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={createForm.control}
                    name="limits.maxSites"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Sites</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="Unlimited"
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                            data-testid="input-limit-sites"
                          />
                        </FormControl>
                        <FormDescription className="text-xs">Leave empty for unlimited</FormDescription>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="limits.maxUsers"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Users</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="Unlimited"
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                            data-testid="input-limit-users"
                          />
                        </FormControl>
                        <FormDescription className="text-xs">Leave empty for unlimited</FormDescription>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createPlanMutation.isPending} data-testid="button-submit-create-plan">
                  {createPlanMutation.isPending ? "Creating..." : "Create Plan"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Plan Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Subscription Plan</DialogTitle>
            <DialogDescription>
              Update the plan details, features, and limits.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleEditPlan)} className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={editForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Plan Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Professional" {...field} data-testid="input-edit-plan-name" />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="monthlyPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monthly Price ($)</FormLabel>
                      <FormControl>
                        <Input placeholder="29.99" {...field} data-testid="input-edit-plan-price" />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input placeholder="Plan description..." {...field} data-testid="input-edit-plan-description" />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={editForm.control}
                  name="sortOrder"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sort Order</FormLabel>
                      <FormControl>
                        <Input placeholder="1" {...field} data-testid="input-edit-plan-sort-order" />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <FormLabel>Active</FormLabel>
                        <FormDescription className="text-xs">
                          Make this plan available for assignment
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-edit-plan-active"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="font-medium">Features</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  {Object.entries(featureLabels).map(([key, { label, icon: Icon }]) => (
                    <FormField
                      key={key}
                      control={editForm.control}
                      name={`features.${key as keyof typeof defaultFeatures}`}
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-3">
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            <FormLabel className="text-sm font-normal">{label}</FormLabel>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid={`switch-edit-feature-${key}`}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="font-medium">Limits</h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={editForm.control}
                    name="limits.maxSites"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Sites</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="Unlimited"
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                            data-testid="input-edit-limit-sites"
                          />
                        </FormControl>
                        <FormDescription className="text-xs">Leave empty for unlimited</FormDescription>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="limits.maxUsers"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Users</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="Unlimited"
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                            data-testid="input-edit-limit-users"
                          />
                        </FormControl>
                        <FormDescription className="text-xs">Leave empty for unlimited</FormDescription>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updatePlanMutation.isPending} data-testid="button-submit-edit-plan">
                  {updatePlanMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Subscription Plan</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the "{selectedPlan?.name}" plan? This action cannot be undone.
              Companies currently using this plan will need to be reassigned to a different plan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedPlan && deletePlanMutation.mutate(selectedPlan.id)}
              disabled={deletePlanMutation.isPending}
              data-testid="button-confirm-delete-plan"
            >
              {deletePlanMutation.isPending ? "Deleting..." : "Delete Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

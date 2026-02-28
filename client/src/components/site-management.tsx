import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { MapPin, Plus, Pencil, Trash2, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Site, InsertSite } from "@shared/schema";

const JOB_ROLES = [
  { key: "guard", label: "SIA Guard", staffField: "guardRate", clientField: "guardClientRate", staffDefault: "15.00", clientDefault: "20.00" },
  { key: "steward", label: "Steward", staffField: "stewardRate", clientField: "stewardClientRate", staffDefault: "18.00", clientDefault: "23.00" },
  { key: "supervisor", label: "Supervisor", staffField: "supervisorRate", clientField: "supervisorClientRate", staffDefault: "22.00", clientDefault: "28.00" },
  { key: "callOut", label: "Call Out", staffField: "callOutRate", clientField: "callOutClientRate", staffDefault: "15.00", clientDefault: "20.00" },
  { key: "doorSupervisor", label: "Door Supervisor", staffField: "doorSupervisorRate", clientField: "doorSupervisorClientRate", staffDefault: "15.00", clientDefault: "20.00" },
  { key: "cctvOperator", label: "CCTV Operator", staffField: "cctvOperatorRate", clientField: "cctvOperatorClientRate", staffDefault: "15.00", clientDefault: "20.00" },
  { key: "keyHolder", label: "Key Holder", staffField: "keyHolderRate", clientField: "keyHolderClientRate", staffDefault: "15.00", clientDefault: "20.00" },
  { key: "mobilePatrol", label: "Mobile Patrol", staffField: "mobilePatrolRate", clientField: "mobilePatrolClientRate", staffDefault: "15.00", clientDefault: "20.00" },
] as const;

const defaultFormData = (): InsertSite => ({
  name: "",
  address: "",
  contactName: "",
  contactPhone: "",
  isActive: true,
  guardRate: "15.00",
  stewardRate: "18.00",
  supervisorRate: "22.00",
  callOutRate: "15.00",
  doorSupervisorRate: "15.00",
  cctvOperatorRate: "15.00",
  keyHolderRate: "15.00",
  mobilePatrolRate: "15.00",
  guardClientRate: "20.00",
  stewardClientRate: "23.00",
  supervisorClientRate: "28.00",
  callOutClientRate: "20.00",
  doorSupervisorClientRate: "20.00",
  cctvOperatorClientRate: "20.00",
  keyHolderClientRate: "20.00",
  mobilePatrolClientRate: "20.00",
});

function RateTable({ formData, setFormData }: { formData: any; setFormData: (d: any) => void }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-muted-foreground pb-1 border-b">
        <span>Role</span>
        <span className="flex items-center gap-1"><TrendingDown className="h-3 w-3 text-orange-500" /> Staff Rate (OUT, £/hr)</span>
        <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3 text-green-500" /> Client Rate (IN, £/hr)</span>
      </div>
      {JOB_ROLES.map((role) => (
        <div key={role.key} className="grid grid-cols-3 gap-2 items-center">
          <Label className="text-sm">{role.label}</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            placeholder={role.staffDefault}
            value={formData[role.staffField] ?? role.staffDefault}
            onChange={(e) => setFormData({ ...formData, [role.staffField]: e.target.value })}
            data-testid={`input-${role.staffField}`}
          />
          <Input
            type="number"
            step="0.01"
            min="0"
            placeholder={role.clientDefault}
            value={formData[role.clientField] ?? role.clientDefault}
            onChange={(e) => setFormData({ ...formData, [role.clientField]: e.target.value })}
            data-testid={`input-${role.clientField}`}
          />
        </div>
      ))}
    </div>
  );
}

export default function SiteManagement() {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [formData, setFormData] = useState<any>(defaultFormData());

  const { data: sites = [], isLoading } = useQuery<Site[]>({
    queryKey: ["/api/sites"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertSite) => {
      return await apiRequest("POST", "/api/sites", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Site Added", description: "The site has been successfully created." });
      setIsAddDialogOpen(false);
      setFormData(defaultFormData());
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "You are logged out.", variant: "destructive" });
        setTimeout(() => { window.location.href = "/auth"; }, 500);
        return;
      }
      toast({ title: "Failed to Add Site", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertSite> }) => {
      return await apiRequest("PATCH", `/api/sites/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
      toast({ title: "Site Updated", description: "The site has been successfully updated." });
      setIsEditDialogOpen(false);
      setEditingSite(null);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to Update Site", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/sites/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
      toast({ title: "Site Deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to Delete Site", description: error.message, variant: "destructive" });
    },
  });

  const handleAdd = () => {
    if (!formData.name || !formData.address) {
      toast({ title: "Missing Information", description: "Please fill in the site name and address.", variant: "destructive" });
      return;
    }
    createMutation.mutate(formData);
  };

  const handleEdit = (site: Site) => {
    setEditingSite(site);
    setFormData({
      name: site.name,
      address: site.address,
      contactName: site.contactName || "",
      contactPhone: site.contactPhone || "",
      isActive: site.isActive,
      guardRate: site.guardRate || "15.00",
      stewardRate: site.stewardRate || "18.00",
      supervisorRate: site.supervisorRate || "22.00",
      callOutRate: (site as any).callOutRate || "15.00",
      doorSupervisorRate: (site as any).doorSupervisorRate || "15.00",
      cctvOperatorRate: (site as any).cctvOperatorRate || "15.00",
      keyHolderRate: (site as any).keyHolderRate || "15.00",
      mobilePatrolRate: (site as any).mobilePatrolRate || "15.00",
      guardClientRate: (site as any).guardClientRate || "20.00",
      stewardClientRate: (site as any).stewardClientRate || "23.00",
      supervisorClientRate: (site as any).supervisorClientRate || "28.00",
      callOutClientRate: (site as any).callOutClientRate || "20.00",
      doorSupervisorClientRate: (site as any).doorSupervisorClientRate || "20.00",
      cctvOperatorClientRate: (site as any).cctvOperatorClientRate || "20.00",
      keyHolderClientRate: (site as any).keyHolderClientRate || "20.00",
      mobilePatrolClientRate: (site as any).mobilePatrolClientRate || "20.00",
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdate = () => {
    if (!editingSite || !formData.name || !formData.address) {
      toast({ title: "Missing Information", description: "Please fill in the site name and address.", variant: "destructive" });
      return;
    }
    updateMutation.mutate({ id: editingSite.id, data: formData });
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      deleteMutation.mutate(id);
    }
  };

  const SiteFormFields = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Site Name *</Label>
        <Input
          id="name"
          placeholder="Downtown Office"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          data-testid="input-site-name"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="address">Address *</Label>
        <Textarea
          id="address"
          placeholder="123 Main Street, City, State 12345"
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          rows={2}
          data-testid="input-site-address"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="contactName">Contact Name</Label>
          <Input
            id="contactName"
            placeholder="John Smith"
            value={formData.contactName || ""}
            onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
            data-testid="input-contact-name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contactPhone">Contact Phone</Label>
          <Input
            id="contactPhone"
            type="tel"
            placeholder="+44 20 1234 5678"
            value={formData.contactPhone || ""}
            onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
            data-testid="input-contact-phone"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label className="font-semibold">Hourly Rates per Role</Label>
        <RateTable formData={formData} setFormData={setFormData} />
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Site Management
            </CardTitle>
            <CardDescription>Add and manage security sites</CardDescription>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
            setIsAddDialogOpen(open);
            if (open) setFormData(defaultFormData());
          }}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-site">
                <Plus className="h-4 w-4 mr-2" />
                Add Site
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add New Site</DialogTitle>
                <DialogDescription>Create a new security site with role-based pricing</DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[70vh] pr-4">
                <div className="py-2">
                  <SiteFormFields />
                </div>
              </ScrollArea>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setIsAddDialogOpen(false); setFormData(defaultFormData()); }}>Cancel</Button>
                <Button onClick={handleAdd} disabled={createMutation.isPending} data-testid="button-save-site">
                  {createMutation.isPending ? "Adding..." : "Add Site"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">Loading sites...</p>
        ) : sites.length === 0 ? (
          <div className="text-center py-12">
            <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">No sites added yet</p>
            <Button onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-first-site">
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Site
            </Button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {sites.map((site) => (
              <Card key={site.id} className="hover-elevate" data-testid={`site-card-${site.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg">{site.name}</CardTitle>
                      <CardDescription className="mt-1">{site.address}</CardDescription>
                      {(site.contactName || site.contactPhone) && (
                        <div className="mt-2 text-sm text-muted-foreground">
                          {site.contactName && <div>Contact: {site.contactName}</div>}
                          {site.contactPhone && <div>Phone: {site.contactPhone}</div>}
                        </div>
                      )}
                    </div>
                    <Badge variant={site.isActive ? "default" : "secondary"}>
                      {site.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-xs space-y-1">
                    <div className="grid grid-cols-3 gap-1 font-semibold text-muted-foreground border-b pb-1">
                      <span>Role</span>
                      <span className="flex items-center gap-1"><TrendingDown className="h-3 w-3 text-orange-500" /> Staff (OUT)</span>
                      <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3 text-green-500" /> Client (IN)</span>
                    </div>
                    {JOB_ROLES.map((role) => {
                      const staffRate = parseFloat((site as any)[role.staffField] || role.staffDefault);
                      const clientRate = parseFloat((site as any)[role.clientField] || role.clientDefault);
                      return (
                        <div key={role.key} className="grid grid-cols-3 gap-1">
                          <span className="text-muted-foreground">{role.label}</span>
                          <span className="font-medium">£{staffRate.toFixed(2)}</span>
                          <span className="font-medium text-green-600 dark:text-green-400">£{clientRate.toFixed(2)}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(site)} data-testid={`button-edit-site-${site.id}`}>
                      <Pencil className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDelete(site.id, site.name)} disabled={deleteMutation.isPending} data-testid={`button-delete-site-${site.id}`}>
                      <Trash2 className="h-3 w-3 mr-1" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Site</DialogTitle>
            <DialogDescription>Update site information and rates</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-4">
            <div className="py-2">
              <SiteFormFields />
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsEditDialogOpen(false); setEditingSite(null); }}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending} data-testid="button-update-site">
              {updateMutation.isPending ? "Updating..." : "Update Site"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

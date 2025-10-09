import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { MapPin, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { Site, InsertSite } from "@shared/schema";

export default function SiteManagement() {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [formData, setFormData] = useState<InsertSite>({
    name: "",
    address: "",
    isActive: true,
    guardRate: "15.00",
    stewardRate: "18.00",
    supervisorRate: "22.00",
  });

  // Fetch sites
  const { data: sites = [], isLoading } = useQuery<Site[]>({
    queryKey: ["/api/sites"],
  });

  // Create site mutation
  const createMutation = useMutation({
    mutationFn: async (data: InsertSite) => {
      return await apiRequest("POST", "/api/sites", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({
        title: "Site Added",
        description: "The site has been successfully created.",
      });
      setIsAddDialogOpen(false);
      setFormData({ name: "", address: "", isActive: true, guardRate: "15.00", stewardRate: "18.00", supervisorRate: "22.00" });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/auth";
        }, 500);
        return;
      }
      toast({
        title: "Failed to Add Site",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update site mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertSite> }) => {
      return await apiRequest("PATCH", `/api/sites/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
      toast({
        title: "Site Updated",
        description: "The site has been successfully updated.",
      });
      setIsEditDialogOpen(false);
      setEditingSite(null);
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/auth";
        }, 500);
        return;
      }
      toast({
        title: "Failed to Update Site",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete site mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/sites/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({
        title: "Site Deleted",
        description: "The site has been successfully deleted.",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/auth";
        }, 500);
        return;
      }
      toast({
        title: "Failed to Delete Site",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAdd = () => {
    if (!formData.name || !formData.address) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }
    if (!formData.guardRate || !formData.stewardRate || !formData.supervisorRate) {
      toast({
        title: "Missing Hourly Rates",
        description: "Please fill in hourly rates for all roles.",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate(formData);
  };

  const handleEdit = (site: Site) => {
    setEditingSite(site);
    setFormData({
      name: site.name,
      address: site.address,
      isActive: site.isActive,
      guardRate: site.guardRate || "15.00",
      stewardRate: site.stewardRate || "18.00",
      supervisorRate: site.supervisorRate || "22.00",
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdate = () => {
    if (!editingSite || !formData.name || !formData.address) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }
    if (!formData.guardRate || !formData.stewardRate || !formData.supervisorRate) {
      toast({
        title: "Missing Hourly Rates",
        description: "Please fill in hourly rates for all roles.",
        variant: "destructive",
      });
      return;
    }
    updateMutation.mutate({ id: editingSite.id, data: formData });
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Site Management
            </CardTitle>
            <CardDescription>Add and manage security sites</CardDescription>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
            setIsAddDialogOpen(open);
            if (open) {
              setFormData({ name: "", address: "", isActive: true, guardRate: "15.00", stewardRate: "18.00", supervisorRate: "22.00" });
            }
          }}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-site">
                <Plus className="h-4 w-4 mr-2" />
                Add Site
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Site</DialogTitle>
                <DialogDescription>Create a new security site location</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
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
                    rows={3}
                    data-testid="input-site-address"
                  />
                </div>
                
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Hourly Rates (£)</Label>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="guard-rate" className="text-xs text-muted-foreground">Guard</Label>
                      <Input
                        id="guard-rate"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="15.00"
                        value={formData.guardRate || ""}
                        onChange={(e) => setFormData({ ...formData, guardRate: e.target.value })}
                        data-testid="input-guard-rate"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="steward-rate" className="text-xs text-muted-foreground">Steward</Label>
                      <Input
                        id="steward-rate"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="18.00"
                        value={formData.stewardRate || ""}
                        onChange={(e) => setFormData({ ...formData, stewardRate: e.target.value })}
                        data-testid="input-steward-rate"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="supervisor-rate" className="text-xs text-muted-foreground">Supervisor</Label>
                      <Input
                        id="supervisor-rate"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="22.00"
                        value={formData.supervisorRate || ""}
                        onChange={(e) => setFormData({ ...formData, supervisorRate: e.target.value })}
                        data-testid="input-supervisor-rate"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setIsAddDialogOpen(false);
                    setFormData({ name: "", address: "", isActive: true, guardRate: "15.00", stewardRate: "18.00", supervisorRate: "22.00" });
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleAdd}
                  disabled={createMutation.isPending}
                  data-testid="button-save-site"
                >
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
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{site.name}</CardTitle>
                      <CardDescription className="mt-1">{site.address}</CardDescription>
                    </div>
                    <Badge variant={site.isActive ? "default" : "secondary"}>
                      {site.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4 mb-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Guard:</span> <span className="font-medium">£{parseFloat(site.guardRate || "15.00").toFixed(2)}/hr</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Steward:</span> <span className="font-medium">£{parseFloat(site.stewardRate || "18.00").toFixed(2)}/hr</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Supervisor:</span> <span className="font-medium">£{parseFloat(site.supervisorRate || "22.00").toFixed(2)}/hr</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleEdit(site)}
                      data-testid={`button-edit-site-${site.id}`}
                    >
                      <Pencil className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleDelete(site.id, site.name)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-site-${site.id}`}
                    >
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

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Site</DialogTitle>
            <DialogDescription>Update site information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Site Name *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                data-testid="input-edit-site-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-address">Address *</Label>
              <Textarea
                id="edit-address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={3}
                data-testid="input-edit-site-address"
              />
            </div>
            
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Hourly Rates (£)</Label>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="edit-guard-rate" className="text-xs text-muted-foreground">Guard</Label>
                  <Input
                    id="edit-guard-rate"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="15.00"
                    value={formData.guardRate || ""}
                    onChange={(e) => setFormData({ ...formData, guardRate: e.target.value })}
                    data-testid="input-edit-guard-rate"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-steward-rate" className="text-xs text-muted-foreground">Steward</Label>
                  <Input
                    id="edit-steward-rate"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="18.00"
                    value={formData.stewardRate || ""}
                    onChange={(e) => setFormData({ ...formData, stewardRate: e.target.value })}
                    data-testid="input-edit-steward-rate"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-supervisor-rate" className="text-xs text-muted-foreground">Supervisor</Label>
                  <Input
                    id="edit-supervisor-rate"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="22.00"
                    value={formData.supervisorRate || ""}
                    onChange={(e) => setFormData({ ...formData, supervisorRate: e.target.value })}
                    data-testid="input-edit-supervisor-rate"
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsEditDialogOpen(false);
                setEditingSite(null);
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleUpdate}
              disabled={updateMutation.isPending}
              data-testid="button-update-site"
            >
              {updateMutation.isPending ? "Updating..." : "Update Site"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

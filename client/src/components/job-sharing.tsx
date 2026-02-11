import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Briefcase, Building2, Calendar, DollarSign, Users, Plus, Check, X, Clock, MapPin, Trash2, Pencil, PoundSterling } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { JobShareWithDetails, Company, Site, JobSharePosition, JobShareRole } from "@shared/schema";
import { JOB_SHARE_ROLES } from "@shared/schema";

const ROLE_LABELS: Record<JobShareRole, string> = {
  guard: "SIA Guard",
  steward: "Steward",
  supervisor: "Supervisor",
  call_out: "Call Out",
};

interface PositionRow {
  role: JobShareRole;
  count: number;
  hourlyRate: string;
}

const emptyPosition = (): PositionRow => ({ role: "guard", count: 1, hourlyRate: "15.00" });

export default function JobSharing() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingShare, setEditingShare] = useState<JobShareWithDetails | null>(null);
  const [selectedTab, setSelectedTab] = useState<'offered' | 'received'>('offered');

  const [formData, setFormData] = useState({
    toCompanyId: "",
    siteId: "",
    startDate: "",
    endDate: "",
    requirements: "",
  });
  const [positions, setPositions] = useState<PositionRow[]>([emptyPosition()]);

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ['/api/companies/for-job-sharing'],
  });

  const { data: sites = [] } = useQuery<Site[]>({
    queryKey: ['/api/sites'],
    select: (data) => data.filter(s => s.companyId === user?.companyId),
  });

  const { data: offeredShares = [] } = useQuery<JobShareWithDetails[]>({
    queryKey: ['/api/job-shares/offered'],
  });

  const { data: receivedShares = [] } = useQuery<JobShareWithDetails[]>({
    queryKey: ['/api/job-shares/received'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('POST', '/api/job-shares', data);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Job share request sent successfully" });
      setIsCreateDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['/api/job-shares/offered'] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create job share", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return await apiRequest('PATCH', `/api/job-shares/${id}`, data);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Job share updated successfully" });
      setIsEditDialogOpen(false);
      setEditingShare(null);
      queryClient.invalidateQueries({ queryKey: ['/api/job-shares/offered'] });
      queryClient.invalidateQueries({ queryKey: ['/api/job-shares/received'] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update job share", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/job-shares/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Job share deleted" });
      queryClient.invalidateQueries({ queryKey: ['/api/job-shares/offered'] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete job share", variant: "destructive" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      return await apiRequest('PATCH', `/api/job-shares/${id}`, { status, reviewNotes: notes });
    },
    onSuccess: (_, variables) => {
      toast({ title: "Success", description: `Job share ${variables.status}` });
      queryClient.invalidateQueries({ queryKey: ['/api/job-shares/received'] });
      queryClient.invalidateQueries({ queryKey: ['/api/job-shares/offered'] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update job share", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({ toCompanyId: "", siteId: "", startDate: "", endDate: "", requirements: "" });
    setPositions([emptyPosition()]);
  };

  const addPosition = () => {
    setPositions(prev => [...prev, emptyPosition()]);
  };

  const removePosition = (index: number) => {
    if (positions.length <= 1) return;
    setPositions(prev => prev.filter((_, i) => i !== index));
  };

  const updatePosition = (index: number, field: keyof PositionRow, value: any) => {
    setPositions(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
  };

  const handleCreate = () => {
    if (!formData.toCompanyId || !formData.siteId || !formData.startDate || !formData.endDate) {
      toast({ title: "Validation Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    if (positions.some(p => !p.role || p.count < 1 || !p.hourlyRate || parseFloat(p.hourlyRate) <= 0)) {
      toast({ title: "Validation Error", description: "Each position needs a valid role, count, and rate", variant: "destructive" });
      return;
    }
    createMutation.mutate({ ...formData, positions });
  };

  const openEditDialog = (share: JobShareWithDetails) => {
    setEditingShare(share);
    setFormData({
      toCompanyId: share.toCompanyId,
      siteId: share.siteId,
      startDate: format(new Date(share.startDate), "yyyy-MM-dd'T'HH:mm"),
      endDate: format(new Date(share.endDate), "yyyy-MM-dd'T'HH:mm"),
      requirements: share.requirements || "",
    });
    const sharePositions = (share.positions as JobSharePosition[] | null);
    if (sharePositions && sharePositions.length > 0) {
      setPositions(sharePositions.map(p => ({ role: p.role, count: Number(p.count), hourlyRate: p.hourlyRate })));
    } else {
      setPositions([{ role: (share.workingRole || 'guard') as JobShareRole, count: Number(share.numberOfJobs), hourlyRate: String(share.hourlyRate) }]);
    }
    setIsEditDialogOpen(true);
  };

  const handleEdit = () => {
    if (!editingShare) return;
    if (positions.some(p => !p.role || p.count < 1 || !p.hourlyRate || parseFloat(p.hourlyRate) <= 0)) {
      toast({ title: "Validation Error", description: "Each position needs a valid role, count, and rate", variant: "destructive" });
      return;
    }
    updateMutation.mutate({
      id: editingShare.id,
      data: {
        siteId: formData.siteId,
        startDate: formData.startDate,
        endDate: formData.endDate,
        requirements: formData.requirements,
        positions,
      }
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20">
          <Clock className="h-3 w-3 mr-1" />Pending
        </Badge>;
      case 'accepted':
        return <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">
          <Check className="h-3 w-3 mr-1" />Accepted
        </Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20">
          <X className="h-3 w-3 mr-1" />Rejected
        </Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPositionsForShare = (share: JobShareWithDetails): JobSharePosition[] => {
    const sharePositions = share.positions as JobSharePosition[] | null;
    if (sharePositions && sharePositions.length > 0) return sharePositions;
    return [{ role: (share.workingRole || 'guard') as JobShareRole, count: Number(share.numberOfJobs), hourlyRate: String(share.hourlyRate) }];
  };

  const getTotalPositions = (positions: JobSharePosition[]) => {
    return positions.reduce((sum, p) => sum + Number(p.count), 0);
  };

  const PositionsEditor = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Positions</Label>
        <Button type="button" variant="outline" size="sm" onClick={addPosition} data-testid="button-add-position">
          <Plus className="h-3 w-3 mr-1" />Add Position
        </Button>
      </div>
      {positions.map((pos, index) => (
        <div key={index} className="flex items-end gap-2 p-3 rounded-md border bg-muted/30" data-testid={`position-row-${index}`}>
          <div className="flex-1 min-w-0">
            <Label className="text-xs text-muted-foreground">Role</Label>
            <Select value={pos.role} onValueChange={(v) => updatePosition(index, 'role', v)}>
              <SelectTrigger data-testid={`select-position-role-${index}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {JOB_SHARE_ROLES.map(role => (
                  <SelectItem key={role} value={role}>{ROLE_LABELS[role]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-20">
            <Label className="text-xs text-muted-foreground">Count</Label>
            <Input
              type="number"
              min="1"
              value={pos.count}
              onChange={(e) => updatePosition(index, 'count', parseInt(e.target.value) || 1)}
              data-testid={`input-position-count-${index}`}
            />
          </div>
          <div className="w-28">
            <Label className="text-xs text-muted-foreground">Rate (£/hr)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={pos.hourlyRate}
              onChange={(e) => updatePosition(index, 'hourlyRate', e.target.value)}
              data-testid={`input-position-rate-${index}`}
            />
          </div>
          {positions.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removePosition(index)}
              data-testid={`button-remove-position-${index}`}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      ))}
      <div className="text-sm text-muted-foreground">
        Total: {positions.reduce((sum, p) => sum + (p.count || 0), 0)} positions across {positions.length} role{positions.length > 1 ? 's' : ''}
      </div>
    </div>
  );

  const PositionsDisplay = ({ positions: displayPositions }: { positions: JobSharePosition[] }) => (
    <div className="space-y-2">
      {displayPositions.map((pos, index) => (
        <div key={index} className="flex items-center justify-between p-2 rounded-md bg-muted/40" data-testid={`display-position-${index}`}>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">{ROLE_LABELS[pos.role] || pos.role}</Badge>
            <span className="text-sm font-medium flex items-center gap-1">
              <Users className="h-3 w-3" />{pos.count}
            </span>
          </div>
          <span className="text-sm font-semibold flex items-center gap-0.5">
            <PoundSterling className="h-3 w-3" />{pos.hourlyRate}/hr
          </span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Job Sharing</h2>
          <p className="text-muted-foreground">Share guard job requests with partner companies</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={(open) => { setIsCreateDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-job-share">
              <Plus className="h-4 w-4 mr-2" />Create Job Share
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Job Share Request</DialogTitle>
              <DialogDescription>Share available positions with a partner company. Add multiple roles and rates in one request.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Partner Company</Label>
                <Select value={formData.toCompanyId} onValueChange={(v) => setFormData(prev => ({...prev, toCompanyId: v}))}>
                  <SelectTrigger data-testid="select-company">
                    <SelectValue placeholder="Select company" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map(company => (
                      <SelectItem key={company.id} value={company.id} data-testid={`option-company-${company.id}`}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Site</Label>
                <Select value={formData.siteId} onValueChange={(v) => setFormData(prev => ({...prev, siteId: v}))}>
                  <SelectTrigger data-testid="select-site">
                    <SelectValue placeholder="Select site" />
                  </SelectTrigger>
                  <SelectContent>
                    {sites.map(site => (
                      <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Start Date</Label>
                  <Input
                    type="datetime-local"
                    value={formData.startDate}
                    onChange={(e) => setFormData(prev => ({...prev, startDate: e.target.value}))}
                    data-testid="input-start-date"
                  />
                </div>
                <div>
                  <Label>End Date</Label>
                  <Input
                    type="datetime-local"
                    value={formData.endDate}
                    onChange={(e) => setFormData(prev => ({...prev, endDate: e.target.value}))}
                    data-testid="input-end-date"
                  />
                </div>
              </div>

              <PositionsEditor />

              <div>
                <Label>Requirements (Optional)</Label>
                <Textarea
                  placeholder="Any special requirements or notes..."
                  value={formData.requirements}
                  onChange={(e) => setFormData(prev => ({...prev, requirements: e.target.value}))}
                  data-testid="textarea-requirements"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending} data-testid="button-submit-job-share">
                {createMutation.isPending ? "Creating..." : "Create Job Share"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-2 border-b">
        <Button variant={selectedTab === 'offered' ? 'default' : 'ghost'} onClick={() => setSelectedTab('offered')} data-testid="tab-offered-shares">
          Offered to Others
        </Button>
        <Button variant={selectedTab === 'received' ? 'default' : 'ghost'} onClick={() => setSelectedTab('received')} data-testid="tab-received-shares">
          Received from Others
        </Button>
      </div>

      {selectedTab === 'offered' && (
        <div className="grid gap-4">
          {offeredShares.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No job shares offered yet. Create one to get started!
              </CardContent>
            </Card>
          ) : (
            offeredShares.map(share => {
              const sharePositions = getPositionsForShare(share);
              return (
                <Card key={share.id} data-testid={`job-share-${share.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Building2 className="h-5 w-5" />
                          {share.toCompany?.name || "Unknown Company"}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-1">
                          <MapPin className="h-4 w-4" />
                          {share.site?.name || "Unknown Site"}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(share.status)}
                        {share.status === 'pending' && (
                          <>
                            <Button size="icon" variant="ghost" onClick={() => openEditDialog(share)} data-testid={`button-edit-${share.id}`}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                if (confirm("Are you sure you want to delete this job share?")) {
                                  deleteMutation.mutate(share.id);
                                }
                              }}
                              data-testid={`button-delete-${share.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Positions</p>
                        <p className="font-semibold flex items-center gap-1">
                          <Users className="h-4 w-4" />{getTotalPositions(sharePositions)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Period</p>
                        <p className="text-sm font-semibold">
                          {format(new Date(share.startDate), "MMM d")} - {format(new Date(share.endDate), "MMM d, yyyy")}
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Positions & Rates</p>
                      <PositionsDisplay positions={sharePositions} />
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
              );
            })
          )}
        </div>
      )}

      {selectedTab === 'received' && (
        <div className="grid gap-4">
          {receivedShares.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No job share requests received yet
              </CardContent>
            </Card>
          ) : (
            receivedShares.map(share => {
              const sharePositions = getPositionsForShare(share);
              return (
                <Card key={share.id} data-testid={`received-share-${share.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Building2 className="h-5 w-5" />
                          {share.fromCompany?.name || "Unknown Company"}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-1">
                          <MapPin className="h-4 w-4" />
                          {share.site?.name || "Unknown Site"}
                        </CardDescription>
                      </div>
                      {getStatusBadge(share.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Positions</p>
                        <p className="font-semibold flex items-center gap-1">
                          <Users className="h-4 w-4" />{getTotalPositions(sharePositions)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Period</p>
                        <p className="text-sm font-semibold">
                          {format(new Date(share.startDate), "MMM d")} - {format(new Date(share.endDate), "MMM d, yyyy")}
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Positions & Rates</p>
                      <PositionsDisplay positions={sharePositions} />
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
                          <Check className="h-4 w-4 mr-1" />Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => updateStatusMutation.mutate({ id: share.id, status: 'rejected' })}
                          disabled={updateStatusMutation.isPending}
                          data-testid={`button-reject-${share.id}`}
                        >
                          <X className="h-4 w-4 mr-1" />Reject
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      <Dialog open={isEditDialogOpen} onOpenChange={(open) => { setIsEditDialogOpen(open); if (!open) { setEditingShare(null); resetForm(); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Job Share</DialogTitle>
            <DialogDescription>Update positions, dates, or requirements for this job share request.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Site</Label>
              <Select value={formData.siteId} onValueChange={(v) => setFormData(prev => ({...prev, siteId: v}))}>
                <SelectTrigger data-testid="edit-select-site">
                  <SelectValue placeholder="Select site" />
                </SelectTrigger>
                <SelectContent>
                  {sites.map(site => (
                    <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date</Label>
                <Input
                  type="datetime-local"
                  value={formData.startDate}
                  onChange={(e) => setFormData(prev => ({...prev, startDate: e.target.value}))}
                  data-testid="edit-input-start-date"
                />
              </div>
              <div>
                <Label>End Date</Label>
                <Input
                  type="datetime-local"
                  value={formData.endDate}
                  onChange={(e) => setFormData(prev => ({...prev, endDate: e.target.value}))}
                  data-testid="edit-input-end-date"
                />
              </div>
            </div>

            <PositionsEditor />

            <div>
              <Label>Requirements (Optional)</Label>
              <Textarea
                placeholder="Any special requirements or notes..."
                value={formData.requirements}
                onChange={(e) => setFormData(prev => ({...prev, requirements: e.target.value}))}
                data-testid="edit-textarea-requirements"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={updateMutation.isPending} data-testid="button-save-edit">
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Briefcase, Building2, Calendar, DollarSign, Users, Plus, Check, X, Clock, MapPin, Trash2, Pencil, PoundSterling, Minus, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { JobShareWithDetails, Company, Site, JobSharePosition, JobShareRole, JobShareAssignedWorker } from "@shared/schema";
import { JOB_SHARE_ROLES } from "@shared/schema";
import { UserPlus, Phone, Mail, Shield } from "lucide-react";

import { ROLE_LABELS, normalizeLegacyRole, emptyPosition, getPositionsForShare, getTotalPositions, type PositionRow } from "./job-share/shared";
import { PositionsDisplay } from "./job-share/PositionsDisplay";
import { AssignedWorkersDisplay } from "./job-share/AssignedWorkersDisplay";
import { PositionsEditor } from "./job-share/PositionsEditor";
import { JobShareProgress } from "./job-share/JobShareProgress";
import { JobShareDeadline, isDeadlineExpired } from "./job-share/JobShareDeadline";
import { JobShareMessages } from "./job-share/JobShareMessages";

export default function JobSharing() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAcceptDialogOpen, setIsAcceptDialogOpen] = useState(false);
  const [isEditWorkersDialogOpen, setIsEditWorkersDialogOpen] = useState(false);
  const [isUpdateRatesOpen, setIsUpdateRatesOpen] = useState(false);
  const [updatingRatesShare, setUpdatingRatesShare] = useState<JobShareWithDetails | null>(null);
  const [updatedRates, setUpdatedRates] = useState<Array<{ role: string; count: number; hourlyRate: string }>>([]);
  const [editingShare, setEditingShare] = useState<JobShareWithDetails | null>(null);
  const [acceptingShare, setAcceptingShare] = useState<JobShareWithDetails | null>(null);
  const [editingWorkersShare, setEditingWorkersShare] = useState<JobShareWithDetails | null>(null);
  const [assignedWorkers, setAssignedWorkers] = useState<Array<{ name: string; role: JobShareRole; phone: string; email: string; siaLicense: string }>>([]);
  const [editWorkers, setEditWorkers] = useState<Array<{ name: string; role: JobShareRole; phone: string; email: string; siaLicense: string }>>([]);
  const [acceptNotes, setAcceptNotes] = useState("");
  const [acceptedCounts, setAcceptedCounts] = useState<Array<{ role: JobShareRole; maxCount: number; acceptCount: number; hourlyRate: string }>>([]);
  const [selectedTab, setSelectedTab] = useState<'offered' | 'received'>('offered');
  const [expandedShares, setExpandedShares] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
    setExpandedShares(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const [offeredLastViewed, setOfferedLastViewed] = useState<number>(() => {
    const stored = localStorage.getItem(`jobshare_offered_viewed_${user?.id}`);
    return stored ? parseInt(stored, 10) : 0;
  });

  const markOfferedViewed = useCallback(() => {
    const now = Date.now();
    setOfferedLastViewed(now);
    localStorage.setItem(`jobshare_offered_viewed_${user?.id}`, now.toString());
  }, [user?.id]);

  const [formData, setFormData] = useState({
    toCompanyId: "",
    siteId: "",
    startDate: "",
    endDate: "",
    requirements: "",
  });
  const [positions, setPositions] = useState<PositionRow[]>([emptyPosition()]);
  const [deadlineOption, setDeadlineOption] = useState<string>("none");
  const [customDeadlineHours, setCustomDeadlineHours] = useState<string>("24");

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

  interface CompanyEmployee {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    fullName: string;
  }

  const { data: companyEmployees = [] } = useQuery<CompanyEmployee[]>({
    queryKey: ['/api/company-employees'],
  });

  useEffect(() => {
    if (selectedTab === 'offered') {
      markOfferedViewed();
    }
  }, [selectedTab, markOfferedViewed]);

  const unviewedOfferedCount = offeredShares.filter(s =>
    s.status === 'accepted' && s.reviewedAt && new Date(s.reviewedAt).getTime() > offeredLastViewed
  ).length;

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
    mutationFn: async ({ id, status, notes, assignedWorkers: workers, acceptedPositions }: { id: string; status: string; notes?: string; assignedWorkers?: any[]; acceptedPositions?: any[] }) => {
      return await apiRequest('PATCH', `/api/job-shares/${id}`, { status, reviewNotes: notes, assignedWorkers: workers, acceptedPositions });
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

  const updateWorkersMutation = useMutation({
    mutationFn: async ({ id, assignedWorkers: workers }: { id: string; assignedWorkers: any[] }) => {
      return await apiRequest('PATCH', `/api/job-shares/${id}`, { assignedWorkers: workers });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Assigned workers updated" });
      queryClient.invalidateQueries({ queryKey: ['/api/job-shares/received'] });
      queryClient.invalidateQueries({ queryKey: ['/api/job-shares/offered'] });
      setIsEditWorkersDialogOpen(false);
      setEditingWorkersShare(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update workers", variant: "destructive" });
    },
  });

  const openEditWorkersDialog = (share: JobShareWithDetails) => {
    setEditingWorkersShare(share);
    const existing = (share.assignedWorkers || []) as JobShareAssignedWorker[];
    if (existing.length > 0) {
      const workers = existing.map(w => ({
        name: w.name || "",
        role: normalizeLegacyRole(w.role || 'sia'),
        phone: w.phone || "",
        email: w.email || "",
        siaLicense: w.siaLicense || "",
      }));
      setEditWorkers(workers);
      const idMap: Record<number, string> = {};
      workers.forEach((w, i) => {
        const match = companyEmployees.find(e => 
          (w.email && e.email && e.email.toLowerCase() === w.email.toLowerCase()) ||
          e.fullName.toLowerCase() === w.name.toLowerCase()
        );
        if (match) idMap[i] = match.id;
      });
      setEditWorkerEmployeeIds(idMap);
    } else {
      const accepted = share.acceptedPositions as JobSharePosition[] | null;
      const positionsToUse = (accepted && accepted.length > 0) ? accepted.map(p => ({...p, role: normalizeLegacyRole(p.role)})) : getPositionsForShare(share);
      const workers: Array<{ name: string; role: JobShareRole; phone: string; email: string; siaLicense: string }> = [];
      for (const pos of positionsToUse) {
        for (let i = 0; i < Number(pos.count); i++) {
          workers.push({ name: "", role: pos.role, phone: "", email: "", siaLicense: "" });
        }
      }
      setEditWorkers(workers);
    }
    setIsEditWorkersDialogOpen(true);
  };

  const handleSaveWorkers = () => {
    if (!editingWorkersShare) return;
    updateWorkersMutation.mutate({
      id: editingWorkersShare.id,
      assignedWorkers: editWorkers,
    });
  };

  const updateEditWorker = (index: number, field: string, value: string) => {
    setEditWorkers(prev => prev.map((w, i) => i === index ? { ...w, [field]: value } : w));
  };

  const addEditWorker = () => {
    setEditWorkers(prev => [...prev, { name: "", role: "sia" as JobShareRole, phone: "", email: "", siaLicense: "" }]);
  };

  const removeEditWorker = (index: number) => {
    if (editWorkers.length <= 1) return;
    setEditWorkers(prev => prev.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setFormData({ toCompanyId: "", siteId: "", startDate: "", endDate: "", requirements: "" });
    setPositions([emptyPosition()]);
    setDeadlineOption("none");
    setCustomDeadlineHours("24");
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

  const computeDeadline = (): string | null => {
    if (deadlineOption === 'none') return null;
    const now = new Date();
    let hours = 0;
    switch (deadlineOption) {
      case '2h': hours = 2; break;
      case '6h': hours = 6; break;
      case '12h': hours = 12; break;
      case '24h': hours = 24; break;
      case 'custom': hours = parseFloat(customDeadlineHours) || 24; break;
    }
    now.setTime(now.getTime() + hours * 60 * 60 * 1000);
    return now.toISOString();
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
    const deadline = computeDeadline();
    createMutation.mutate({ ...formData, positions, responseDeadline: deadline });
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
      setPositions(sharePositions.map(p => ({ role: normalizeLegacyRole(p.role), count: Number(p.count), hourlyRate: p.hourlyRate })));
    } else {
      setPositions([{ role: normalizeLegacyRole(share.workingRole || 'sia'), count: Number(share.numberOfJobs), hourlyRate: String(share.hourlyRate) }]);
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

  const openUpdateRatesDialog = (share: JobShareWithDetails) => {
    setUpdatingRatesShare(share);
    const sharePositions = getPositionsForShare(share);
    setUpdatedRates(sharePositions.map(p => ({ role: p.role, count: Number(p.count), hourlyRate: p.hourlyRate })));
    setIsUpdateRatesOpen(true);
  };

  const handleUpdateRates = () => {
    if (!updatingRatesShare) return;
    if (updatedRates.some(p => !p.hourlyRate || parseFloat(p.hourlyRate) <= 0)) {
      toast({ title: "Validation Error", description: "All positions need a valid hourly rate", variant: "destructive" });
      return;
    }
    updateMutation.mutate({
      id: updatingRatesShare.id,
      data: { positions: updatedRates },
    }, {
      onSuccess: () => {
        setIsUpdateRatesOpen(false);
        setUpdatingRatesShare(null);
        setUpdatedRates([]);
      },
    });
  };

  const openAcceptDialog = (share: JobShareWithDetails) => {
    setAcceptingShare(share);
    const sharePositions = getPositionsForShare(share);
    const counts = sharePositions.map(p => ({
      role: p.role,
      maxCount: Number(p.count),
      acceptCount: Number(p.count),
      hourlyRate: p.hourlyRate,
    }));
    setAcceptedCounts(counts);
    const workers: Array<{ name: string; role: JobShareRole; phone: string; email: string; siaLicense: string }> = [];
    for (const pos of sharePositions) {
      for (let i = 0; i < Number(pos.count); i++) {
        workers.push({ name: "", role: pos.role, phone: "", email: "", siaLicense: "" });
      }
    }
    setAssignedWorkers(workers);
    setAcceptNotes("");
    setWorkerEmployeeIds({});
    setIsAcceptDialogOpen(true);
  };

  const updateAcceptedCount = (index: number, newCount: number) => {
    setAcceptedCounts(prev => {
      const updated = prev.map((c, i) => i === index ? { ...c, acceptCount: Math.max(0, Math.min(newCount, c.maxCount)) } : c);
      const workers: Array<{ name: string; role: JobShareRole; phone: string; email: string; siaLicense: string }> = [];
      for (const pos of updated) {
        for (let i = 0; i < pos.acceptCount; i++) {
          workers.push({ name: "", role: pos.role, phone: "", email: "", siaLicense: "" });
        }
      }
      setAssignedWorkers(workers);
      return updated;
    });
  };

  const handleAccept = () => {
    if (!acceptingShare) return;
    const totalAccepted = acceptedCounts.reduce((sum, c) => sum + c.acceptCount, 0);
    if (totalAccepted === 0) {
      toast({ title: "Validation Error", description: "Please accept at least one position", variant: "destructive" });
      return;
    }
    const filledWorkers = assignedWorkers.filter(w => w.name.trim());
    if (filledWorkers.length === 0) {
      toast({ title: "Validation Error", description: "Please add at least one worker name", variant: "destructive" });
      return;
    }
    const acceptedPositions = acceptedCounts
      .filter(c => c.acceptCount > 0)
      .map(c => ({ role: c.role, count: c.acceptCount, hourlyRate: c.hourlyRate }));
    updateStatusMutation.mutate({
      id: acceptingShare.id,
      status: 'accepted',
      notes: acceptNotes || undefined,
      assignedWorkers: filledWorkers,
      acceptedPositions,
    });
    setIsAcceptDialogOpen(false);
    setAcceptingShare(null);
  };

  const [workerEmployeeIds, setWorkerEmployeeIds] = useState<Record<number, string>>({});
  const [editWorkerEmployeeIds, setEditWorkerEmployeeIds] = useState<Record<number, string>>({});

  const selectWorkerFromEmployee = (index: number, employeeId: string) => {
    const emp = companyEmployees.find(e => e.id === employeeId);
    if (emp) {
      setWorkerEmployeeIds(prev => ({ ...prev, [index]: employeeId }));
      setAssignedWorkers(prev => prev.map((w, i) => i === index ? {
        ...w,
        name: emp.fullName,
        email: emp.email,
        phone: w.phone,
        siaLicense: w.siaLicense,
      } : w));
    }
  };

  const selectEditWorkerFromEmployee = (index: number, employeeId: string) => {
    const emp = companyEmployees.find(e => e.id === employeeId);
    if (emp) {
      setEditWorkerEmployeeIds(prev => ({ ...prev, [index]: employeeId }));
      setEditWorkers(prev => prev.map((w, i) => i === index ? {
        ...w,
        name: emp.fullName,
        email: emp.email,
        phone: w.phone,
        siaLicense: w.siaLicense,
      } : w));
    }
  };

  const updateWorker = (index: number, field: string, value: string) => {
    setAssignedWorkers(prev => prev.map((w, i) => i === index ? { ...w, [field]: value } : w));
  };

  const addWorker = () => {
    setAssignedWorkers(prev => [...prev, { name: "", role: "sia", phone: "", email: "", siaLicense: "" }]);
  };

  const removeWorker = (index: number) => {
    if (assignedWorkers.length <= 1) return;
    setAssignedWorkers(prev => prev.filter((_, i) => i !== index));
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
      case 'withdrawn':
        return <Badge variant="outline" className="bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20">
          <X className="h-3 w-3 mr-1" />Withdrawn
        </Badge>;
      case 'cancelled':
        return <Badge variant="outline" className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20">
          <X className="h-3 w-3 mr-1" />Cancelled
        </Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

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

              <PositionsEditor
                positions={positions}
                onAdd={addPosition}
                onRemove={removePosition}
                onUpdate={updatePosition}
              />

              <div>
                <Label>Response Deadline (Optional)</Label>
                <Select value={deadlineOption} onValueChange={setDeadlineOption}>
                  <SelectTrigger data-testid="select-deadline">
                    <SelectValue placeholder="No deadline" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No deadline</SelectItem>
                    <SelectItem value="2h">2 hours</SelectItem>
                    <SelectItem value="6h">6 hours</SelectItem>
                    <SelectItem value="12h">12 hours</SelectItem>
                    <SelectItem value="24h">24 hours</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
                {deadlineOption === 'custom' && (
                  <div className="mt-2">
                    <Label className="text-xs text-muted-foreground">Hours from now</Label>
                    <Input
                      type="number"
                      min="1"
                      value={customDeadlineHours}
                      onChange={(e) => setCustomDeadlineHours(e.target.value)}
                      data-testid="input-custom-deadline"
                    />
                  </div>
                )}
              </div>

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
        <Button variant={selectedTab === 'offered' ? 'default' : 'ghost'} onClick={() => setSelectedTab('offered')} data-testid="tab-offered-shares" className="relative">
          Offered to Others
          {unviewedOfferedCount > 0 && selectedTab !== 'offered' && (
            <Badge variant="destructive" className="ml-2 text-[10px] leading-none px-1.5 py-0.5">
              {unviewedOfferedCount}
            </Badge>
          )}
        </Button>
        <Button variant={selectedTab === 'received' ? 'default' : 'ghost'} onClick={() => setSelectedTab('received')} data-testid="tab-received-shares" className="relative">
          Received from Others
          {receivedShares.filter(s => s.status === 'pending').length > 0 && selectedTab !== 'received' && (
            <Badge variant="destructive" className="ml-2 text-[10px] leading-none px-1.5 py-0.5">
              {receivedShares.filter(s => s.status === 'pending').length}
            </Badge>
          )}
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
              const accepted = share.acceptedPositions as JobSharePosition[] | null;
              const isPartial = accepted && accepted.length > 0 && getTotalPositions(accepted.map(p => ({...p, role: normalizeLegacyRole(p.role)}))) < getTotalPositions(sharePositions);
              const isExpanded = expandedShares.has(share.id);
              const totalPos = getTotalPositions(sharePositions);
              const period = `${format(new Date(share.startDate), "MMM d")} – ${format(new Date(share.endDate), "MMM d, yyyy")}`;
              return (
                <Card key={share.id} data-testid={`job-share-${share.id}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Building2 className="h-4 w-4 shrink-0" />
                          <span className="truncate">{share.toCompany?.name || "Unknown Company"}</span>
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-0.5">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{share.site?.name || "Unknown Site"}</span>
                        </CardDescription>
                        <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1"><Users className="h-3 w-3" />{isPartial ? `${getTotalPositions(accepted!.map(p => ({...p, role: normalizeLegacyRole(p.role)})))}/${totalPos} positions` : `${totalPos} position${totalPos !== 1 ? 's' : ''}`}</span>
                          <span className="text-muted-foreground/40">·</span>
                          <span>{period}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap justify-end shrink-0">
                        {getStatusBadge(share.status)}
                        {isPartial && (
                          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20" data-testid={`badge-partial-${share.id}`}>
                            Partial
                          </Badge>
                        )}
                        <JobShareDeadline deadline={(share as any).responseDeadline} status={share.status} />
                        {(share.status === 'pending' || share.status === 'accepted') && (
                          <>
                            <Button size="icon" variant="ghost" onClick={() => openUpdateRatesDialog(share)} title="Update rates" data-testid={`button-update-rates-${share.id}`}>
                              <PoundSterling className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => openEditDialog(share)} data-testid={`button-edit-${share.id}`}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {share.status === 'accepted' ? (
                              <Button size="icon" variant="ghost" onClick={() => { if (confirm("Are you sure you want to cancel this job share? All future shifts will be removed and the accepting company will be notified.")) { updateStatusMutation.mutate({ id: share.id, status: 'cancelled' }); } }} data-testid={`button-cancel-${share.id}`}>
                                <X className="h-4 w-4 text-destructive" />
                              </Button>
                            ) : (
                              <Button size="icon" variant="ghost" onClick={() => { if (confirm("Are you sure you want to delete this job share?")) { deleteMutation.mutate(share.id); } }} data-testid={`button-delete-${share.id}`}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </>
                        )}
                        <Button size="icon" variant="ghost" onClick={() => toggleExpanded(share.id)} data-testid={`button-expand-${share.id}`} title={isExpanded ? "Collapse" : "Expand"}>
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  {isExpanded && (
                    <CardContent className="space-y-3 pt-0">
                      <JobShareProgress positions={sharePositions} acceptedPositions={accepted} status={share.status} />
                      {isPartial && accepted ? (
                        <div>
                          <p className="text-sm text-muted-foreground mb-2">Accepted Positions</p>
                          <PositionsDisplay positions={accepted.map(p => ({...p, role: normalizeLegacyRole(p.role)}))} />
                          <p className="text-sm text-muted-foreground mb-2 mt-3">Originally Requested</p>
                          <PositionsDisplay positions={sharePositions} />
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm text-muted-foreground mb-2">Positions & Rates</p>
                          <PositionsDisplay positions={sharePositions} />
                        </div>
                      )}
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
                      {share.status === 'accepted' && share.assignedWorkers && share.assignedWorkers.length > 0 && (
                        <div className="pt-2 border-t">
                          <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
                            <UserPlus className="h-4 w-4" />Assigned Workers ({share.assignedWorkers.length})
                          </p>
                          <AssignedWorkersDisplay workers={share.assignedWorkers} />
                        </div>
                      )}
                      <JobShareMessages jobShareId={share.id} />
                    </CardContent>
                  )}
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
              const accepted = share.acceptedPositions as JobSharePosition[] | null;
              const isPartial = accepted && accepted.length > 0 && getTotalPositions(accepted.map(p => ({...p, role: normalizeLegacyRole(p.role)}))) < getTotalPositions(sharePositions);
              const expired = isDeadlineExpired((share as any).responseDeadline);
              const isExpanded = expandedShares.has(share.id);
              const totalPos = getTotalPositions(sharePositions);
              const period = `${format(new Date(share.startDate), "MMM d")} – ${format(new Date(share.endDate), "MMM d, yyyy")}`;
              return (
                <Card key={share.id} className={expired && share.status === 'pending' ? 'border-red-500/30 opacity-80' : ''} data-testid={`received-share-${share.id}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Building2 className="h-4 w-4 shrink-0" />
                          <span className="truncate">{share.fromCompany?.name || "Unknown Company"}</span>
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-0.5">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{share.site?.name || "Unknown Site"}</span>
                        </CardDescription>
                        <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1"><Users className="h-3 w-3" />{isPartial ? `${getTotalPositions(accepted!.map(p => ({...p, role: normalizeLegacyRole(p.role)})))}/${totalPos} positions` : `${totalPos} position${totalPos !== 1 ? 's' : ''}`}</span>
                          <span className="text-muted-foreground/40">·</span>
                          <span>{period}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap justify-end shrink-0">
                        {getStatusBadge(share.status)}
                        {isPartial && (
                          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20" data-testid={`badge-partial-received-${share.id}`}>
                            Partial
                          </Badge>
                        )}
                        <JobShareDeadline deadline={(share as any).responseDeadline} status={share.status} />
                        {share.status === 'pending' && !expired && (
                          <>
                            <Button size="sm" onClick={() => openAcceptDialog(share)} disabled={updateStatusMutation.isPending} data-testid={`button-accept-${share.id}`}>
                              <Check className="h-3 w-3 mr-1" />Accept
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => updateStatusMutation.mutate({ id: share.id, status: 'rejected' })} disabled={updateStatusMutation.isPending} data-testid={`button-reject-${share.id}`}>
                              <X className="h-3 w-3 mr-1" />Reject
                            </Button>
                          </>
                        )}
                        {share.status === 'pending' && expired && (
                          <span className="text-xs text-red-600 dark:text-red-400 font-medium">Window closed</span>
                        )}
                        <Button size="icon" variant="ghost" onClick={() => toggleExpanded(share.id)} data-testid={`button-expand-received-${share.id}`} title={isExpanded ? "Collapse" : "Expand"}>
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  {isExpanded && (
                    <CardContent className="space-y-3 pt-0">
                      <JobShareProgress positions={sharePositions} acceptedPositions={accepted} status={share.status} />
                      {isPartial && accepted ? (
                        <div>
                          <p className="text-sm text-muted-foreground mb-2">Accepted Positions</p>
                          <PositionsDisplay positions={accepted.map(p => ({...p, role: normalizeLegacyRole(p.role)}))} />
                          <p className="text-sm text-muted-foreground mb-2 mt-3">Originally Requested</p>
                          <PositionsDisplay positions={sharePositions} />
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm text-muted-foreground mb-2">Positions & Rates</p>
                          <PositionsDisplay positions={sharePositions} />
                        </div>
                      )}
                      {share.requirements && (
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Requirements</p>
                          <p className="text-sm">{share.requirements}</p>
                        </div>
                      )}
                      {share.status === 'accepted' && (
                        <div className="pt-2 border-t">
                          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <UserPlus className="h-4 w-4" />Assigned Workers
                              {share.assignedWorkers && share.assignedWorkers.length > 0 && ` (${share.assignedWorkers.length})`}
                            </p>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Button size="sm" variant="outline" onClick={() => openEditWorkersDialog(share)} data-testid={`button-edit-workers-${share.id}`}>
                                <Pencil className="h-3 w-3 mr-1" />Edit Workers
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => { if (confirm("Are you sure you want to withdraw from this job share? This will remove all assigned workers and cancel any future shifts.")) { updateStatusMutation.mutate({ id: share.id, status: 'withdrawn', notes: 'Withdrawn by accepting company' }); } }} disabled={updateStatusMutation.isPending} data-testid={`button-withdraw-${share.id}`}>
                                <X className="h-3 w-3 mr-1" />Withdraw
                              </Button>
                            </div>
                          </div>
                          {share.assignedWorkers && share.assignedWorkers.length > 0 ? (
                            <AssignedWorkersDisplay workers={share.assignedWorkers} />
                          ) : (
                            <p className="text-sm text-muted-foreground italic">No workers assigned yet</p>
                          )}
                        </div>
                      )}
                      {(share.status === 'withdrawn' || share.status === 'rejected') && (
                        <div className="flex gap-2 pt-2 border-t">
                          <Button size="sm" onClick={() => openAcceptDialog(share)} disabled={updateStatusMutation.isPending} data-testid={`button-reaccept-${share.id}`}>
                            <Check className="h-4 w-4 mr-1" />Re-accept
                          </Button>
                        </div>
                      )}
                      <JobShareMessages jobShareId={share.id} />
                    </CardContent>
                  )}
                </Card>
              );
            })
          )}
        </div>
      )}

      <Dialog open={isAcceptDialogOpen} onOpenChange={(open) => { setIsAcceptDialogOpen(open); if (!open) { setAcceptingShare(null); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] !flex !flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Accept Job Share</DialogTitle>
            <DialogDescription>
              Choose how many positions to accept and assign workers.
              {acceptingShare && (
                <span className="block mt-1 text-xs">
                  From: {acceptingShare.fromCompany?.name} | Site: {acceptingShare.site?.name}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto pr-2 space-y-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">Positions to Accept</Label>
              <div className="space-y-2">
                {acceptedCounts.map((pos, index) => (
                  <div key={index} className="flex items-center justify-between gap-3 p-3 rounded-md border bg-muted/30" data-testid={`accept-position-row-${index}`}>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Badge variant="outline">{ROLE_LABELS[pos.role] || pos.role}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {pos.maxCount} requested at {pos.hourlyRate}/hr
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => updateAcceptedCount(index, pos.acceptCount - 1)}
                        disabled={pos.acceptCount <= 0}
                        data-testid={`button-decrease-${index}`}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center font-semibold" data-testid={`text-accept-count-${index}`}>{pos.acceptCount}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => updateAcceptedCount(index, pos.acceptCount + 1)}
                        disabled={pos.acceptCount >= pos.maxCount}
                        data-testid={`button-increase-${index}`}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Accepting {acceptedCounts.reduce((sum, c) => sum + c.acceptCount, 0)} of {acceptedCounts.reduce((sum, c) => sum + c.maxCount, 0)} total positions
              </p>
            </div>

            <div className="flex items-center justify-between flex-wrap gap-2">
              <Label className="text-sm font-medium">Workers to Assign</Label>
              <Button type="button" variant="outline" size="sm" onClick={addWorker} data-testid="button-add-worker">
                <Plus className="h-3 w-3 mr-1" />Add Worker
              </Button>
            </div>
            {assignedWorkers.map((worker, index) => {
              return (
                <div key={index} className="p-3 rounded-md border bg-muted/30 space-y-3" data-testid={`accept-worker-row-${index}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground font-medium">Worker {index + 1}</span>
                    {assignedWorkers.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeWorker(index)} data-testid={`button-remove-worker-${index}`}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Employee *</Label>
                      <Select
                        value={workerEmployeeIds[index] || ""}
                        onValueChange={(v) => selectWorkerFromEmployee(index, v)}
                      >
                        <SelectTrigger data-testid={`select-worker-employee-${index}`}>
                          <SelectValue placeholder="Select employee" />
                        </SelectTrigger>
                        <SelectContent>
                          {companyEmployees.map(emp => (
                            <SelectItem key={emp.id} value={emp.id}>
                              {emp.fullName}{emp.email ? ` (${emp.email})` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Role</Label>
                      <Select value={worker.role} onValueChange={(v) => updateWorker(index, 'role', v)}>
                        <SelectTrigger data-testid={`select-worker-role-${index}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {JOB_SHARE_ROLES.map(role => (
                            <SelectItem key={role} value={role}>{ROLE_LABELS[role]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Phone</Label>
                      <Input
                        placeholder="Phone number"
                        value={worker.phone}
                        onChange={(e) => updateWorker(index, 'phone', e.target.value)}
                        data-testid={`input-worker-phone-${index}`}
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs text-muted-foreground">SIA License Number</Label>
                      <Input
                        placeholder="SIA license (optional)"
                        value={worker.siaLicense}
                        onChange={(e) => updateWorker(index, 'siaLicense', e.target.value)}
                        data-testid={`input-worker-sia-${index}`}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
            <div>
              <Label>Notes (Optional)</Label>
              <Textarea
                placeholder="Any additional notes..."
                value={acceptNotes}
                onChange={(e) => setAcceptNotes(e.target.value)}
                data-testid="textarea-accept-notes"
              />
            </div>
          </div>
          <DialogFooter className="flex-shrink-0">
            <Button variant="outline" onClick={() => setIsAcceptDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAccept} disabled={updateStatusMutation.isPending} data-testid="button-confirm-accept">
              {updateStatusMutation.isPending ? "Accepting..." : `Accept ${acceptedCounts.reduce((sum, c) => sum + c.acceptCount, 0)} Position${acceptedCounts.reduce((sum, c) => sum + c.acceptCount, 0) !== 1 ? 's' : ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isUpdateRatesOpen} onOpenChange={(open) => { setIsUpdateRatesOpen(open); if (!open) { setUpdatingRatesShare(null); setUpdatedRates([]); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Update Rates</DialogTitle>
            <DialogDescription>
              Adjust the hourly pay rate for each position. Roles and headcounts are not changed here.
              {updatingRatesShare && (
                <span className="block mt-1 text-xs">
                  For: {updatingRatesShare.toCompany?.name} — {updatingRatesShare.site?.name}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {updatedRates.map((pos, index) => (
              <div key={index} className="flex items-center gap-3 p-3 rounded-md border bg-muted/30" data-testid={`update-rate-row-${index}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{ROLE_LABELS[pos.role] || pos.role}</p>
                  <p className="text-xs text-muted-foreground">{pos.count} position{pos.count !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <PoundSterling className="h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={pos.hourlyRate}
                    onChange={(e) => setUpdatedRates(prev => prev.map((p, i) => i === index ? { ...p, hourlyRate: e.target.value } : p))}
                    className="w-24 text-right"
                    data-testid={`input-update-rate-${index}`}
                  />
                  <span className="text-xs text-muted-foreground">/hr</span>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUpdateRatesOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateRates} disabled={updateMutation.isPending} data-testid="button-save-rates">
              {updateMutation.isPending ? "Saving..." : "Save Rates"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

            <PositionsEditor
              positions={positions}
              onAdd={addPosition}
              onRemove={removePosition}
              onUpdate={updatePosition}
            />

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

      <Dialog open={isEditWorkersDialogOpen} onOpenChange={(open) => { setIsEditWorkersDialogOpen(open); if (!open) { setEditingWorkersShare(null); setEditWorkers([]); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] !flex !flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Edit Assigned Workers</DialogTitle>
            <DialogDescription>
              Update the workers assigned to this job share.
              {editingWorkersShare && (
                <span className="block mt-1 text-xs">
                  From: {editingWorkersShare.fromCompany?.name} | Site: {editingWorkersShare.site?.name}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto pr-2">
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <Label className="text-sm font-medium">Workers</Label>
                <Button type="button" variant="outline" size="sm" onClick={addEditWorker} data-testid="button-add-edit-worker">
                  <Plus className="h-3 w-3 mr-1" />Add Worker
                </Button>
              </div>
              {editWorkers.map((worker, index) => {
                return (
                  <div key={index} className="p-3 rounded-md border bg-muted/30 space-y-3" data-testid={`edit-worker-row-${index}`}>
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline" className="text-xs">Worker {index + 1}</Badge>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Select value={worker.role} onValueChange={(val) => updateEditWorker(index, 'role', val)}>
                          <SelectTrigger className="w-[140px]" data-testid={`edit-worker-role-${index}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {JOB_SHARE_ROLES.map(r => (
                              <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {editWorkers.length > 1 && (
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeEditWorker(index)} data-testid={`button-remove-edit-worker-${index}`}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">Employee *</Label>
                        <Select
                          value={editWorkerEmployeeIds[index] || ""}
                          onValueChange={(v) => selectEditWorkerFromEmployee(index, v)}
                        >
                          <SelectTrigger data-testid={`edit-worker-employee-${index}`}>
                            <SelectValue placeholder={worker.name || "Select employee"} />
                          </SelectTrigger>
                          <SelectContent>
                            {companyEmployees.map(emp => (
                              <SelectItem key={emp.id} value={emp.id}>
                                {emp.fullName}{emp.email ? ` (${emp.email})` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Input
                        placeholder="Phone (optional)"
                        value={worker.phone}
                        onChange={(e) => updateEditWorker(index, 'phone', e.target.value)}
                        data-testid={`edit-worker-phone-${index}`}
                      />
                      <Input
                        placeholder="SIA license (optional)"
                        value={worker.siaLicense}
                        onChange={(e) => updateEditWorker(index, 'siaLicense', e.target.value)}
                        data-testid={`edit-worker-sia-${index}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <DialogFooter className="flex-shrink-0">
            <Button variant="outline" onClick={() => setIsEditWorkersDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveWorkers} disabled={updateWorkersMutation.isPending} data-testid="button-save-workers">
              {updateWorkersMutation.isPending ? "Saving..." : "Save Workers"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

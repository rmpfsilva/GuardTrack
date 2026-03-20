import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { MapPin, Plus, Pencil, Trash2, UserPlus, Users, Building2, CheckCircle, Clock } from "lucide-react";
import type { Site } from "@shared/schema";

interface CompanyUser {
  id: string;
  username: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  role: string;
  isActivated: boolean | null;
  companyId: string | null;
}

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

const blankSiteForm = () => ({
  name: "", address: "", contactName: "", contactPhone: "", isActive: true,
  guardRate: "15.00", stewardRate: "18.00", supervisorRate: "22.00",
  callOutRate: "15.00", doorSupervisorRate: "15.00", cctvOperatorRate: "15.00",
  keyHolderRate: "15.00", mobilePatrolRate: "15.00",
  guardClientRate: "20.00", stewardClientRate: "23.00", supervisorClientRate: "28.00",
  callOutClientRate: "20.00", doorSupervisorClientRate: "20.00",
  cctvOperatorClientRate: "20.00", keyHolderClientRate: "20.00", mobilePatrolClientRate: "20.00",
});

function SiteFormFields({ formData, onChange }: { formData: any; onChange: (d: any) => void }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Site Name *</Label>
          <Input placeholder="Downtown Office" value={formData.name} onChange={e => onChange({ ...formData, name: e.target.value })} data-testid="input-site-name" />
        </div>
        <div className="space-y-1.5">
          <Label>Address</Label>
          <Input placeholder="123 Main St, London" value={formData.address} onChange={e => onChange({ ...formData, address: e.target.value })} data-testid="input-site-address" />
        </div>
        <div className="space-y-1.5">
          <Label>Contact Name</Label>
          <Input placeholder="John Smith" value={formData.contactName} onChange={e => onChange({ ...formData, contactName: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Contact Phone</Label>
          <Input placeholder="+44 7700 900000" value={formData.contactPhone} onChange={e => onChange({ ...formData, contactPhone: e.target.value })} />
        </div>
      </div>
      <div>
        <p className="text-sm font-medium mb-2">Rates (Staff / Client)</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {JOB_ROLES.map(role => (
            <div key={role.key} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-28 shrink-0">{role.label}</span>
              <Input
                className="h-7 text-xs"
                placeholder={role.staffDefault}
                value={formData[role.staffField]}
                onChange={e => onChange({ ...formData, [role.staffField]: e.target.value })}
              />
              <span className="text-xs text-muted-foreground">/</span>
              <Input
                className="h-7 text-xs"
                placeholder={role.clientDefault}
                value={formData[role.clientField]}
                onChange={e => onChange({ ...formData, [role.clientField]: e.target.value })}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface Props {
  companyId: string;
  companyName: string;
  open: boolean;
  onClose: () => void;
}

export function CompanyManageDialog({ companyId, companyName, open, onClose }: Props) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"sites" | "users">("sites");
  const [showAddSite, setShowAddSite] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [siteForm, setSiteForm] = useState(blankSiteForm());
  const [showInviteUser, setShowInviteUser] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("guard");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const sitesKey = ["/api/super-admin/companies", companyId, "sites"];
  const usersKey = ["/api/super-admin/companies", companyId, "users"];

  const { data: companySites = [], isLoading: sitesLoading } = useQuery<Site[]>({
    queryKey: sitesKey,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/super-admin/companies/${companyId}/sites`);
      return res.json();
    },
    enabled: open && activeTab === "sites",
  });

  const { data: companyUsers = [], isLoading: usersLoading } = useQuery<CompanyUser[]>({
    queryKey: usersKey,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/super-admin/companies/${companyId}/users`);
      return res.json();
    },
    enabled: open && activeTab === "users",
  });

  const createSiteMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/super-admin/companies/${companyId}/sites`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sitesKey });
      setShowAddSite(false);
      setSiteForm(blankSiteForm());
      toast({ title: "Site created", description: `Site added to ${companyName}` });
    },
    onError: (e: any) => toast({ title: "Failed to create site", description: e.message, variant: "destructive" }),
  });

  const updateSiteMutation = useMutation({
    mutationFn: async ({ siteId, data }: { siteId: string; data: any }) => {
      const res = await apiRequest("PATCH", `/api/super-admin/companies/${companyId}/sites/${siteId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sitesKey });
      setEditingSite(null);
      setSiteForm(blankSiteForm());
      toast({ title: "Site updated" });
    },
    onError: (e: any) => toast({ title: "Failed to update site", description: e.message, variant: "destructive" }),
  });

  const deleteSiteMutation = useMutation({
    mutationFn: async (siteId: string) => {
      await apiRequest("DELETE", `/api/super-admin/companies/${companyId}/sites/${siteId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sitesKey });
      setDeletingId(null);
      toast({ title: "Site deleted" });
    },
    onError: (e: any) => toast({ title: "Failed to delete site", description: e.message, variant: "destructive" }),
  });

  const inviteUserMutation = useMutation({
    mutationFn: async (data: { email: string; role: string }) => {
      const res = await apiRequest("POST", `/api/super-admin/companies/${companyId}/invite-user`, data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: usersKey });
      setShowInviteUser(false);
      setInviteEmail("");
      setInviteRole("guard");
      const msg = data.type === "direct_membership"
        ? "User added directly to this company."
        : "Invitation email sent to user.";
      toast({ title: "User invited", description: msg });
    },
    onError: (e: any) => toast({ title: "Failed to invite user", description: e.message, variant: "destructive" }),
  });

  function startEdit(site: Site) {
    setEditingSite(site);
    setSiteForm({
      name: site.name, address: site.address || "", contactName: site.contactName || "",
      contactPhone: site.contactPhone || "", isActive: site.isActive ?? true,
      guardRate: site.guardRate || "15.00", stewardRate: site.stewardRate || "18.00",
      supervisorRate: site.supervisorRate || "22.00", callOutRate: site.callOutRate || "15.00",
      doorSupervisorRate: site.doorSupervisorRate || "15.00",
      cctvOperatorRate: site.cctvOperatorRate || "15.00",
      keyHolderRate: site.keyHolderRate || "15.00", mobilePatrolRate: site.mobilePatrolRate || "15.00",
      guardClientRate: site.guardClientRate || "20.00",
      stewardClientRate: site.stewardClientRate || "23.00",
      supervisorClientRate: site.supervisorClientRate || "28.00",
      callOutClientRate: site.callOutClientRate || "20.00",
      doorSupervisorClientRate: site.doorSupervisorClientRate || "20.00",
      cctvOperatorClientRate: site.cctvOperatorClientRate || "20.00",
      keyHolderClientRate: site.keyHolderClientRate || "20.00",
      mobilePatrolClientRate: site.mobilePatrolClientRate || "20.00",
    });
    setShowAddSite(true);
  }

  function handleClose() {
    setShowAddSite(false);
    setEditingSite(null);
    setSiteForm(blankSiteForm());
    setShowInviteUser(false);
    setInviteEmail("");
    setInviteRole("guard");
    setDeletingId(null);
    setActiveTab("sites");
    onClose();
  }

  const roleBadgeVariant: Record<string, "default" | "secondary" | "outline"> = {
    admin: "default", supervisor: "secondary", steward: "outline", guard: "outline",
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col gap-0 p-0" data-testid="dialog-manage-company">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Manage — {companyName}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={v => setActiveTab(v as any)} className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-6 mt-4 mb-2 shrink-0 w-fit">
            <TabsTrigger value="sites" data-testid="tab-manage-sites">
              <MapPin className="h-4 w-4 mr-1.5" />
              Sites
            </TabsTrigger>
            <TabsTrigger value="users" data-testid="tab-manage-users">
              <Users className="h-4 w-4 mr-1.5" />
              Users
            </TabsTrigger>
          </TabsList>

          {/* ── SITES TAB ── */}
          <TabsContent value="sites" className="flex-1 overflow-y-auto px-6 pb-6 mt-0">
            {showAddSite ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{editingSite ? "Edit Site" : "Add New Site"}</h3>
                  <Button variant="ghost" size="sm" onClick={() => { setShowAddSite(false); setEditingSite(null); setSiteForm(blankSiteForm()); }}>
                    Cancel
                  </Button>
                </div>
                <SiteFormFields formData={siteForm} onChange={setSiteForm} />
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    onClick={() => {
                      if (editingSite) {
                        updateSiteMutation.mutate({ siteId: editingSite.id, data: siteForm });
                      } else {
                        createSiteMutation.mutate(siteForm);
                      }
                    }}
                    disabled={!siteForm.name || createSiteMutation.isPending || updateSiteMutation.isPending}
                    data-testid="button-save-site"
                  >
                    {(createSiteMutation.isPending || updateSiteMutation.isPending) ? "Saving..." : editingSite ? "Save Changes" : "Create Site"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{companySites.length} site{companySites.length !== 1 ? "s" : ""}</p>
                  <Button size="sm" onClick={() => { setShowAddSite(true); setEditingSite(null); setSiteForm(blankSiteForm()); }} data-testid="button-add-site">
                    <Plus className="h-4 w-4 mr-1.5" />
                    Add Site
                  </Button>
                </div>

                {sitesLoading ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Loading sites...</p>
                ) : companySites.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center">
                      <MapPin className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No sites yet. Add the first one.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Address</TableHead>
                        <TableHead>Guard Rate</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-20"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {companySites.map(site => (
                        deletingId === site.id ? (
                          <TableRow key={site.id} className="bg-destructive/5">
                            <TableCell colSpan={4} className="text-sm">
                              Delete <strong>{site.name}</strong>? This cannot be undone.
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => deleteSiteMutation.mutate(site.id)}
                                  disabled={deleteSiteMutation.isPending}
                                  data-testid={`button-confirm-delete-site-${site.id}`}
                                >
                                  {deleteSiteMutation.isPending ? "..." : "Delete"}
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => setDeletingId(null)}>Cancel</Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          <TableRow key={site.id} data-testid={`row-site-${site.id}`}>
                            <TableCell className="font-medium">{site.name}</TableCell>
                            <TableCell className="text-muted-foreground text-xs max-w-[160px] truncate">{site.address || "—"}</TableCell>
                            <TableCell className="text-xs">£{site.guardRate}/hr</TableCell>
                            <TableCell>
                              <Badge variant={site.isActive ? "default" : "secondary"} className="text-xs">
                                {site.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" onClick={() => startEdit(site)} data-testid={`button-edit-site-${site.id}`}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => setDeletingId(site.id)} data-testid={`button-delete-site-${site.id}`}>
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            )}
          </TabsContent>

          {/* ── USERS TAB ── */}
          <TabsContent value="users" className="flex-1 overflow-y-auto px-6 pb-6 mt-0">
            {showInviteUser ? (
              <div className="space-y-4 max-w-sm">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Invite User to {companyName}</h3>
                  <Button variant="ghost" size="sm" onClick={() => { setShowInviteUser(false); setInviteEmail(""); setInviteRole("guard"); }}>
                    Cancel
                  </Button>
                </div>
                <div className="space-y-1.5">
                  <Label>Email Address *</Label>
                  <Input
                    type="email"
                    placeholder="user@example.com"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    data-testid="input-invite-email"
                  />
                  <p className="text-xs text-muted-foreground">If already registered and active, they'll be added directly. Otherwise an invitation email is sent.</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Role</Label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger data-testid="select-invite-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="guard">Guard</SelectItem>
                      <SelectItem value="steward">Steward</SelectItem>
                      <SelectItem value="supervisor">Supervisor</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={() => inviteUserMutation.mutate({ email: inviteEmail, role: inviteRole })}
                  disabled={!inviteEmail || inviteUserMutation.isPending}
                  data-testid="button-send-invite"
                >
                  {inviteUserMutation.isPending ? "Sending..." : "Send Invitation"}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{companyUsers.length} user{companyUsers.length !== 1 ? "s" : ""}</p>
                  <Button size="sm" onClick={() => setShowInviteUser(true)} data-testid="button-invite-user">
                    <UserPlus className="h-4 w-4 mr-1.5" />
                    Invite User
                  </Button>
                </div>

                {usersLoading ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Loading users...</p>
                ) : companyUsers.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center">
                      <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No users yet. Invite the first one.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name / Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {companyUsers.map(user => (
                        <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">
                                {user.firstName || user.lastName
                                  ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
                                  : user.username}
                              </p>
                              <p className="text-xs text-muted-foreground">{user.email || user.username}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={roleBadgeVariant[user.role] || "outline"} className="text-xs capitalize">
                              {user.role}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {user.isActivated ? (
                              <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                                <CheckCircle className="h-3.5 w-3.5" />
                                Active
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="h-3.5 w-3.5" />
                                Pending
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="px-6 py-4 border-t shrink-0">
          <Button variant="outline" onClick={handleClose} data-testid="button-close-manage">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

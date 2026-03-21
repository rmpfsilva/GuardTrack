import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  User as UserIcon, Search, ChevronLeft, Plus, Pencil, Save, X,
  Phone, Mail, MapPin, Briefcase, Shield, FileText, StickyNote,
  HeartPulse, AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User, StaffProfile } from "@shared/schema";

interface GuardWithStats extends User {
  weeklyHours: number;
  totalShifts: number;
  isCurrentlyActive: boolean;
}

interface StaffProfilesProps {
  initialUserId?: string | null;
}

const EMPLOYMENT_STATUS_LABELS: Record<string, string> = {
  active: "Active",
  inactive: "Inactive",
  on_leave: "On Leave",
};

const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  full_time: "Full Time",
  part_time: "Part Time",
  contractor: "Contractor",
  casual: "Casual",
};

const ROLE_LABELS: Record<string, string> = {
  guard: "Security Guard (SIA)",
  steward: "Steward",
  supervisor: "Supervisor",
  admin: "Admin",
};

function getInitials(u: User) {
  if (u.firstName && u.lastName) return `${u.firstName[0]}${u.lastName[0]}`.toUpperCase();
  return (u.email?.[0] || "U").toUpperCase();
}

function SectionHeader({ icon: Icon, title }: { icon: React.ComponentType<{ className?: string }>; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">{title}</h3>
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm font-medium">{value || <span className="text-muted-foreground italic">Not set</span>}</p>
    </div>
  );
}

export default function StaffProfiles({ initialUserId }: StaffProfilesProps) {
  const { toast } = useToast();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(initialUserId || null);
  const [isEditing, setIsEditing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const { data: employees = [], isLoading } = useQuery<GuardWithStats[]>({
    queryKey: ["/api/admin/guards"],
  });

  const { data: profiles = [] } = useQuery<StaffProfile[]>({
    queryKey: ["/api/admin/staff-profiles"],
  });

  const { data: selectedProfile, isLoading: profileLoading } = useQuery<StaffProfile | null>({
    queryKey: ["/api/admin/staff-profiles", selectedUserId],
    enabled: !!selectedUserId,
  });

  const selectedEmployee = employees.find(e => e.id === selectedUserId);

  const [editForm, setEditForm] = useState<Record<string, string>>({});

  const saveMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("PATCH", `/api/admin/staff-profiles/${selectedUserId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/staff-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/staff-profiles", selectedUserId] });
      setIsEditing(false);
      toast({ title: "Profile saved" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });

  const startEditing = () => {
    const p = selectedProfile;
    setEditForm({
      dateOfBirth: p?.dateOfBirth ? format(new Date(p.dateOfBirth), "yyyy-MM-dd") : "",
      nationality: p?.nationality || "",
      niNumber: p?.niNumber || "",
      homeAddress: p?.homeAddress || "",
      personalEmail: p?.personalEmail || "",
      personalPhone: p?.personalPhone || "",
      emergencyContactName: p?.emergencyContactName || "",
      emergencyContactPhone: p?.emergencyContactPhone || "",
      emergencyContactRelationship: p?.emergencyContactRelationship || "",
      startDate: p?.startDate ? format(new Date(p.startDate), "yyyy-MM-dd") : "",
      endDate: p?.endDate ? format(new Date(p.endDate), "yyyy-MM-dd") : "",
      employmentStatus: p?.employmentStatus || "active",
      employmentType: p?.employmentType || "full_time",
      firstAidCert: p?.firstAidCert || "",
      firstAidExpiry: p?.firstAidExpiry ? format(new Date(p.firstAidExpiry), "yyyy-MM-dd") : "",
      adminNotes: p?.adminNotes || "",
    });
    setIsEditing(true);
  };

  const saveEdit = () => {
    const payload: any = { ...editForm };
    if (payload.dateOfBirth) payload.dateOfBirth = new Date(payload.dateOfBirth).toISOString();
    if (payload.startDate) payload.startDate = new Date(payload.startDate).toISOString();
    if (payload.endDate) payload.endDate = new Date(payload.endDate).toISOString();
    if (payload.firstAidExpiry) payload.firstAidExpiry = new Date(payload.firstAidExpiry).toISOString();
    // Strip empty strings → null
    Object.keys(payload).forEach(k => { if (payload[k] === "") payload[k] = null; });
    payload.userId = selectedUserId;
    saveMutation.mutate(payload);
  };

  const f = (k: string) => editForm[k] || "";
  const sf = (k: string, v: string) => setEditForm(prev => ({ ...prev, [k]: v }));

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return employees.filter(e => {
      const name = `${e.firstName || ""} ${e.lastName || ""}`.toLowerCase();
      const matchSearch = !q || name.includes(q) || (e.email || "").toLowerCase().includes(q);
      const matchType = typeFilter === "all" || e.role === typeFilter;
      const profile = profiles.find(p => p.userId === e.id);
      const empStatus = profile?.employmentStatus || "active";
      const matchStatus = statusFilter === "all" || empStatus === statusFilter;
      return matchSearch && matchType && matchStatus;
    });
  }, [employees, profiles, search, typeFilter, statusFilter]);

  // List view
  if (!selectedUserId) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold">Staff Profiles</h2>
          <p className="text-muted-foreground text-sm">Full HR records for each employee</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
              data-testid="input-search-profiles"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40" data-testid="select-profile-type">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="guard">SIA</SelectItem>
              <SelectItem value="steward">Steward</SelectItem>
              <SelectItem value="supervisor">Supervisor</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40" data-testid="select-profile-status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="on_leave">On Leave</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground">Loading…</div>
        ) : (
          <div className="space-y-2">
            {filtered.map(emp => {
              const profile = profiles.find(p => p.userId === emp.id);
              return (
                <Card key={emp.id} className="hover-elevate cursor-pointer" onClick={() => setSelectedUserId(emp.id)} data-testid={`profile-row-${emp.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>{getInitials(emp)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold">{emp.firstName} {emp.lastName}</p>
                          <Badge variant="outline" className="text-xs">{ROLE_LABELS[emp.role] || emp.role}</Badge>
                          {profile?.employmentStatus && profile.employmentStatus !== "active" && (
                            <Badge variant="secondary" className="text-xs">{EMPLOYMENT_STATUS_LABELS[profile.employmentStatus]}</Badge>
                          )}
                        </div>
                        <div className="flex gap-4 text-sm text-muted-foreground mt-0.5 flex-wrap">
                          {emp.email && <span>{emp.email}</span>}
                          {profile?.startDate && <span>Started {format(new Date(profile.startDate), "dd MMM yyyy")}</span>}
                        </div>
                      </div>
                      <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); setSelectedUserId(emp.id); }} data-testid={`button-view-profile-${emp.id}`}>
                        View
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {filtered.length === 0 && (
              <div className="py-16 text-center text-muted-foreground">No employees found.</div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Profile detail view
  const emp = selectedEmployee;
  if (!emp) return null;
  const p = selectedProfile;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back + Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => { setSelectedUserId(null); setIsEditing(false); }} data-testid="button-back-profiles">
          <ChevronLeft className="h-4 w-4 mr-1" />
          All Profiles
        </Button>
        <div className="flex-1" />
        {!isEditing ? (
          <Button onClick={startEditing} data-testid="button-edit-profile">
            <Pencil className="h-4 w-4 mr-2" />
            Edit Profile
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsEditing(false)} data-testid="button-cancel-edit">
              <X className="h-4 w-4 mr-2" />Cancel
            </Button>
            <Button onClick={saveEdit} disabled={saveMutation.isPending} data-testid="button-save-profile">
              <Save className="h-4 w-4 mr-2" />
              {saveMutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        )}
      </div>

      {/* Name header */}
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16">
          <AvatarFallback className="text-xl">{getInitials(emp)}</AvatarFallback>
        </Avatar>
        <div>
          <h2 className="text-2xl font-bold">{emp.firstName} {emp.lastName}</h2>
          <div className="flex gap-2 mt-1 flex-wrap">
            <Badge variant="outline">{ROLE_LABELS[emp.role] || emp.role}</Badge>
            <Badge variant={emp.isActivated ? "default" : "secondary"}>{emp.isActivated ? "Active" : "Inactive"}</Badge>
          </div>
        </div>
      </div>

      {/* Personal Info */}
      <Card>
        <CardHeader><CardTitle className="text-base"><div className="flex items-center gap-2"><UserIcon className="h-4 w-4" />Personal Information</div></CardTitle></CardHeader>
        <CardContent>
          {isEditing ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Date of Birth</Label>
                <Input type="date" value={f("dateOfBirth")} onChange={e => sf("dateOfBirth", e.target.value)} data-testid="input-dob" />
              </div>
              <div className="space-y-1">
                <Label>Nationality</Label>
                <Input value={f("nationality")} onChange={e => sf("nationality", e.target.value)} data-testid="input-nationality" />
              </div>
              <div className="space-y-1">
                <Label>NI Number</Label>
                <Input value={f("niNumber")} onChange={e => sf("niNumber", e.target.value)} data-testid="input-ni-number" />
              </div>
              <div className="space-y-1">
                <Label>Personal Phone</Label>
                <Input value={f("personalPhone")} onChange={e => sf("personalPhone", e.target.value)} data-testid="input-personal-phone" />
              </div>
              <div className="space-y-1">
                <Label>Personal Email</Label>
                <Input value={f("personalEmail")} onChange={e => sf("personalEmail", e.target.value)} data-testid="input-personal-email" />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Home Address</Label>
                <Textarea value={f("homeAddress")} onChange={e => sf("homeAddress", e.target.value)} rows={2} data-testid="input-home-address" />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <FieldRow label="Date of Birth" value={p?.dateOfBirth ? format(new Date(p.dateOfBirth), "dd MMM yyyy") : null} />
              <FieldRow label="Nationality" value={p?.nationality} />
              <FieldRow label="NI Number" value={p?.niNumber} />
              <FieldRow label="Personal Phone" value={p?.personalPhone} />
              <FieldRow label="Personal Email" value={p?.personalEmail} />
              <FieldRow label="Work Email" value={emp.email} />
              <div className="col-span-2 sm:col-span-3"><FieldRow label="Home Address" value={p?.homeAddress} /></div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Employment */}
      <Card>
        <CardHeader><CardTitle className="text-base"><div className="flex items-center gap-2"><Briefcase className="h-4 w-4" />Employment</div></CardTitle></CardHeader>
        <CardContent>
          {isEditing ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Employment Status</Label>
                <Select value={f("employmentStatus")} onValueChange={v => sf("employmentStatus", v)}>
                  <SelectTrigger data-testid="select-employment-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="on_leave">On Leave</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Employment Type</Label>
                <Select value={f("employmentType")} onValueChange={v => sf("employmentType", v)}>
                  <SelectTrigger data-testid="select-employment-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full_time">Full Time</SelectItem>
                    <SelectItem value="part_time">Part Time</SelectItem>
                    <SelectItem value="contractor">Contractor</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Start Date</Label>
                <Input type="date" value={f("startDate")} onChange={e => sf("startDate", e.target.value)} data-testid="input-start-date" />
              </div>
              <div className="space-y-1">
                <Label>End Date</Label>
                <Input type="date" value={f("endDate")} onChange={e => sf("endDate", e.target.value)} data-testid="input-end-date" />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <FieldRow label="Status" value={EMPLOYMENT_STATUS_LABELS[p?.employmentStatus || "active"]} />
              <FieldRow label="Employment Type" value={EMPLOYMENT_TYPE_LABELS[p?.employmentType || "full_time"]} />
              <FieldRow label="Role / Type" value={ROLE_LABELS[emp.role] || emp.role} />
              <FieldRow label="Start Date" value={p?.startDate ? format(new Date(p.startDate), "dd MMM yyyy") : null} />
              <FieldRow label="End Date" value={p?.endDate ? format(new Date(p.endDate), "dd MMM yyyy") : null} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Emergency Contact */}
      <Card>
        <CardHeader><CardTitle className="text-base"><div className="flex items-center gap-2"><Phone className="h-4 w-4" />Emergency Contact</div></CardTitle></CardHeader>
        <CardContent>
          {isEditing ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Contact Name</Label>
                <Input value={f("emergencyContactName")} onChange={e => sf("emergencyContactName", e.target.value)} data-testid="input-ec-name" />
              </div>
              <div className="space-y-1">
                <Label>Phone</Label>
                <Input value={f("emergencyContactPhone")} onChange={e => sf("emergencyContactPhone", e.target.value)} data-testid="input-ec-phone" />
              </div>
              <div className="space-y-1">
                <Label>Relationship</Label>
                <Input value={f("emergencyContactRelationship")} onChange={e => sf("emergencyContactRelationship", e.target.value)} data-testid="input-ec-relation" />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <FieldRow label="Name" value={p?.emergencyContactName} />
              <FieldRow label="Phone" value={p?.emergencyContactPhone} />
              <FieldRow label="Relationship" value={p?.emergencyContactRelationship} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Licences & Certificates */}
      <Card>
        <CardHeader><CardTitle className="text-base"><div className="flex items-center gap-2"><Shield className="h-4 w-4" />Licences &amp; Certificates</div></CardTitle></CardHeader>
        <CardContent>
          {isEditing ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>SIA Number</Label>
                <Input value={emp.siaNumber || ""} disabled className="opacity-60" title="Edit via Employees tab" />
              </div>
              <div className="space-y-1">
                <Label>SIA Expiry</Label>
                <Input value={emp.siaExpiryDate ? format(new Date(emp.siaExpiryDate), "yyyy-MM-dd") : ""} disabled className="opacity-60" title="Edit via Employees tab" />
              </div>
              <div className="space-y-1">
                <Label>First Aid Certificate</Label>
                <Input value={f("firstAidCert")} onChange={e => sf("firstAidCert", e.target.value)} data-testid="input-first-aid-cert" />
              </div>
              <div className="space-y-1">
                <Label>First Aid Expiry</Label>
                <Input type="date" value={f("firstAidExpiry")} onChange={e => sf("firstAidExpiry", e.target.value)} data-testid="input-first-aid-expiry" />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <FieldRow label="SIA Number" value={emp.siaNumber} />
              <FieldRow label="SIA Expiry" value={emp.siaExpiryDate ? format(new Date(emp.siaExpiryDate), "dd MMM yyyy") : null} />
              <FieldRow label="Steward ID" value={emp.stewardId} />
              <FieldRow label="First Aid Cert" value={p?.firstAidCert} />
              <FieldRow label="First Aid Expiry" value={p?.firstAidExpiry ? format(new Date(p.firstAidExpiry), "dd MMM yyyy") : null} />
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-4">SIA details are managed via the Employees tab.</p>
        </CardContent>
      </Card>

      {/* Admin Notes */}
      <Card>
        <CardHeader><CardTitle className="text-base"><div className="flex items-center gap-2"><StickyNote className="h-4 w-4" />Admin Notes</div></CardTitle></CardHeader>
        <CardContent>
          {isEditing ? (
            <Textarea
              value={f("adminNotes")}
              onChange={e => sf("adminNotes", e.target.value)}
              rows={4}
              placeholder="Private notes visible to admins only…"
              data-testid="input-admin-notes"
            />
          ) : (
            <p className="text-sm whitespace-pre-wrap">
              {p?.adminNotes || <span className="text-muted-foreground italic">No notes recorded</span>}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

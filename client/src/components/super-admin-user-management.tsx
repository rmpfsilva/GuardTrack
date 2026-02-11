import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Search, 
  Users, 
  Shield, 
  Building2, 
  Mail, 
  Calendar,
  UserCog,
  Check,
  X,
  RefreshCw,
  Eye,
  Key,
  AlertTriangle,
  Wrench,
  Trash2,
  Copy,
  CheckCircle2,
  UserX,
  UserCheck
} from "lucide-react";
import { format } from "date-fns";

const VALID_ROLES = ['guard', 'steward', 'supervisor', 'admin', 'super_admin'] as const;
type RoleType = typeof VALID_ROLES[number];

const ROLE_LABELS: Record<RoleType, string> = {
  guard: 'Guard',
  steward: 'Steward',
  supervisor: 'Supervisor',
  admin: 'Company Admin',
  super_admin: 'Super Admin'
};

const ROLE_COLORS: Record<RoleType, string> = {
  guard: 'bg-blue-500/20 text-blue-700 dark:text-blue-300',
  steward: 'bg-purple-500/20 text-purple-700 dark:text-purple-300',
  supervisor: 'bg-orange-500/20 text-orange-700 dark:text-orange-300',
  admin: 'bg-green-500/20 text-green-700 dark:text-green-300',
  super_admin: 'bg-red-500/20 text-red-700 dark:text-red-300'
};

interface UserWithDetails {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  username: string;
  role: string;
  roles: string[];
  expectedRole: string;
  hasRoleMismatch: boolean;
  companyId: string | null;
  companyName?: string;
  isActive: boolean;
  createdAt: string | null;
}

interface Company {
  id: string;
  name: string;
}

export default function SuperAdminUserManagement() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<UserWithDetails | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [isResetPasswordDialogOpen, setIsResetPasswordDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [resetPasswordResult, setResetPasswordResult] = useState<{ username: string; password: string } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [showIssuesOnly, setShowIssuesOnly] = useState(false);

  const { data: users = [], isLoading: isLoadingUsers, refetch: refetchUsers } = useQuery<UserWithDetails[]>({
    queryKey: ["/api/super-admin/all-users"],
  });

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ["/api/super-admin/companies-list"],
  });

  const updateRolesMutation = useMutation({
    mutationFn: async ({ userId, roles }: { userId: string; roles: string[] }) => {
      return apiRequest("PUT", `/api/super-admin/users/${userId}/roles`, { roles });
    },
    onSuccess: () => {
      toast({
        title: "Roles Updated",
        description: "User roles have been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/all-users"] });
      setIsRoleDialogOpen(false);
      setSelectedUser(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update user roles.",
        variant: "destructive",
      });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, password, username }: { userId: string; password: string; username: string }) => {
      await apiRequest("POST", `/api/super-admin/users/${userId}/reset-password`, { password });
      return { username, password };
    },
    onSuccess: (result) => {
      toast({
        title: "Password Reset",
        description: "Password has been reset. Credentials are shown below - copy them now.",
      });
      setResetPasswordResult(result);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reset password.",
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("DELETE", `/api/admin/users/${userId}`);
    },
    onSuccess: () => {
      toast({
        title: "Account Deleted",
        description: "The user account has been permanently deleted.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/all-users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/clients"] });
      setIsDeleteDialogOpen(false);
      setDeleteConfirmText("");
      setSelectedUser(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete user.",
        variant: "destructive",
      });
    },
  });

  const fixRoleMutation = useMutation({
    mutationFn: async ({ userId, previousRole }: { userId: string; previousRole: string }) => {
      return apiRequest("POST", `/api/super-admin/users/${userId}/fix-role`, { previousRole });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Role Fixed",
        description: `User role updated from ${ROLE_LABELS[data.previousRole as RoleType] || data.previousRole} to ${ROLE_LABELS[data.newRole as RoleType] || data.newRole}.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/all-users"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to fix role.",
        variant: "destructive",
      });
    },
  });

  const filteredUsers = users.filter((user) => {
    const matchesSearch = 
      searchQuery === "" ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.id.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCompany = 
      companyFilter === "all" || 
      (companyFilter === "no-company" && !user.companyId) ||
      user.companyId === companyFilter;

    const matchesRole = 
      roleFilter === "all" || 
      user.role === roleFilter ||
      user.roles?.includes(roleFilter);

    const matchesIssuesFilter = !showIssuesOnly || user.hasRoleMismatch;

    return matchesSearch && matchesCompany && matchesRole && matchesIssuesFilter;
  });

  // Count users with role issues
  const usersWithIssues = users.filter(u => u.hasRoleMismatch);
  const issueCount = usersWithIssues.length;

  const handleOpenRoleDialog = (user: UserWithDetails) => {
    setSelectedUser(user);
    setSelectedRoles(user.roles?.length > 0 ? user.roles : [user.role]);
    setIsRoleDialogOpen(true);
  };

  const handleOpenResetPasswordDialog = (user: UserWithDetails) => {
    setSelectedUser(user);
    setNewPassword("");
    setResetPasswordResult(null);
    setIsResetPasswordDialogOpen(true);
  };

  const handleOpenDeleteDialog = (user: UserWithDetails) => {
    setSelectedUser(user);
    setDeleteConfirmText("");
    setIsDeleteDialogOpen(true);
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    });
  };

  const handleViewDetails = (user: UserWithDetails) => {
    setSelectedUser(user);
    setIsDetailsDialogOpen(true);
  };

  const toggleRole = (role: string) => {
    if (selectedRoles.includes(role)) {
      if (selectedRoles.length > 1) {
        setSelectedRoles(selectedRoles.filter(r => r !== role));
      }
    } else {
      setSelectedRoles([...selectedRoles, role]);
    }
  };

  const handleSaveRoles = () => {
    if (selectedUser && selectedRoles.length > 0) {
      updateRolesMutation.mutate({ userId: selectedUser.id, roles: selectedRoles });
    }
  };

  const handleResetPassword = () => {
    if (selectedUser && newPassword.length >= 6) {
      resetPasswordMutation.mutate({ userId: selectedUser.id, password: newPassword, username: selectedUser.username });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                All Platform Users
              </CardTitle>
              <CardDescription>
                Search and manage users across all companies. Change roles and permissions.
              </CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => refetchUsers()}
              data-testid="button-refresh-users"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by email, name, username, or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-users"
              />
            </div>
            <Select value={companyFilter} onValueChange={setCompanyFilter}>
              <SelectTrigger className="w-full sm:w-[200px]" data-testid="select-company-filter">
                <SelectValue placeholder="Filter by company" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Companies</SelectItem>
                <SelectItem value="no-company">No Company (Super Admins)</SelectItem>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-role-filter">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {VALID_ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Role Issues Alert Banner */}
          {issueCount > 0 && (
            <div className="flex items-center justify-between p-3 rounded-md bg-amber-500/10 border border-amber-500/30">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="font-medium text-amber-700 dark:text-amber-400">
                    {issueCount} user{issueCount !== 1 ? 's' : ''} with role issues detected
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-500">
                    These users have mismatched legacy role fields that may cause access problems.
                  </p>
                </div>
              </div>
              <Button
                variant={showIssuesOnly ? "default" : "outline"}
                size="sm"
                onClick={() => setShowIssuesOnly(!showIssuesOnly)}
                data-testid="button-toggle-issues-filter"
              >
                {showIssuesOnly ? "Show All" : "Show Issues Only"}
              </Button>
            </div>
          )}

          <div className="text-sm text-muted-foreground">
            Showing {filteredUsers.length} of {users.length} users
            {showIssuesOnly && ` (filtered to ${issueCount} with issues)`}
          </div>

          {isLoadingUsers ? (
            <div className="text-center py-8 text-muted-foreground">Loading users...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No users found matching your criteria.
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Role(s)</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id} data-testid={`user-row-${user.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback>
                              {user.firstName?.[0]}{user.lastName?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">
                              {user.firstName || ''} {user.lastName || ''}
                            </p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.companyName ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Building2 className="h-3 w-3" />
                            {user.companyName}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Platform Admin</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(user.roles?.length > 0 ? user.roles : [user.role]).map((role) => (
                            <Badge 
                              key={role} 
                              className={`text-xs ${ROLE_COLORS[role as RoleType] || 'bg-gray-500/20'}`}
                            >
                              {ROLE_LABELS[role as RoleType] || role}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant={user.isActive !== false ? "default" : "secondary"}>
                            {user.isActive !== false ? "Active" : "Inactive"}
                          </Badge>
                          {user.hasRoleMismatch && (
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Role Issue
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {user.hasRoleMismatch && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => fixRoleMutation.mutate({ userId: user.id, previousRole: user.role })}
                              disabled={fixRoleMutation.isPending}
                              className="text-amber-700 border-amber-500/50 hover:bg-amber-500/10"
                              title={`Fix: Change from ${ROLE_LABELS[user.role as RoleType] || user.role} to ${ROLE_LABELS[user.expectedRole as RoleType] || user.expectedRole}`}
                              data-testid={`button-fix-role-${user.id}`}
                            >
                              <Wrench className="h-3 w-3 mr-1" />
                              Fix Role
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleViewDetails(user)}
                            title="View Details"
                            data-testid={`button-view-user-${user.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenRoleDialog(user)}
                            title="Change Roles"
                            data-testid={`button-edit-roles-${user.id}`}
                          >
                            <Shield className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenResetPasswordDialog(user)}
                            title="Reset Password"
                            data-testid={`button-reset-password-${user.id}`}
                          >
                            <Key className="h-4 w-4" />
                          </Button>
                          {user.role !== 'super_admin' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenDeleteDialog(user)}
                              title="Delete Account"
                              data-testid={`button-delete-user-${user.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5" />
              User Details
            </DialogTitle>
            <DialogDescription>
              Complete information for {selectedUser?.firstName} {selectedUser?.lastName}
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="text-xl">
                    {selectedUser.firstName?.[0]}{selectedUser.lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold text-lg">
                    {selectedUser.firstName} {selectedUser.lastName}
                  </h3>
                  <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">User ID</Label>
                  <p className="font-mono text-xs break-all">{selectedUser.id}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Username</Label>
                  <p>{selectedUser.username}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Company</Label>
                  <p>{selectedUser.companyName || 'Platform Admin (No Company)'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <Badge variant={selectedUser.isActive !== false ? "default" : "secondary"}>
                    {selectedUser.isActive !== false ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground">Created</Label>
                  <p>{selectedUser.createdAt ? format(new Date(selectedUser.createdAt), 'PPp') : 'Unknown'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Email</Label>
                  <p>{selectedUser.email || 'Not set'}</p>
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground">Current Roles</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {(selectedUser.roles?.length > 0 ? selectedUser.roles : [selectedUser.role]).map((role) => (
                    <Badge 
                      key={role} 
                      className={ROLE_COLORS[role as RoleType] || 'bg-gray-500/20'}
                    >
                      {ROLE_LABELS[role as RoleType] || role}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Role Mismatch Warning */}
              {selectedUser.hasRoleMismatch && (
                <div className="p-3 rounded-md bg-amber-500/10 border border-amber-500/30">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-amber-700 dark:text-amber-400">
                        Role Mismatch Detected
                      </p>
                      <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                        Legacy role field shows <strong>{ROLE_LABELS[selectedUser.role as RoleType] || selectedUser.role}</strong>, 
                        but should be <strong>{ROLE_LABELS[selectedUser.expectedRole as RoleType] || selectedUser.expectedRole}</strong> based on assigned roles.
                        This may cause the user to see the wrong dashboard or have incorrect permissions.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 text-amber-700 border-amber-500/50 hover:bg-amber-500/10"
                        onClick={() => {
                          fixRoleMutation.mutate({ userId: selectedUser.id, previousRole: selectedUser.role });
                          setIsDetailsDialogOpen(false);
                        }}
                        disabled={fixRoleMutation.isPending}
                        data-testid="button-fix-role-detail"
                      >
                        <Wrench className="h-3 w-3 mr-1" />
                        Fix Role Now
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2 flex-wrap">
            <Button
              variant="outline"
              onClick={() => {
                setIsDetailsDialogOpen(false);
                if (selectedUser) handleOpenRoleDialog(selectedUser);
              }}
              data-testid="button-change-roles-from-details"
            >
              <Shield className="h-4 w-4 mr-2" />
              Change Roles
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setIsDetailsDialogOpen(false);
                if (selectedUser) handleOpenResetPasswordDialog(selectedUser);
              }}
              data-testid="button-reset-password-from-details"
            >
              <Key className="h-4 w-4 mr-2" />
              Reset Password
            </Button>
            {selectedUser && selectedUser.role !== 'super_admin' && (
              <Button
                variant="destructive"
                onClick={() => {
                  setIsDetailsDialogOpen(false);
                  if (selectedUser) handleOpenDeleteDialog(selectedUser);
                }}
                data-testid="button-delete-from-details"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Account
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Change User Roles
            </DialogTitle>
            <DialogDescription>
              Update roles for {selectedUser?.firstName} {selectedUser?.lastName} ({selectedUser?.email})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Select Roles (at least one required)</Label>
              <div className="grid grid-cols-1 gap-2 mt-2">
                {VALID_ROLES.map((role) => (
                  <div
                    key={role}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedRoles.includes(role) 
                        ? 'border-primary bg-primary/10' 
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => toggleRole(role)}
                    data-testid={`role-option-${role}`}
                  >
                    <div className="flex items-center gap-3">
                      <Badge className={ROLE_COLORS[role]}>
                        {ROLE_LABELS[role]}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {role === 'guard' && 'Basic guard access - clock in/out, view schedule'}
                        {role === 'steward' && 'Senior guard role with steward-specific access'}
                        {role === 'supervisor' && 'Site supervisor with some admin features'}
                        {role === 'admin' && 'Full company access - manage users, sites, reports'}
                        {role === 'super_admin' && 'Platform owner - access everything'}
                      </span>
                    </div>
                    <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                      selectedRoles.includes(role) 
                        ? 'border-primary bg-primary text-primary-foreground' 
                        : 'border-muted-foreground'
                    }`}>
                      {selectedRoles.includes(role) && <Check className="h-3 w-3" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRoleDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveRoles}
              disabled={selectedRoles.length === 0 || updateRolesMutation.isPending}
              data-testid="button-save-roles"
            >
              {updateRolesMutation.isPending ? "Saving..." : "Save Roles"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isResetPasswordDialogOpen} onOpenChange={(open) => {
        setIsResetPasswordDialogOpen(open);
        if (!open) {
          setResetPasswordResult(null);
          setNewPassword("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Reset Password
            </DialogTitle>
            <DialogDescription>
              Set a new password for {selectedUser?.firstName} {selectedUser?.lastName} ({selectedUser?.username})
            </DialogDescription>
          </DialogHeader>

          {resetPasswordResult ? (
            <div className="space-y-4">
              <div className="p-4 rounded-md border border-green-500/50 bg-green-500/5">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <p className="font-medium text-green-600">Password Reset Successfully</p>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Share these credentials with the user. Copy them now before closing.
                </p>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium">Username</p>
                    <div className="flex items-center gap-2">
                      <code className="text-sm bg-muted px-2 py-1 rounded font-mono flex-1" data-testid="text-reset-username">
                        {resetPasswordResult.username}
                      </code>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(resetPasswordResult.username, 'reset-username')}
                        data-testid="button-copy-reset-username"
                      >
                        {copiedField === 'reset-username' ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium">New Password</p>
                    <div className="flex items-center gap-2">
                      <code className="text-sm bg-muted px-2 py-1 rounded font-mono flex-1" data-testid="text-reset-password">
                        {resetPasswordResult.password}
                      </code>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(resetPasswordResult.password, 'reset-password')}
                        data-testid="button-copy-reset-password"
                      >
                        {copiedField === 'reset-password' ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const text = `Username: ${resetPasswordResult.username}\nNew Password: ${resetPasswordResult.password}`;
                      copyToClipboard(text, 'reset-all');
                    }}
                    data-testid="button-copy-reset-all"
                  >
                    {copiedField === 'reset-all' ? <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" /> : <Copy className="h-4 w-4 mr-2" />}
                    {copiedField === 'reset-all' ? 'Copied!' : 'Copy All'}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min 6 characters)"
                  data-testid="input-new-password"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Password must be at least 6 characters long. The password will be shown in plain text after reset so you can share it.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsResetPasswordDialogOpen(false);
              setResetPasswordResult(null);
              setNewPassword("");
            }}>
              {resetPasswordResult ? "Close" : "Cancel"}
            </Button>
            {!resetPasswordResult && (
              <Button 
                onClick={handleResetPassword}
                disabled={newPassword.length < 6 || resetPasswordMutation.isPending}
                data-testid="button-confirm-reset-password"
              >
                {resetPasswordMutation.isPending ? "Resetting..." : "Reset Password"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete User Account
            </DialogTitle>
            <DialogDescription>
              This will permanently delete the account for <strong>{selectedUser?.firstName} {selectedUser?.lastName}</strong> ({selectedUser?.username}). 
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-md bg-destructive/10 border border-destructive/30">
              <p className="text-sm">
                Type <strong>DELETE</strong> to confirm you want to permanently remove this account and all associated data.
              </p>
            </div>
            <div>
              <Label htmlFor="delete-confirm">Confirmation</Label>
              <Input
                id="delete-confirm"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type DELETE to confirm"
                data-testid="input-delete-confirm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={() => selectedUser && deleteUserMutation.mutate(selectedUser.id)}
              disabled={deleteConfirmText !== "DELETE" || deleteUserMutation.isPending}
              data-testid="button-confirm-delete-user"
            >
              {deleteUserMutation.isPending ? "Deleting..." : "Delete Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

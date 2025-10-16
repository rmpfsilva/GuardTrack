import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User, Company } from "@shared/schema";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Pencil, Trash2, Shield, User as UserIcon, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function UserManagement() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    id: "",
    email: "",
    firstName: "",
    lastName: "",
    role: "guard",
    companyId: "",
  });

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['/api/admin/users'],
  });

  // Fetch all companies (for super admins only)
  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ['/api/companies'],
    enabled: currentUser?.role === 'super_admin',
  });
  
  // Fetch individual companies for display (for regular admins)
  // Memoize user company IDs to prevent re-renders
  const userCompanyIds = useMemo(
    () => [...new Set(users.map(u => u.companyId).filter(Boolean))] as string[],
    [users]
  );
  
  const { data: userCompanies = [] } = useQuery<Company[]>({
    queryKey: ['/api/user-companies', ...userCompanyIds],
    queryFn: async () => {
      const results = await Promise.all(
        userCompanyIds.map(async (id) => {
          const res = await fetch(`/api/companies/${id}`, { credentials: 'include' });
          if (!res.ok) return null;
          return res.json();
        })
      );
      return results.filter(Boolean) as Company[];
    },
    enabled: currentUser?.role !== 'super_admin' && userCompanyIds.length > 0,
  });
  
  // Combine company lists for display
  const allCompanies = currentUser?.role === 'super_admin' ? companies : userCompanies;
  
  // Helper to get company name by ID
  const getCompanyName = (companyId: string | null) => {
    if (!companyId) return null;
    const company = allCompanies.find(c => c.id === companyId);
    return company?.name || null;
  };

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      return apiRequest("PATCH", `/api/admin/users/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/guards'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
      setIsEditDialogOpen(false);
      setSelectedUser(null);
      resetForm();
      toast({
        title: "User updated",
        description: "User information has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update user",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/users/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/guards'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/stats'] });
      toast({
        title: "User deleted",
        description: "User has been removed from the system.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete user",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      id: "",
      email: "",
      firstName: "",
      lastName: "",
      role: "guard",
      companyId: "",
    });
  };

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setFormData({
      id: user.id,
      email: user.email || "",
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      role: user.role,
      companyId: user.companyId || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdate = () => {
    if (!selectedUser) return;
    const updateData: any = {
      email: formData.email,
      firstName: formData.firstName,
      lastName: formData.lastName,
      role: formData.role,
    };
    
    // Only super admins can change company assignment
    if (currentUser?.role === 'super_admin') {
      // Allow clearing companyId by setting to null if empty string
      updateData.companyId = formData.companyId || null;
    }
    
    updateUserMutation.mutate({
      id: selectedUser.id,
      data: updateData,
    });
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
      deleteUserMutation.mutate(id);
    }
  };

  if (isLoading) {
    return <div className="p-6">Loading users...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">User Management</h2>
        <p className="text-muted-foreground">Manage guard and admin accounts</p>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>How User Management Works</AlertTitle>
        <AlertDescription>
          Users are automatically created when they log in for the first time via Replit Auth (Google, GitHub, or Email).
          New users are assigned the "Guard" role by default. You can then change their role to Admin, update their information,
          or remove them from the system.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4">
        {users.map((user) => (
          <Card key={user.id} data-testid={`card-user-${user.id}`}>
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
              <div className="flex items-center gap-4">
                <Avatar>
                  <AvatarImage src={user.profileImageUrl || undefined} />
                  <AvatarFallback>
                    {user.firstName?.[0]}{user.lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-lg">
                    {user.firstName} {user.lastName}
                  </CardTitle>
                  <CardDescription>{user.email}</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={user.role === 'admin' || user.role === 'super_admin' ? 'default' : 'secondary'} data-testid={`badge-role-${user.id}`}>
                  {user.role === 'admin' || user.role === 'super_admin' ? (
                    <>
                      <Shield className="mr-1 h-3 w-3" />
                      {user.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                    </>
                  ) : (
                    <>
                      <UserIcon className="mr-1 h-3 w-3" />
                      {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    </>
                  )}
                </Badge>
                {getCompanyName(user.companyId) && (
                  <Badge variant="outline" className="text-xs" data-testid={`badge-company-${user.id}`}>
                    {getCompanyName(user.companyId)}
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleEdit(user)}
                  data-testid={`button-edit-user-${user.id}`}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(user.id)}
                  data-testid={`button-delete-user-${user.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
          </Card>
        ))}
        {users.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <UserIcon className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No users have logged in yet. Share the app URL with your guards so they can sign up.</p>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent data-testid="dialog-edit-user">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information and role.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                data-testid="input-edit-user-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-firstName">First Name</Label>
              <Input
                id="edit-firstName"
                data-testid="input-edit-user-firstname"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-lastName">Last Name</Label>
              <Input
                id="edit-lastName"
                data-testid="input-edit-user-lastname"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">Role</Label>
              <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                <SelectTrigger id="edit-role" data-testid="select-edit-user-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="guard">Guard</SelectItem>
                  <SelectItem value="steward">Steward</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  {currentUser?.role === 'super_admin' && (
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            {currentUser?.role === 'super_admin' && (
              <div className="space-y-2">
                <Label htmlFor="edit-company">Company</Label>
                <Select value={formData.companyId || "none"} onValueChange={(value) => setFormData({ ...formData, companyId: value === "none" ? "" : value })}>
                  <SelectTrigger id="edit-company" data-testid="select-edit-user-company">
                    <SelectValue placeholder="Select company (or leave empty)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Company</SelectItem>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsEditDialogOpen(false);
                setSelectedUser(null);
                resetForm();
              }}
              data-testid="button-cancel-edit-user"
            >
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={updateUserMutation.isPending} data-testid="button-update-user">
              {updateUserMutation.isPending ? "Updating..." : "Update User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

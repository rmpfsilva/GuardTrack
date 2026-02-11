import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { UserPlus, Copy, CheckCircle2, X } from "lucide-react";

const createUserSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email("Invalid email").or(z.literal("")).optional(),
  phone: z.string().optional(),
  role: z.enum(["guard", "steward", "supervisor", "admin"]),
  companyId: z.string().min(1, "Company is required"),
  jobTitle: z.string().optional(),
});

type CreateUserFormData = z.infer<typeof createUserSchema>;

interface CreatedCredentials {
  username: string;
  password: string;
  companyName: string;
  role: string;
  firstName?: string;
  lastName?: string;
}

export default function SuperAdminCreateUser() {
  const { toast } = useToast();
  const [createdCredentials, setCreatedCredentials] = useState<CreatedCredentials | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    });
  };

  const form = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      username: "",
      password: "",
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      role: "guard",
      companyId: "",
      jobTitle: "",
    },
  });

  const { data: companies = [] } = useQuery<any[]>({
    queryKey: ["/api/super-admin/clients"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateUserFormData) => {
      const payload = { ...data };
      if (!payload.email) delete (payload as any).email;
      if (!payload.phone) delete (payload as any).phone;
      if (!payload.jobTitle) delete (payload as any).jobTitle;
      if (!payload.firstName) delete (payload as any).firstName;
      if (!payload.lastName) delete (payload as any).lastName;
      const res = await apiRequest("POST", "/api/super-admin/users", payload);
      return { user: await res.json(), originalData: data };
    },
    onSuccess: ({ user, originalData }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/all-users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/employees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });

      const company = companies.find((c: any) => c.id === originalData.companyId);
      setCreatedCredentials({
        username: originalData.username,
        password: originalData.password,
        companyName: company?.name || 'Unknown',
        role: originalData.role,
        firstName: originalData.firstName,
        lastName: originalData.lastName,
      });

      toast({
        title: "User created successfully",
        description: "Credentials are displayed below. Make sure to copy them before creating another user.",
      });
      form.reset();
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) return;
      toast({
        title: "Error",
        description: error.message || "Failed to create user",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: CreateUserFormData) => {
    createMutation.mutate(data);
  };

  return (
    <div className="space-y-4">
      {createdCredentials && (
        <Card className="border-green-500/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                User Created - Login Credentials
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCreatedCredentials(null)}
                data-testid="button-dismiss-credentials"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <CardDescription>
              Share these credentials with the user. This is the only time the password will be visible.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">Company</p>
                  <p className="text-sm font-medium" data-testid="text-created-company">{createdCredentials.companyName}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">Role</p>
                  <Badge variant="outline" data-testid="text-created-role">{createdCredentials.role}</Badge>
                </div>
              </div>
              {(createdCredentials.firstName || createdCredentials.lastName) && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">Name</p>
                  <p className="text-sm" data-testid="text-created-name">
                    {createdCredentials.firstName} {createdCredentials.lastName}
                  </p>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">Username</p>
                  <div className="flex items-center gap-2">
                    <code className="text-sm bg-muted px-2 py-1 rounded font-mono flex-1" data-testid="text-created-username">
                      {createdCredentials.username}
                    </code>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(createdCredentials.username, 'username')}
                      data-testid="button-copy-username"
                    >
                      {copiedField === 'username' ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">Password</p>
                  <div className="flex items-center gap-2">
                    <code className="text-sm bg-muted px-2 py-1 rounded font-mono flex-1" data-testid="text-created-password">
                      {createdCredentials.password}
                    </code>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(createdCredentials.password, 'password')}
                      data-testid="button-copy-password"
                    >
                      {copiedField === 'password' ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const text = `Company: ${createdCredentials.companyName}\nUsername: ${createdCredentials.username}\nPassword: ${createdCredentials.password}\nRole: ${createdCredentials.role}`;
                  copyToClipboard(text, 'all');
                }}
                data-testid="button-copy-all-credentials"
              >
                {copiedField === 'all' ? <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" /> : <Copy className="h-4 w-4 mr-2" />}
                {copiedField === 'all' ? 'Copied!' : 'Copy All Credentials'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Create User
        </CardTitle>
        <CardDescription>
          Directly create a new user account for any company without sending an invitation.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="companyId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-create-user-company">
                        <SelectValue placeholder="Select a company" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {companies.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} ({c.companyId})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="username" data-testid="input-create-user-username" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input {...field} type="password" placeholder="Min 6 characters" data-testid="input-create-user-password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="First name" data-testid="input-create-user-firstname" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Last name" data-testid="input-create-user-lastname" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email (Optional)</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" placeholder="user@example.com" data-testid="input-create-user-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone (Optional)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="+44..." data-testid="input-create-user-phone" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-create-user-role">
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="guard">Guard</SelectItem>
                        <SelectItem value="steward">Steward</SelectItem>
                        <SelectItem value="supervisor">Supervisor</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="jobTitle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Job Title (Optional)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g. SIA Guard" data-testid="input-create-user-jobtitle" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button
              type="submit"
              disabled={createMutation.isPending}
              data-testid="button-create-user-submit"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              {createMutation.isPending ? "Creating..." : "Create User"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
    </div>
  );
}

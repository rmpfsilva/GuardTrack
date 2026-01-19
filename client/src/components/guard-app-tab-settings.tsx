import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  GripVertical, 
  Plus, 
  Pencil, 
  Trash2, 
  Check, 
  X, 
  LayoutGrid,
  Home,
  Calendar,
  FileText,
  Bell,
  Settings,
  User,
  Shield,
  Clock,
  MapPin,
  Briefcase
} from "lucide-react";
import type { GuardAppTab } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const iconOptions = [
  { value: "Home", label: "Home", icon: Home },
  { value: "Calendar", label: "Calendar", icon: Calendar },
  { value: "FileText", label: "File/Document", icon: FileText },
  { value: "Bell", label: "Notifications", icon: Bell },
  { value: "Settings", label: "Settings", icon: Settings },
  { value: "User", label: "User/Profile", icon: User },
  { value: "Shield", label: "Shield/Security", icon: Shield },
  { value: "Clock", label: "Clock/Time", icon: Clock },
  { value: "MapPin", label: "Location", icon: MapPin },
  { value: "Briefcase", label: "Briefcase/Work", icon: Briefcase },
];

const featureGateOptions = [
  { value: "", label: "No restriction" },
  { value: "shiftScheduling", label: "Shift Scheduling" },
  { value: "leaveRequests", label: "Leave Requests" },
  { value: "noticeBoard", label: "Notice Board" },
  { value: "checkInOut", label: "Check In/Out" },
  { value: "dashboardAccess", label: "Dashboard Access" },
];

const roleOptions = [
  { value: "guard", label: "Guard" },
  { value: "steward", label: "Steward" },
  { value: "supervisor", label: "Supervisor" },
];

const tabFormSchema = z.object({
  tabKey: z.string().min(1, "Tab key is required"),
  label: z.string().min(1, "Label is required"),
  icon: z.string().min(1, "Please select an icon"),
  isActive: z.boolean(),
  featureGate: z.string().nullable().optional(),
  roleVisibility: z.array(z.string()).min(1, "Select at least one role"),
});

type TabFormValues = z.infer<typeof tabFormSchema>;

function getIconComponent(iconName: string) {
  const iconOption = iconOptions.find(opt => opt.value === iconName);
  if (iconOption) {
    const IconComponent = iconOption.icon;
    return <IconComponent className="h-4 w-4" />;
  }
  return <LayoutGrid className="h-4 w-4" />;
}

export default function GuardAppTabSettings() {
  const { toast } = useToast();
  const [editingTab, setEditingTab] = useState<GuardAppTab | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);

  const { data: tabs = [], isLoading } = useQuery<GuardAppTab[]>({
    queryKey: ['/api/guard-app-tabs'],
  });

  const form = useForm<TabFormValues>({
    resolver: zodResolver(tabFormSchema),
    defaultValues: {
      tabKey: "",
      label: "",
      icon: "Home",
      isActive: true,
      featureGate: null,
      roleVisibility: ["guard", "steward", "supervisor"],
    },
  });

  const createTabMutation = useMutation({
    mutationFn: async (data: TabFormValues) => {
      const sortOrder = String(tabs.length);
      return await apiRequest("POST", "/api/guard-app-tabs", {
        ...data,
        sortOrder,
        isDefault: false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/guard-app-tabs'] });
      toast({ title: "Tab created", description: "New tab has been added successfully" });
      setIsAddDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create tab", variant: "destructive" });
    },
  });

  const updateTabMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TabFormValues> }) => {
      return await apiRequest("PATCH", `/api/guard-app-tabs/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/guard-app-tabs'] });
      toast({ title: "Tab updated", description: "Tab has been updated successfully" });
      setEditingTab(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update tab", variant: "destructive" });
    },
  });

  const deleteTabMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/guard-app-tabs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/guard-app-tabs'] });
      toast({ title: "Tab deleted", description: "Tab has been removed" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete tab", variant: "destructive" });
    },
  });

  const reorderTabsMutation = useMutation({
    mutationFn: async (reorderedTabs: { id: string; sortOrder: string }[]) => {
      return await apiRequest("PATCH", "/api/guard-app-tabs/reorder", { tabs: reorderedTabs });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/guard-app-tabs'] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to reorder tabs", variant: "destructive" });
    },
  });

  const handleDragStart = (tabId: string) => {
    setDraggedTabId(tabId);
  };

  const handleDragOver = (e: React.DragEvent, targetTabId: string) => {
    e.preventDefault();
    if (!draggedTabId || draggedTabId === targetTabId) return;
  };

  const handleDrop = (e: React.DragEvent, targetTabId: string) => {
    e.preventDefault();
    if (!draggedTabId || draggedTabId === targetTabId) return;

    const sortedTabs = [...tabs].sort((a, b) => parseInt(a.sortOrder) - parseInt(b.sortOrder));
    const draggedIndex = sortedTabs.findIndex(t => t.id === draggedTabId);
    const targetIndex = sortedTabs.findIndex(t => t.id === targetTabId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const [removed] = sortedTabs.splice(draggedIndex, 1);
    sortedTabs.splice(targetIndex, 0, removed);

    const reorderedTabs = sortedTabs.map((tab, index) => ({
      id: tab.id,
      sortOrder: String(index),
    }));

    reorderTabsMutation.mutate(reorderedTabs);
    setDraggedTabId(null);
  };

  const handleDragEnd = () => {
    setDraggedTabId(null);
  };

  const openEditDialog = (tab: GuardAppTab) => {
    setEditingTab(tab);
    form.reset({
      tabKey: tab.tabKey,
      label: tab.label,
      icon: tab.icon,
      isActive: tab.isActive,
      featureGate: tab.featureGate || null,
      roleVisibility: tab.roleVisibility || ["guard", "steward", "supervisor"],
    });
  };

  const openAddDialog = () => {
    form.reset({
      tabKey: "",
      label: "",
      icon: "Home",
      isActive: true,
      featureGate: null,
      roleVisibility: ["guard", "steward", "supervisor"],
    });
    setIsAddDialogOpen(true);
  };

  const handleSubmit = (data: TabFormValues) => {
    if (editingTab) {
      updateTabMutation.mutate({ id: editingTab.id, data });
    } else {
      createTabMutation.mutate(data);
    }
  };

  const sortedTabs = [...tabs].sort((a, b) => parseInt(a.sortOrder) - parseInt(b.sortOrder));

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5" />
            <CardTitle>Guard App Navigation</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground">Loading tabs...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LayoutGrid className="h-5 w-5" />
              <div>
                <CardTitle>Guard App Navigation</CardTitle>
                <CardDescription>
                  Configure the tabs that appear in the guard mobile app. Drag to reorder.
                </CardDescription>
              </div>
            </div>
            <Button onClick={openAddDialog} size="sm" data-testid="button-add-tab">
              <Plus className="h-4 w-4 mr-1" />
              Add Tab
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {sortedTabs.map((tab) => (
              <div
                key={tab.id}
                draggable
                onDragStart={() => handleDragStart(tab.id)}
                onDragOver={(e) => handleDragOver(e, tab.id)}
                onDrop={(e) => handleDrop(e, tab.id)}
                onDragEnd={handleDragEnd}
                className={`flex items-center gap-3 p-3 rounded-md border bg-card transition-colors ${
                  draggedTabId === tab.id ? 'opacity-50' : ''
                } ${!tab.isActive ? 'opacity-60' : ''}`}
                data-testid={`tab-item-${tab.tabKey}`}
              >
                <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                
                <div className="flex items-center gap-2 flex-1">
                  {getIconComponent(tab.icon)}
                  <span className="font-medium">{tab.label}</span>
                  
                  {tab.isDefault && (
                    <Badge variant="secondary" className="text-xs">Default</Badge>
                  )}
                  
                  {!tab.isActive && (
                    <Badge variant="outline" className="text-xs">Hidden</Badge>
                  )}
                  
                  {tab.featureGate && (
                    <Badge variant="outline" className="text-xs">
                      {featureGateOptions.find(f => f.value === tab.featureGate)?.label || tab.featureGate}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditDialog(tab)}
                    data-testid={`button-edit-tab-${tab.tabKey}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  
                  {!tab.isDefault && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          data-testid={`button-delete-tab-${tab.tabKey}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Tab</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete the "{tab.label}" tab? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteTabMutation.mutate(tab.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            ))}
            
            {sortedTabs.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No tabs configured. Click "Add Tab" to create one.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isAddDialogOpen || !!editingTab} onOpenChange={(open) => {
        if (!open) {
          setIsAddDialogOpen(false);
          setEditingTab(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTab ? "Edit Tab" : "Add New Tab"}</DialogTitle>
            <DialogDescription>
              {editingTab ? "Update the tab settings below." : "Configure a new navigation tab for the guard app."}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Label</FormLabel>
                    <FormControl>
                      <Input placeholder="Tab name shown to users" {...field} data-testid="input-tab-label" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tabKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tab Key</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="unique_key (no spaces)" 
                        {...field} 
                        data-testid="input-tab-key"
                        disabled={!!editingTab?.isDefault}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="icon"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Icon</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-tab-icon">
                          <SelectValue placeholder="Select an icon" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {iconOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            <div className="flex items-center gap-2">
                              <option.icon className="h-4 w-4" />
                              <span>{option.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="featureGate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Feature Gate</FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(value === "" ? null : value)} 
                      defaultValue={field.value || ""}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-feature-gate">
                          <SelectValue placeholder="No restriction" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {featureGateOptions.map((option) => (
                          <SelectItem key={option.value || "none"} value={option.value || "none"}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <FormLabel>Visible</FormLabel>
                      <p className="text-sm text-muted-foreground">Show this tab in the guard app</p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-tab-active"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsAddDialogOpen(false);
                    setEditingTab(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createTabMutation.isPending || updateTabMutation.isPending}
                  data-testid="button-save-tab"
                >
                  {createTabMutation.isPending || updateTabMutation.isPending ? "Saving..." : "Save"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}

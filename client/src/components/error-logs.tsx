import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, Bug, CheckCircle, Clock, Search, Trash2, X, Server, Monitor, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { ErrorLogWithDetails } from "@shared/schema";

export default function ErrorLogs() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedError, setSelectedError] = useState<ErrorLogWithDetails | null>(null);
  const [resolveNotes, setResolveNotes] = useState("");
  const [isResolveDialogOpen, setIsResolveDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);

  const { data: errorLogs = [], isLoading } = useQuery<ErrorLogWithDetails[]>({
    queryKey: ['/api/super-admin/error-logs'],
  });

  const { data: unresolvedCount } = useQuery<{ count: number }>({
    queryKey: ['/api/super-admin/error-logs/count'],
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      return await apiRequest("POST", `/api/super-admin/error-logs/${id}/resolve`, { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/error-logs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/error-logs/count'] });
      setIsResolveDialogOpen(false);
      setResolveNotes("");
      setSelectedError(null);
      toast({
        title: "Error Resolved",
        description: "The error has been marked as resolved",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to resolve error",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/super-admin/error-logs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/error-logs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/error-logs/count'] });
      toast({
        title: "Error Deleted",
        description: "The error log has been removed",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete error log",
        variant: "destructive",
      });
    },
  });

  const filteredLogs = errorLogs.filter(log => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      log.message?.toLowerCase().includes(search) ||
      log.endpoint?.toLowerCase().includes(search) ||
      log.errorType?.toLowerCase().includes(search) ||
      log.company?.name?.toLowerCase().includes(search) ||
      log.user?.username?.toLowerCase().includes(search)
    );
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-600 text-white';
      case 'error':
        return 'bg-red-500 text-white';
      case 'warn':
        return 'bg-yellow-500 text-black';
      case 'info':
        return 'bg-blue-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="h-4 w-4" />;
      case 'error':
        return <AlertCircle className="h-4 w-4" />;
      case 'warn':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Bug className="h-4 w-4" />;
    }
  };

  const getErrorTypeIcon = (errorType: string) => {
    switch (errorType) {
      case 'api_error':
        return <Server className="h-4 w-4" />;
      case 'client_error':
        return <Monitor className="h-4 w-4" />;
      default:
        return <Bug className="h-4 w-4" />;
    }
  };

  const handleResolve = (log: ErrorLogWithDetails) => {
    setSelectedError(log);
    setIsResolveDialogOpen(true);
  };

  const handleViewDetails = (log: ErrorLogWithDetails) => {
    setSelectedError(log);
    setIsDetailDialogOpen(true);
  };

  const handleConfirmResolve = () => {
    if (!selectedError) return;
    resolveMutation.mutate({ id: selectedError.id, notes: resolveNotes });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Error Logs</h2>
          <p className="text-muted-foreground">Monitor and track system errors across all clients</p>
        </div>
        {unresolvedCount && unresolvedCount.count > 0 && (
          <Badge variant="destructive" data-testid="badge-unresolved-count">
            {unresolvedCount.count} Unresolved
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-8 w-8 text-red-500" />
              <div>
                <p className="text-2xl font-bold">{unresolvedCount?.count || 0}</p>
                <p className="text-xs text-muted-foreground">Unresolved</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Bug className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{errorLogs.length}</p>
                <p className="text-xs text-muted-foreground">Total Errors</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Server className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{errorLogs.filter(e => e.errorType === 'api_error').length}</p>
                <p className="text-xs text-muted-foreground">API Errors</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Monitor className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">{errorLogs.filter(e => e.errorType === 'client_error').length}</p>
                <p className="text-xs text-muted-foreground">Client Errors</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Error Log History</CardTitle>
              <CardDescription>Recent system errors and exceptions</CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search errors..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
                data-testid="input-search-errors"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading error logs...</div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bug className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No errors found</p>
              <p className="text-sm">The system is running smoothly</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-3">
                {filteredLogs.map((log) => (
                  <div
                    key={log.id}
                    className={`p-4 rounded-lg border ${log.isResolved ? 'border-green-200 bg-green-50 dark:bg-green-950/20' : 'border-border'}`}
                    data-testid={`error-log-${log.id}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={getSeverityColor(log.severity || 'error')}>
                            {getSeverityIcon(log.severity || 'error')}
                            <span className="ml-1 capitalize">{log.severity || 'Error'}</span>
                          </Badge>
                          <Badge variant="outline" className="flex items-center gap-1">
                            {getErrorTypeIcon(log.errorType || 'unknown')}
                            <span className="capitalize">{log.errorType?.replace('_', ' ') || 'Unknown'}</span>
                          </Badge>
                          {log.isResolved && (
                            <Badge variant="outline" className="text-green-600 border-green-600">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Resolved
                            </Badge>
                          )}
                        </div>
                        
                        <p className="font-medium text-sm line-clamp-2 mb-1">{log.message || 'No message'}</p>
                        
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          {log.endpoint && (
                            <span className="font-mono bg-muted px-1 rounded">
                              {log.method && `${log.method} `}{log.endpoint}
                            </span>
                          )}
                          {log.statusCode && (
                            <Badge variant="secondary" className="text-xs">
                              Status: {log.statusCode}
                            </Badge>
                          )}
                          {log.company && (
                            <span>Company: {log.company.name}</span>
                          )}
                          {log.user && (
                            <span>User: {log.user.username}</span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {log.createdAt && format(new Date(log.createdAt), "MMM d, yyyy 'at' HH:mm:ss")}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetails(log)}
                          data-testid={`button-view-error-${log.id}`}
                        >
                          View
                        </Button>
                        {!log.isResolved && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleResolve(log)}
                            className="text-green-600 hover:text-green-700"
                            data-testid={`button-resolve-error-${log.id}`}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteMutation.mutate(log.id)}
                          className="text-red-600 hover:text-red-700"
                          data-testid={`button-delete-error-${log.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Dialog open={isResolveDialogOpen} onOpenChange={setIsResolveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Error</DialogTitle>
            <DialogDescription>
              Add optional notes about how this error was resolved
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Resolution notes (optional)..."
              value={resolveNotes}
              onChange={(e) => setResolveNotes(e.target.value)}
              rows={4}
              data-testid="textarea-resolve-notes"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsResolveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmResolve} disabled={resolveMutation.isPending}>
              {resolveMutation.isPending ? "Resolving..." : "Mark as Resolved"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bug className="h-5 w-5" />
              Error Details
            </DialogTitle>
          </DialogHeader>
          {selectedError && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Severity</p>
                  <Badge className={getSeverityColor(selectedError.severity || 'error')}>
                    {selectedError.severity || 'Error'}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Type</p>
                  <Badge variant="outline">{selectedError.errorType?.replace('_', ' ') || 'Unknown'}</Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  <Badge variant={selectedError.isResolved ? 'default' : 'destructive'}>
                    {selectedError.isResolved ? 'Resolved' : 'Unresolved'}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Date</p>
                  <p className="text-sm">{selectedError.createdAt && format(new Date(selectedError.createdAt), "MMM d, yyyy 'at' HH:mm:ss")}</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Message</p>
                <p className="text-sm p-2 bg-muted rounded">{selectedError.message || 'No message'}</p>
              </div>

              {selectedError.endpoint && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Endpoint</p>
                  <p className="text-sm font-mono p-2 bg-muted rounded">
                    {selectedError.method && `${selectedError.method} `}{selectedError.endpoint}
                  </p>
                </div>
              )}

              {selectedError.statusCode && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Status Code</p>
                  <p className="text-sm">{selectedError.statusCode}</p>
                </div>
              )}

              {selectedError.stack && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Stack Trace</p>
                  <pre className="text-xs p-2 bg-muted rounded overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto font-mono">
                    {selectedError.stack}
                  </pre>
                </div>
              )}

              {selectedError.requestBody && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Request Body</p>
                  <pre className="text-xs p-2 bg-muted rounded overflow-x-auto whitespace-pre-wrap max-h-32 overflow-y-auto font-mono">
                    {selectedError.requestBody}
                  </pre>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {selectedError.company && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Company</p>
                    <p className="text-sm">{selectedError.company.name}</p>
                  </div>
                )}
                {selectedError.user && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">User</p>
                    <p className="text-sm">{selectedError.user.username} ({selectedError.user.role})</p>
                  </div>
                )}
                {selectedError.ipAddress && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">IP Address</p>
                    <p className="text-sm font-mono">{selectedError.ipAddress}</p>
                  </div>
                )}
                {selectedError.userAgent && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground mb-1">User Agent</p>
                    <p className="text-xs p-2 bg-muted rounded overflow-x-auto">{selectedError.userAgent}</p>
                  </div>
                )}
              </div>

              {selectedError.isResolved && selectedError.resolver && (
                <div className="border-t pt-4">
                  <p className="text-xs text-muted-foreground mb-1">Resolved By</p>
                  <p className="text-sm">{selectedError.resolver.username} on {format(new Date(selectedError.resolvedAt!), "MMM d, yyyy 'at' HH:mm")}</p>
                  {selectedError.resolutionNotes && (
                    <div className="mt-2">
                      <p className="text-xs text-muted-foreground mb-1">Resolution Notes</p>
                      <p className="text-sm p-2 bg-muted rounded">{selectedError.resolutionNotes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailDialogOpen(false)}>
              Close
            </Button>
            {selectedError && !selectedError.isResolved && (
              <Button onClick={() => {
                setIsDetailDialogOpen(false);
                handleResolve(selectedError);
              }}>
                Resolve
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

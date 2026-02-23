import { Badge } from "@/components/ui/badge";
import { Phone, Mail, Shield } from "lucide-react";
import type { JobShareAssignedWorker } from "@shared/schema";
import { ROLE_LABELS } from "./shared";

export function AssignedWorkersDisplay({ workers }: { workers: JobShareAssignedWorker[] }) {
  return (
    <div className="space-y-2">
      {workers.map((worker, index) => (
        <div key={index} className="flex items-center justify-between p-2 rounded-md bg-muted/40" data-testid={`assigned-worker-${index}`}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{worker.name}</span>
            <Badge variant="secondary" className="text-xs">{ROLE_LABELS[worker.role] || worker.role}</Badge>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {worker.phone && (
              <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{worker.phone}</span>
            )}
            {worker.email && (
              <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{worker.email}</span>
            )}
            {worker.siaLicense && (
              <span className="flex items-center gap-1"><Shield className="h-3 w-3" />{worker.siaLicense}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

import { Badge } from "@/components/ui/badge";
import { Users, PoundSterling } from "lucide-react";
import type { JobSharePosition } from "@shared/schema";
import { ROLE_LABELS } from "./shared";

export function PositionsDisplay({ positions }: { positions: JobSharePosition[] }) {
  return (
    <div className="space-y-2">
      {positions.map((pos, index) => (
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
}

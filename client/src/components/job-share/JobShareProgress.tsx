import type { JobSharePosition } from "@shared/schema";
import { getTotalPositions, normalizeLegacyRole } from "./shared";

interface JobShareProgressProps {
  positions: JobSharePosition[];
  acceptedPositions: JobSharePosition[] | null;
  status: string;
}

export function JobShareProgress({ positions, acceptedPositions, status }: JobShareProgressProps) {
  if (status !== 'accepted' && status !== 'pending') return null;

  const totalRequired = getTotalPositions(positions);
  const totalAccepted = acceptedPositions
    ? getTotalPositions(acceptedPositions.map(p => ({ ...p, role: normalizeLegacyRole(p.role) })))
    : 0;
  const remaining = totalRequired - totalAccepted;
  const fillPercentage = totalRequired > 0 ? Math.round((totalAccepted / totalRequired) * 100) : 0;

  if (status === 'pending' && totalAccepted === 0) {
    return (
      <div className="space-y-1.5" data-testid="progress-unfilled">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Fill Status</span>
          <span className="font-medium text-red-600 dark:text-red-400">0 of {totalRequired} filled</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-red-500" style={{ width: '0%' }} />
        </div>
        <p className="text-xs text-muted-foreground">{totalRequired} position{totalRequired !== 1 ? 's' : ''} remaining</p>
      </div>
    );
  }

  let colorClass = 'bg-red-500';
  let textColorClass = 'text-red-600 dark:text-red-400';
  if (fillPercentage >= 100) {
    colorClass = 'bg-green-500';
    textColorClass = 'text-green-600 dark:text-green-400';
  } else if (fillPercentage >= 50) {
    colorClass = 'bg-amber-500';
    textColorClass = 'text-amber-600 dark:text-amber-400';
  }

  return (
    <div className="space-y-1.5" data-testid="progress-fill">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Fill Status</span>
        <span className={`font-medium ${textColorClass}`}>
          {totalAccepted} of {totalRequired} filled ({fillPercentage}%)
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${colorClass}`}
          style={{ width: `${Math.min(fillPercentage, 100)}%` }}
        />
      </div>
      {remaining > 0 && (
        <p className="text-xs text-muted-foreground">{remaining} position{remaining !== 1 ? 's' : ''} remaining</p>
      )}
    </div>
  );
}

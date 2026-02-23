import type { JobSharePosition, JobShareRole } from "@shared/schema";
import { JOB_SHARE_ROLES } from "@shared/schema";

export const ROLE_LABELS: Record<string, string> = {
  sia: "SIA",
  steward: "Steward",
  supervisor: "Supervisor",
  response: "Response",
  dog_handler: "Dog Handler",
  call_out: "Call Out",
  guard: "SIA",
};

export const normalizeLegacyRole = (role: string): JobShareRole => {
  if (role === 'guard') return 'sia';
  if (JOB_SHARE_ROLES.includes(role as JobShareRole)) return role as JobShareRole;
  return 'sia';
};

export interface PositionRow {
  role: JobShareRole;
  count: number;
  hourlyRate: string;
}

export const emptyPosition = (): PositionRow => ({ role: "sia", count: 1, hourlyRate: "15.00" });

export const getPositionsForShare = (share: any): JobSharePosition[] => {
  const sharePositions = share.positions as JobSharePosition[] | null;
  if (sharePositions && sharePositions.length > 0) {
    return sharePositions.map((p: any) => ({ ...p, role: normalizeLegacyRole(p.role) }));
  }
  return [{ role: normalizeLegacyRole(share.workingRole || 'sia'), count: Number(share.numberOfJobs), hourlyRate: String(share.hourlyRate) }];
};

export const getTotalPositions = (positions: JobSharePosition[]) => {
  return positions.reduce((sum, p) => sum + Number(p.count), 0);
};

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";

interface JobShareDeadlineProps {
  deadline: string | Date | null;
  status: string;
}

function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return "Expired";
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function JobShareDeadline({ deadline, status }: JobShareDeadlineProps) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!deadline) return;
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, [deadline]);

  if (!deadline || status !== 'pending') return null;

  const deadlineTime = new Date(deadline).getTime();
  const remaining = deadlineTime - now;
  const isExpired = remaining <= 0;
  const isUrgent = remaining > 0 && remaining < 2 * 60 * 60 * 1000;

  if (isExpired) {
    return (
      <Badge
        variant="outline"
        className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20"
        data-testid="badge-deadline-expired"
      >
        <Clock className="h-3 w-3 mr-1" />Expired
      </Badge>
    );
  }

  if (isUrgent) {
    return (
      <Badge
        variant="outline"
        className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 animate-pulse"
        data-testid="badge-deadline-urgent"
      >
        <Clock className="h-3 w-3 mr-1" />{formatTimeRemaining(remaining)}
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20"
      data-testid="badge-deadline"
    >
      <Clock className="h-3 w-3 mr-1" />{formatTimeRemaining(remaining)}
    </Badge>
  );
}

export function isDeadlineExpired(deadline: string | Date | null): boolean {
  if (!deadline) return false;
  return new Date(deadline).getTime() < Date.now();
}

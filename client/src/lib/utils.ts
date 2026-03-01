import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getCompanyColor(companyId: string, brandColor?: string | null): string {
  if (brandColor) return brandColor;
  // Deterministic color from companyId hash
  let hash = 0;
  for (let i = 0; i < companyId.length; i++) {
    hash = companyId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 60%, 45%)`;
}

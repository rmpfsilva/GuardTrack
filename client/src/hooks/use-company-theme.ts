import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";

function hexToHsl(hex: string): string | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function getPerceivedLuminance(hex: string): number {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return 0.5;
  const r = parseInt(result[1], 16) / 255;
  const g = parseInt(result[2], 16) / 255;
  const b = parseInt(result[3], 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export function useCompanyTheme() {
  const { user } = useAuth();

  const memberships = (user as any)?.memberships as Array<{ companyId: string; brandColor?: string | null }> | undefined;
  const primaryCompanyId = (user as any)?.companyId;

  const brandColor = memberships?.find(m => m.companyId === primaryCompanyId)?.brandColor;

  useEffect(() => {
    const root = document.documentElement;

    if (!brandColor || !/^#[0-9a-fA-F]{6}$/.test(brandColor)) {
      root.style.removeProperty('--primary');
      root.style.removeProperty('--sidebar-primary');
      root.style.removeProperty('--primary-foreground');
      root.style.removeProperty('--sidebar-primary-foreground');
      root.style.removeProperty('--ring');
      return;
    }

    const hsl = hexToHsl(brandColor);
    if (!hsl) return;

    const luminance = getPerceivedLuminance(brandColor);
    const fg = luminance > 0.55 ? '220 10% 10%' : '220 10% 98%';

    root.style.setProperty('--primary', hsl);
    root.style.setProperty('--sidebar-primary', hsl);
    root.style.setProperty('--primary-foreground', fg);
    root.style.setProperty('--sidebar-primary-foreground', fg);
    root.style.setProperty('--ring', hsl);

    return () => {
      root.style.removeProperty('--primary');
      root.style.removeProperty('--sidebar-primary');
      root.style.removeProperty('--primary-foreground');
      root.style.removeProperty('--sidebar-primary-foreground');
      root.style.removeProperty('--ring');
    };
  }, [brandColor]);
}

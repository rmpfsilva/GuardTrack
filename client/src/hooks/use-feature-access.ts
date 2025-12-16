import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./use-auth";

export type FeatureName = 
  | 'userManagement' 
  | 'dashboardAccess' 
  | 'reportsViewing' 
  | 'checkInOut' 
  | 'shiftScheduling' 
  | 'siteManagement' 
  | 'breakTracking' 
  | 'overtimeManagement' 
  | 'leaveRequests' 
  | 'noticeBoard' 
  | 'pushNotifications';

interface FeatureAccessData {
  hasFullAccess: boolean;
  features: Record<FeatureName, boolean>;
  limits: {
    maxSites: number | null;
    maxUsers: number | null;
  };
  planName: string | null;
  planId?: string;
  isBlocked: boolean;
  blockReason?: string;
  isPlanActive?: boolean;
}

export function useFeatureAccess() {
  const { user } = useAuth();

  const { data, isLoading, error, refetch } = useQuery<FeatureAccessData>({
    queryKey: ['/api/feature-access'],
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    refetchOnWindowFocus: false,
  });

  const hasFeature = (feature: FeatureName): boolean => {
    if (!data) return false;
    if (data.hasFullAccess) return true;
    if (data.isBlocked) return false;
    return data.features?.[feature] ?? false;
  };

  const checkLimit = (limitType: 'maxSites' | 'maxUsers', currentCount: number): boolean => {
    if (!data) return false;
    if (data.hasFullAccess) return true;
    if (data.isBlocked) return false;
    
    const limit = data.limits?.[limitType];
    if (limit === null || limit === undefined) return true; // null means unlimited
    return currentCount < limit;
  };

  return {
    isLoading,
    error,
    refetch,
    hasFullAccess: data?.hasFullAccess ?? false,
    isBlocked: data?.isBlocked ?? false,
    blockReason: data?.blockReason,
    planName: data?.planName ?? null,
    planId: data?.planId,
    isPlanActive: data?.isPlanActive ?? true,
    features: data?.features ?? {},
    limits: data?.limits ?? { maxSites: null, maxUsers: null },
    hasFeature,
    checkLimit,
  };
}

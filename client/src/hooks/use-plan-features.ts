import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

interface PlanFeatures {
  userManagement: boolean;
  dashboardAccess: boolean;
  reportsViewing: boolean;
  checkInOut: boolean;
  shiftScheduling: boolean;
  siteManagement: boolean;
  breakTracking: boolean;
  overtimeManagement: boolean;
  leaveRequests: boolean;
  noticeBoard: boolean;
  pushNotifications: boolean;
}

interface PlanLimits {
  maxSites: number | null;
  maxUsers: number | null;
}

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string | null;
  monthlyPrice: string;
  features: PlanFeatures;
  limits: PlanLimits;
  isActive: boolean;
}

interface CompanyPlanResponse {
  plan: SubscriptionPlan | null;
  planName: string | null;
}

export type AdminTab = 
  | 'overview'
  | 'billing'
  | 'reports'
  | 'schedule'
  | 'guards'
  | 'users'
  | 'invitations'
  | 'manual'
  | 'sites'
  | 'leave'
  | 'approvals'
  | 'notices'
  | 'partnerships'
  | 'job-sharing'
  | 'activity';

const TAB_TO_FEATURE_MAP: Record<AdminTab, keyof PlanFeatures | 'always' | 'pro'> = {
  'overview': 'dashboardAccess',
  'guards': 'checkInOut',
  'reports': 'reportsViewing',
  'users': 'userManagement',
  'schedule': 'shiftScheduling',
  'sites': 'siteManagement',
  'leave': 'leaveRequests',
  'invitations': 'userManagement',
  'manual': 'checkInOut',
  'approvals': 'overtimeManagement',
  'notices': 'noticeBoard',
  'partnerships': 'pro',
  'job-sharing': 'pro',
  'billing': 'pro',
  'activity': 'pro',
};

const STARTER_TABS: AdminTab[] = ['overview', 'guards', 'reports', 'users'];
const STANDARD_TABS: AdminTab[] = [...STARTER_TABS, 'schedule', 'sites', 'leave', 'invitations', 'manual'];
const PRO_TABS: AdminTab[] = [...STANDARD_TABS, 'approvals', 'notices', 'partnerships', 'job-sharing', 'billing', 'activity'];

export function usePlanFeatures() {
  const { user } = useAuth();

  const { data: companyPlan, isLoading } = useQuery<CompanyPlanResponse>({
    queryKey: ["/api/company/plan"],
    enabled: !!user && user.role !== 'super_admin',
  });

  const getAccessibleTabs = (): AdminTab[] => {
    if (!user || user.role === 'super_admin') {
      return PRO_TABS;
    }

    if (!companyPlan?.plan) {
      return STARTER_TABS;
    }

    const planName = companyPlan.plan.name?.toLowerCase();
    
    if (planName === 'pro') {
      return PRO_TABS;
    }
    
    if (planName === 'standard') {
      return STANDARD_TABS;
    }
    
    return STARTER_TABS;
  };

  const hasFeatureAccess = (feature: keyof PlanFeatures): boolean => {
    if (!user || user.role === 'super_admin') {
      return true;
    }

    if (!companyPlan?.plan?.features) {
      return false;
    }

    return companyPlan.plan.features[feature] === true;
  };

  const hasTabAccess = (tab: AdminTab): boolean => {
    const accessibleTabs = getAccessibleTabs();
    return accessibleTabs.includes(tab);
  };

  const getPlanName = (): string | null => {
    return companyPlan?.planName || companyPlan?.plan?.name || null;
  };

  const getPlanTier = (): 'starter' | 'standard' | 'pro' | null => {
    const name = getPlanName()?.toLowerCase();
    if (name === 'pro') return 'pro';
    if (name === 'standard') return 'standard';
    if (name === 'starter') return 'starter';
    return null;
  };

  return {
    plan: companyPlan?.plan || null,
    planName: getPlanName(),
    planTier: getPlanTier(),
    isLoading,
    hasFeatureAccess,
    hasTabAccess,
    getAccessibleTabs,
    allTabs: PRO_TABS,
    starterTabs: STARTER_TABS,
    standardTabs: STANDARD_TABS,
    proTabs: PRO_TABS,
  };
}

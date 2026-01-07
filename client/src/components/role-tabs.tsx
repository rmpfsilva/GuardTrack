import { useState, useEffect, createContext, useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Users, Eye, Settings, Crown } from 'lucide-react';

type RoleType = 'guard' | 'steward' | 'supervisor' | 'admin' | 'super_admin';

const ROLE_CONFIG: Record<RoleType, { label: string; icon: typeof Shield }> = {
  guard: { label: 'Security Guard (SIA)', icon: Shield },
  steward: { label: 'Steward', icon: Users },
  supervisor: { label: 'Supervisor', icon: Eye },
  admin: { label: 'Admin', icon: Settings },
  super_admin: { label: 'Platform Admin', icon: Crown },
};

const STORAGE_KEY = 'guardtrack_active_role';

interface ActiveRoleContextType {
  activeRole: string | null;
  setActiveRole: (role: string) => void;
  roles: string[];
  isLoading: boolean;
  hasMultipleRoles: boolean;
}

const ActiveRoleContext = createContext<ActiveRoleContextType | null>(null);

export function useActiveRole() {
  const context = useContext(ActiveRoleContext);
  if (!context) {
    throw new Error('useActiveRole must be used within a RoleTabsProvider');
  }
  return context;
}

interface RoleTabsProviderProps {
  children: React.ReactNode;
}

export function RoleTabsProvider({ children }: RoleTabsProviderProps) {
  const [activeRole, setActiveRoleState] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY);
    }
    return null;
  });

  const { data: rolesData, isLoading } = useQuery<{ userId: string; roles: string[] }>({
    queryKey: ['/api/user/roles'],
  });

  const roles = rolesData?.roles || [];

  useEffect(() => {
    if (roles.length > 0 && !activeRole) {
      const storedRole = localStorage.getItem(STORAGE_KEY);
      if (storedRole && roles.includes(storedRole)) {
        setActiveRoleState(storedRole);
      } else {
        setActiveRoleState(roles[0]);
        localStorage.setItem(STORAGE_KEY, roles[0]);
      }
    }
  }, [roles, activeRole]);

  const setActiveRole = (role: string) => {
    setActiveRoleState(role);
    localStorage.setItem(STORAGE_KEY, role);
  };

  const hasMultipleRoles = roles.length > 1;

  return (
    <ActiveRoleContext.Provider value={{ activeRole, setActiveRole, roles, isLoading, hasMultipleRoles }}>
      {children}
    </ActiveRoleContext.Provider>
  );
}

interface RoleTabsProps {
  className?: string;
}

export function RoleTabs({ className }: RoleTabsProps) {
  const { activeRole, setActiveRole, roles, isLoading, hasMultipleRoles } = useActiveRole();

  if (isLoading || !hasMultipleRoles || !activeRole) {
    return null;
  }

  return (
    <div className={className} data-testid="role-tabs-container">
      <Tabs value={activeRole} onValueChange={setActiveRole}>
        <TabsList className="h-10">
          {roles.map((role) => {
            const config = ROLE_CONFIG[role as RoleType];
            if (!config) return null;
            const Icon = config.icon;
            return (
              <TabsTrigger
                key={role}
                value={role}
                className="gap-2 px-4"
                data-testid={`role-tab-${role}`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{config.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>
    </div>
  );
}

export function getRoleLabel(role: string): string {
  return ROLE_CONFIG[role as RoleType]?.label || role;
}

export function getRoleIcon(role: string) {
  return ROLE_CONFIG[role as RoleType]?.icon || Shield;
}

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  fetchMe,
  fetchProjects,
  fetchUserOrganizations,
  switchOrganization,
  type MeResponse,
  type ProjectRow,
  type UserOrganization,
} from "../lib/api";

export type Environment = "production" | "staging" | "local";

const ENV_STORAGE_KEY = "epure.environment";
const PROJECT_STORAGE_KEY = "epure.project";

interface AppContextValue {
  environment: Environment;
  setEnvironment: (env: Environment) => void;
  projectId: string | null;
  setProjectId: (id: string) => void;
  projects: ProjectRow[];
  projectsLoading: boolean;
  projectsError: string | null;
  refreshProjects: () => Promise<void>;
  user: MeResponse | null;
  userLoading: boolean;
  organizations: UserOrganization[];
  scaleBillingWorkspaceId: string | null;
  organizationsError: boolean;
  organizationsLoading: boolean;
  currentOrg: UserOrganization | null;
  refreshOrganizations: () => Promise<void>;
  refreshUser: () => Promise<void>;
  switchOrg: (orgId: string) => Promise<void>;
  buildQuery: (query: string) => string;
}

const AppContext = createContext<AppContextValue | null>(null);

function readStoredEnvironment(): Environment {
  try {
    const stored = localStorage.getItem(ENV_STORAGE_KEY);
    if (stored === "production" || stored === "staging" || stored === "local") {
      return stored;
    }
  } catch {
    // fallback on error
  }
  return "production";
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [environment, setEnvironmentState] = useState<Environment>(readStoredEnvironment);
  const [projectId, setProjectIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(PROJECT_STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [user, setUser] = useState<MeResponse | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [organizations, setOrganizations] = useState<UserOrganization[]>([]);
  const [scaleBillingWorkspaceId, setScaleBillingWorkspaceId] = useState<string | null>(null);
  const [organizationsError, setOrganizationsError] = useState(false);
  const [organizationsLoading, setOrganizationsLoading] = useState(true);
  const workspaceGeneration = useRef(0);

  const refreshProjects = useCallback(async () => {
    const generation = workspaceGeneration.current;
    setProjectsLoading(true);
    setProjectsError(null);
    try {
      const rows = await fetchProjects();
      if (generation !== workspaceGeneration.current) return;
      const safeRows = Array.isArray(rows) ? rows : [];
      setProjects(safeRows);
      setProjectIdState((current) => {
        if (current && safeRows.some((row) => row && (row.id === current || row.slug === current))) {
          const match = safeRows.find((row) => row && (row.id === current || row.slug === current));
          const resolvedId = match?.id ?? current;
          try {
            localStorage.setItem(PROJECT_STORAGE_KEY, resolvedId);
          } catch {
            // ignore
          }
          return resolvedId;
        }
        const next = safeRows[0]?.id ?? null;
        try {
          if (next) {
            localStorage.setItem(PROJECT_STORAGE_KEY, next);
          } else {
            localStorage.removeItem(PROJECT_STORAGE_KEY);
          }
        } catch {
          // ignore localStorage errors
        }
        return next;
      });
    } catch {
      if (generation === workspaceGeneration.current) {
        setProjects([]);
        setProjectsError("Failed to load projects");
      }
    } finally {
      if (generation === workspaceGeneration.current) setProjectsLoading(false);
    }
  }, []);

  const refreshOrganizations = useCallback(async () => {
    const generation = workspaceGeneration.current;
    try {
      const directory = await fetchUserOrganizations();
      if (generation !== workspaceGeneration.current) return;
      setOrganizations(Array.isArray(directory.organizations) ? directory.organizations : []);
      setScaleBillingWorkspaceId(directory.scale_billing_workspace_id ?? null);
      setOrganizationsError(false);
    } catch {
      if (generation === workspaceGeneration.current) {
        setScaleBillingWorkspaceId(null);
        setOrganizationsError(true);
      }
    } finally {
      if (generation === workspaceGeneration.current) setOrganizationsLoading(false);
    }
  }, []);

  useEffect(() => {
    const generation = workspaceGeneration.current;
    setUserLoading(true);
    void fetchMe()
      .then((me) => {
        if (generation === workspaceGeneration.current) setUser(me);
      })
      .catch(() => {
        if (generation === workspaceGeneration.current) setUser(null);
      })
      .finally(() => {
        if (generation === workspaceGeneration.current) setUserLoading(false);
      });
    void refreshOrganizations();
    void refreshProjects();
  }, [refreshProjects, refreshOrganizations]);

  const refreshUser = useCallback(async () => {
    const generation = workspaceGeneration.current;
    const me = await fetchMe();
    if (generation !== workspaceGeneration.current) return;
    setUser(me);
    await refreshOrganizations();
  }, [refreshOrganizations]);

  const switchOrg = useCallback(
    async (orgId: string) => {
      try {
        const switched = await switchOrganization(orgId);
        workspaceGeneration.current += 1;
        setUser((current) => current ? { ...current, org_id: switched.org_id, org_name: switched.org_name, role: switched.role } : current);
        setProjects([]);
        setProjectIdState(null);
        setProjectsLoading(true);
        setUserLoading(true);
        // The session switched successfully. Keep that context even if an
        // optional refresh fails, and clear the old workspace's projects.
        await Promise.all([
          refreshUser().catch(() => refreshOrganizations()),
          refreshProjects(),
        ]);
      } finally {
        setUserLoading(false);
      }
    },
    [refreshProjects, refreshOrganizations, refreshUser],
  );

  const currentOrg = useMemo(() => {
    const safeOrgs = Array.isArray(organizations) ? organizations : [];
    return safeOrgs.find((o) => o?.id === user?.org_id) ?? null;
  }, [organizations, user?.org_id]);

  const setEnvironment = useCallback((env: Environment) => {
    setEnvironmentState(env);
    try {
      localStorage.setItem(ENV_STORAGE_KEY, env);
    } catch {
      // ignore
    }
  }, []);

  const setProjectId = useCallback((id: string) => {
    setProjectIdState(id);
    try {
      localStorage.setItem(PROJECT_STORAGE_KEY, id);
    } catch {
      // ignore
    }
  }, []);

  const buildQuery = useCallback(
    (query: string) => {
      const tokens = (query || "")
        .split(/\s+/)
        .map((token) => token.trim())
        .filter(Boolean)
        .filter((token) => !token.startsWith("env:"));
      tokens.push(`env:${environment}`);
      return tokens.join(" ");
    },
    [environment],
  );

  const value = useMemo(
    () => ({
      environment,
      setEnvironment,
      projectId,
      setProjectId,
      projects,
      projectsLoading,
      projectsError,
      refreshProjects,
      user,
      userLoading,
      organizations,
      scaleBillingWorkspaceId,
      organizationsError,
      organizationsLoading,
      currentOrg,
      refreshOrganizations,
      refreshUser,
      switchOrg,
      buildQuery,
    }),
    [
      environment,
      setEnvironment,
      projectId,
      setProjectId,
      projects,
      projectsLoading,
      projectsError,
      refreshProjects,
      user,
      userLoading,
      organizations,
      scaleBillingWorkspaceId,
      organizationsError,
      organizationsLoading,
      currentOrg,
      refreshOrganizations,
      refreshUser,
      switchOrg,
      buildQuery,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

const DEFAULT_APP_CONTEXT: AppContextValue = {
  environment: "production",
  setEnvironment: () => {},
  projectId: null,
  setProjectId: () => {},
  projects: [],
  projectsLoading: false,
  projectsError: null,
  refreshProjects: async () => {},
  user: null,
  userLoading: false,
  organizations: [],
  scaleBillingWorkspaceId: null,
  organizationsError: false,
  organizationsLoading: false,
  currentOrg: null,
  refreshOrganizations: async () => {},
  refreshUser: async () => {},
  switchOrg: async () => {},
  buildQuery: (query: string) => query,
};

export function useAppContext(): AppContextValue {
  const value = useContext(AppContext);
  return value ?? DEFAULT_APP_CONTEXT;
}

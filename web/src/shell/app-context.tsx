import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
  currentOrg: UserOrganization | null;
  refreshOrganizations: () => Promise<void>;
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

  const refreshProjects = useCallback(async () => {
    setProjectsLoading(true);
    setProjectsError(null);
    try {
      const rows = await fetchProjects();
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
      setProjects([]);
      setProjectsError("Failed to load projects");
    } finally {
      setProjectsLoading(false);
    }
  }, []);

  const refreshOrganizations = useCallback(async () => {
    try {
      const list = await fetchUserOrganizations();
      setOrganizations(Array.isArray(list) ? list : []);
    } catch {
      setOrganizations([]);
    }
  }, []);

  useEffect(() => {
    setUserLoading(true);
    void fetchMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setUserLoading(false));
    void refreshOrganizations();
    void refreshProjects();
  }, [refreshProjects, refreshOrganizations]);

  const switchOrg = useCallback(
    async (orgId: string) => {
      try {
        await switchOrganization(orgId);
        setUserLoading(true);
        const me = await fetchMe();
        setUser(me);
      } catch {
        // ignore
      } finally {
        setUserLoading(false);
      }
      await refreshOrganizations();
      await refreshProjects();
    },
    [refreshProjects, refreshOrganizations],
  );

  const currentOrg = useMemo(() => {
    const safeOrgs = Array.isArray(organizations) ? organizations : [];
    return safeOrgs.find((o) => o && o.is_current) ?? safeOrgs[0] ?? null;
  }, [organizations]);

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
      currentOrg,
      refreshOrganizations,
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
      currentOrg,
      refreshOrganizations,
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
  currentOrg: null,
  refreshOrganizations: async () => {},
  switchOrg: async () => {},
  buildQuery: (query: string) => query,
};

export function useAppContext(): AppContextValue {
  const value = useContext(AppContext);
  return value ?? DEFAULT_APP_CONTEXT;
}

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
  type MeResponse,
  type ProjectRow,
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
  buildQuery: (query: string) => string;
}

const AppContext = createContext<AppContextValue | null>(null);

function readStoredEnvironment(): Environment {
  const stored = localStorage.getItem(ENV_STORAGE_KEY);
  if (stored === "production" || stored === "staging" || stored === "local") {
    return stored;
  }
  return "production";
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [environment, setEnvironmentState] = useState<Environment>(readStoredEnvironment);
  const [projectId, setProjectIdState] = useState<string | null>(
    () => localStorage.getItem(PROJECT_STORAGE_KEY),
  );
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [user, setUser] = useState<MeResponse | null>(null);

  const refreshProjects = useCallback(async () => {
    setProjectsLoading(true);
    setProjectsError(null);
    try {
      const rows = await fetchProjects();
      setProjects(rows);
      setProjectIdState((current) => {
        if (current && rows.some((row) => row.id === current)) {
          return current;
        }
        const next = rows[0]?.id ?? null;
        if (next) {
          localStorage.setItem(PROJECT_STORAGE_KEY, next);
        } else {
          localStorage.removeItem(PROJECT_STORAGE_KEY);
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

  useEffect(() => {
    void fetchMe()
      .then(setUser)
      .catch(() => setUser(null));
    void refreshProjects();
  }, [refreshProjects]);

  const setEnvironment = useCallback((env: Environment) => {
    setEnvironmentState(env);
    localStorage.setItem(ENV_STORAGE_KEY, env);
  }, []);

  const setProjectId = useCallback((id: string) => {
    setProjectIdState(id);
    localStorage.setItem(PROJECT_STORAGE_KEY, id);
  }, []);

  const buildQuery = useCallback(
    (query: string) => {
      const tokens = query
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
      buildQuery,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) {
    throw new Error("useAppContext must be used within AppProvider");
  }
  return value;
}

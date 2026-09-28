import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { type Environment, useAppContext } from "./app-context";

function parseEnvironment(value: string | null): Environment | null {
  if (value === "production" || value === "staging" || value === "local") {
    return value;
  }
  return null;
}

/** Keep `?environment=` in sync with the top-strip filter (deep links + API queries). */
export function EnvironmentUrlSync() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { environment, setEnvironment } = useAppContext();
  const lastParams = useRef<string | null>(null);

  useEffect(() => {
    const serialized = searchParams.toString();
    const urlChanged = lastParams.current !== serialized;
    lastParams.current = serialized;

    const fromUrl = parseEnvironment(searchParams.get("environment"));

    if (urlChanged && fromUrl) {
      setEnvironment(fromUrl);
      return;
    }

    const desired = environment === "production" ? null : environment;
    if (fromUrl !== desired) {
      setSearchParams(
        (current) => {
          const params = new URLSearchParams(current);
          if (desired) {
            params.set("environment", desired);
          } else {
            params.delete("environment");
          }
          return params;
        },
        { replace: true },
      );
    }
  }, [environment, searchParams, setEnvironment, setSearchParams]);

  return null;
}

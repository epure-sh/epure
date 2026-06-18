import { type FormEvent, useEffect, useState } from "react";
import { CircleDot } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { resolvePostAuthPath } from "../../lib/onboarding";
import { Button } from "../../ui/button";
import { Card } from "../../ui/card";
import { Field } from "../../ui/field";
import { Input } from "../../ui/input";

type AuthMode = "login" | "register";

interface AuthConfig {
  google_enabled: boolean;
  password_enabled: boolean;
}

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite")?.trim() || null;
  const [mode, setMode] = useState<AuthMode>(inviteToken ? "register" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [authConfig, setAuthConfig] = useState<AuthConfig | null>(null);

  useEffect(() => {
    fetch("/api/v1/auth/config", { credentials: "include" })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: AuthConfig | null) => {
        if (body) {
          setAuthConfig(body);
        }
      })
      .catch(() => {
        setAuthConfig({ google_enabled: false, password_enabled: true });
      });
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("idle");
    setMessage(null);

    const path = mode === "login" ? "/api/v1/auth/login" : "/api/v1/auth/register";
    const payload: { email: string; password: string; invite_token?: string } = {
      email,
      password,
    };
    if (mode === "register" && inviteToken) {
      payload.invite_token = inviteToken;
    }
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      setStatus("error");
      if (response.status === 409) {
        setMessage("Email already registered.");
      } else if (response.status === 401) {
        setMessage("Invalid email or password.");
      } else if (response.status === 400) {
        setMessage(
          inviteToken && mode === "register"
            ? "Invalid invite link or password must be at least 8 characters."
            : "Password must be at least 8 characters.",
        );
      } else {
        setMessage("Sign-in failed.");
      }
      return;
    }

    const nextPath = await resolvePostAuthPath();
    navigate(nextPath, { replace: true });
  }

  const googleEnabled = authConfig?.google_enabled ?? false;

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-6">
      <Card className="w-full max-w-sm p-6">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-accent text-accent-contrast">
            <CircleDot size={24} strokeWidth={2} />
          </div>
          <h1 className="epure-page-title mt-4 font-medium tracking-ui text-ink">Sign in to Epure</h1>
          <p className="mt-2 text-sm text-ink-muted">
            {inviteToken
              ? "Create an account or sign in with Google to join the workspace."
              : "Exception monitoring for indie teams."}
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-4">
          {inviteToken ? (
            <p className="rounded-lg border border-border bg-bg-subtle px-3 py-2 text-center text-sm text-ink-muted">
              You were invited to join a workspace.
            </p>
          ) : null}
          {googleEnabled ? (
            <Button
              variant="secondary"
              type="button"
              className="w-full"
              onClick={() => {
                const googleUrl = inviteToken
                  ? `/api/v1/auth/google?invite=${encodeURIComponent(inviteToken)}`
                  : "/api/v1/auth/google";
                window.location.href = googleUrl;
              }}
            >
              Continue with Google
            </Button>
          ) : null}

          <div className="flex gap-1 rounded-lg border border-border bg-bg-subtle p-0.5">
            <Button
              variant={mode === "login" ? "primary" : "ghost"}
              type="button"
              className="flex-1"
              onClick={() => setMode("login")}
            >
              Log in
            </Button>
            <Button
              variant={mode === "register" ? "primary" : "ghost"}
              type="button"
              className="flex-1"
              onClick={() => setMode("register")}
            >
              Register
            </Button>
          </div>

          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <Field label="Email" htmlFor="email">
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </Field>
            <Field
              label="Password"
              htmlFor="password"
              hint={
                mode === "register"
                  ? "At least 8 characters."
                  : "Forgot your password? Ask your workspace admin or sign in with Google."
              }
            >
              <Input
                id="password"
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={8}
              />
            </Field>
            <Button type="submit" className="w-full">
              {mode === "login" ? "Log in" : "Create account"}
            </Button>
          </form>

          {status === "error" && message ? (
            <p className="text-center text-sm text-semantic-danger">{message}</p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

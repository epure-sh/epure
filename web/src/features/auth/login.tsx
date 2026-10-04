import { type FormEvent, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { resolvePostAuthPath } from "../../lib/onboarding";
import { HTTP_SESSION_COOKIE_MESSAGE, httpSecureCookieTrap } from "../../lib/session-cookie";
import { isGoogleSignInVisible } from "../../lib/deployment";
import { Button } from "../../ui/button";
import { Card } from "../../ui/card";
import { Field } from "../../ui/field";
import { Input } from "../../ui/input";
import { EpureBrandMark } from "../../ui/logo";

type AuthMode = "login" | "register";

interface AuthConfig {
  google_enabled: boolean;
  password_enabled: boolean;
  registration_enabled?: boolean;
  session_secure?: boolean;
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
        setAuthConfig({
          google_enabled: false,
          password_enabled: true,
          registration_enabled: true,
        });
      });
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("idle");
    setMessage(null);

    if (httpSecureCookieTrap(window.location.protocol, authConfig?.session_secure === true)) {
      setStatus("error");
      setMessage(HTTP_SESSION_COOKIE_MESSAGE);
      return;
    }

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
      } else if (response.status === 403) {
        setMessage("Registration is closed on this server.");
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

  const googleEnabled = isGoogleSignInVisible(authConfig?.google_enabled);
  const registrationClosed =
    searchParams.get("error") === "registration_closed" ||
    authConfig?.registration_enabled === false;
  const canRegister = Boolean(inviteToken) || !registrationClosed;
  const cookieTrap = httpSecureCookieTrap(
    window.location.protocol,
    authConfig?.session_secure === true,
  );

  useEffect(() => {
    if (!canRegister && mode === "register") {
      setMode("login");
    }
  }, [canRegister, mode]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-6">
      <Card className="w-full max-w-sm rounded-lg p-6">
        <div className="text-center">
          <div className="mx-auto flex justify-center">
            <EpureBrandMark size={48} />
          </div>
          <h1 className="epure-page-title mt-4 text-base font-medium tracking-ui text-ink">Sign in to Epure</h1>
          <p className="mt-2 text-sm text-ink-muted">
            {inviteToken
              ? googleEnabled
                ? "Create an account or sign in with Google to join the workspace."
                : "Create an account to join the workspace."
              : "Error tracking for exceptions. Change the DSN."}
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-4">
          {inviteToken ? (
            <p className="rounded-lg border border-border bg-bg-subtle px-3 py-2 text-center text-sm text-ink-muted">
              You were invited to join a workspace.
            </p>
          ) : registrationClosed ? (
            <p className="rounded-lg border border-border bg-bg-subtle px-3 py-2 text-center text-sm text-ink-muted">
              Public registration is closed. Sign in with an existing account.
            </p>
          ) : null}
          {googleEnabled ? (
            <Button
              variant="secondary"
              type="button"
              className="w-full"
              disabled={cookieTrap}
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

          {cookieTrap ? (
            <p className="border border-border border-l-[3px] border-l-semantic-warning bg-surface px-3 py-2 text-sm text-ink">
              {HTTP_SESSION_COOKIE_MESSAGE}
            </p>
          ) : null}
          {canRegister ? (
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
          ) : null}

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
                  : googleEnabled
                    ? "Forgot your password? Ask your workspace admin or sign in with Google."
                    : "Forgot your password? Ask your workspace admin."
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
            <Button type="submit" className="w-full" disabled={cookieTrap}>
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

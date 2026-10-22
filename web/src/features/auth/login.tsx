import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { acceptInvitation, fetchMe } from "../../lib/api";
import { HTTP_SESSION_COOKIE_MESSAGE, httpSecureCookieTrap } from "../../lib/session-cookie";
import { Button } from "../../ui/button";
import { Card } from "../../ui/card";
import { EpureBrandMark } from "../../ui/logo";

interface AuthConfig {
  google_enabled: boolean;
  github_enabled: boolean;
  password_enabled: boolean;
  registration_enabled?: boolean;
  session_secure?: boolean;
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      className={className}
    >
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.36 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"
      />
    </svg>
  );
}

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite")?.trim() || null;
  const [authConfig, setAuthConfig] = useState<AuthConfig | null>(null);
  const [acceptingInvite, setAcceptingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  useEffect(() => {
    // If the user already has a valid session and clicks an invite link, automatically accept and join
    if (inviteToken) {
      void fetchMe()
        .then(async (me) => {
          if (me && me.user_id) {
            setAcceptingInvite(true);
            try {
              await acceptInvitation(inviteToken);
              window.location.href = "/";
            } catch {
              setAcceptingInvite(false);
              setInviteError("Failed to accept invitation. The invitation may be expired or for a different email.");
            }
          }
        })
        .catch(() => {});
    }

    fetch("/api/v1/auth/config", { credentials: "include" })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: AuthConfig | null) => {
        if (body) {
          setAuthConfig(body);
        }
      })
      .catch(() => {
        setAuthConfig({
          google_enabled: true,
          github_enabled: true,
          password_enabled: false,
          registration_enabled: true,
        });
      });
  }, []);

  const oauthError = searchParams.get("error");
  const oauthErrorMessage =
    oauthError === "oauth_state"
      ? "Sign-in session expired. Clear site cookies for app.epure.sh and try again."
      : oauthError === "oauth_github"
        ? "GitHub sign-in failed at the server. Please try again or use Google."
        : oauthError === "oauth_google"
          ? "Google sign-in failed at the server. Please try again or use GitHub."
          : oauthError === "oauth_denied"
            ? "Sign-in was cancelled at the provider."
            : oauthError === "oauth_invalid"
              ? "Invalid sign-in response from the provider."
              : null;

  const cookieTrap = httpSecureCookieTrap(
    window.location.protocol,
    authConfig?.session_secure === true,
  );

  const githubEnabled = authConfig ? authConfig.github_enabled : true;
  const googleEnabled = authConfig ? authConfig.google_enabled : true;

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-6">
      <Card className="w-full max-w-sm rounded-xl border border-border bg-surface p-7 shadow-xs">
        <div className="text-center">
          <div className="mx-auto flex justify-center">
            <EpureBrandMark size={44} />
          </div>
          <h1 className="epure-page-title mt-4 text-base font-semibold tracking-ui text-ink">
            Sign in to Epure
          </h1>
          <p className="mt-1.5 text-xs text-ink-muted">
            {inviteToken
              ? "Accept your workspace invite and continue with GitHub or Google."
              : "Exception tracking with surgical token-capped AI triage."}
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          {inviteToken && (
            <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-bg-subtle px-3 py-2 text-xs text-ink-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
              <span>
                {acceptingInvite
                  ? "Accepting invitation and switching workspace…"
                  : "Workspace invitation link active"}
              </span>
            </div>
          )}

          {inviteError && (
            <div className="rounded-lg border border-semantic-danger/40 bg-surface p-3 text-xs text-semantic-danger">
              {inviteError}
            </div>
          )}

          {cookieTrap && (
            <div className="rounded-lg border border-semantic-warning/40 bg-surface p-3 text-xs text-ink">
              {HTTP_SESSION_COOKIE_MESSAGE}
            </div>
          )}

          {oauthErrorMessage && (
            <div className="rounded-lg border border-semantic-danger/30 bg-semantic-danger/10 p-3 text-center text-xs text-semantic-danger">
              {oauthErrorMessage}
            </div>
          )}

          {/* Official GitHub OAuth Button */}
          {githubEnabled && (
            <Button
              variant="outline"
              size="lg"
              type="button"
              className="w-full justify-center gap-2.5 border-border bg-surface text-ink font-medium transition-all hover:bg-bg-subtle hover:border-ink/20 active:scale-[0.99] shadow-2xs"
              disabled={cookieTrap}
              onClick={() => {
                const githubUrl = inviteToken
                  ? `/api/v1/auth/github?invite=${encodeURIComponent(inviteToken)}`
                  : "/api/v1/auth/github";
                window.location.href = githubUrl;
              }}
            >
              <GitHubIcon className="size-4 shrink-0 text-ink" />
              <span>Continue with GitHub</span>
            </Button>
          )}

          {/* Official Google OAuth Button */}
          {googleEnabled && (
            <Button
              variant="outline"
              size="lg"
              type="button"
              className="w-full justify-center gap-2.5 border-border bg-surface text-ink font-medium transition-all hover:bg-bg-subtle hover:border-ink/20 active:scale-[0.99] shadow-2xs"
              disabled={cookieTrap}
              onClick={() => {
                const googleUrl = inviteToken
                  ? `/api/v1/auth/google?invite=${encodeURIComponent(inviteToken)}`
                  : "/api/v1/auth/google";
                window.location.href = googleUrl;
              }}
            >
              <GoogleIcon className="size-4 shrink-0" />
              <span>Continue with Google</span>
            </Button>
          )}

          {!githubEnabled && !googleEnabled && (
            <div className="rounded-lg border border-border bg-bg-subtle p-3 text-center text-xs text-ink-muted">
              No OAuth providers currently enabled. Contact your workspace administrator.
            </div>
          )}

          <p className="mt-3 text-center text-2xs text-ink-muted/80">
            Password authentication is disabled. Sign in via your GitHub or Google account.
          </p>
        </div>
      </Card>
    </div>
  );
}

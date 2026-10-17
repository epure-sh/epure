import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  fetchOAuthInfo,
  submitOAuthAuthorize,
  type OAuthInfoOrg,
} from "../../lib/api";
import { Button } from "../../ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../../ui/card";
import { EpureBrandMark } from "../../ui/logo";
import { Bot, Check, ShieldCheck, Terminal, AlertTriangle } from "lucide-react";

export function AuthorizeView() {
  const [searchParams] = useSearchParams();
  const clientId = searchParams.get("client_id") || "";
  const clientName = searchParams.get("client_name") || clientId;
  const redirectUri = searchParams.get("redirect_uri") || "";
  const codeChallenge = searchParams.get("code_challenge") || "";
  const codeChallengeMethod = searchParams.get("code_challenge_method") || "S256";
  const scopeParam = searchParams.get("scope") || "read:agent write:triage";
  const state = searchParams.get("state") || "";

  const scopes = scopeParam.split(/\s+/).filter(Boolean);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orgs, setOrgs] = useState<OAuthInfoOrg[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");

  useEffect(() => {
    if (!clientId) {
      setError("Missing required parameter: client_id");
      setLoading(false);
      return;
    }
    if (!redirectUri) {
      setError("Missing required parameter: redirect_uri");
      setLoading(false);
      return;
    }
    if (!codeChallenge) {
      setError("Missing required parameter: code_challenge (PKCE is required)");
      setLoading(false);
      return;
    }

    fetchOAuthInfo(clientId, redirectUri)
      .then((info) => {
        setOrgs(info.organizations);
        setSelectedOrgId(info.current_org_id || info.organizations[0]?.id || "");
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load authorization details");
        setLoading(false);
      });
  }, [clientId, redirectUri, codeChallenge]);

  async function handleAuthorize() {
    if (!selectedOrgId) {
      setError("Please select an organization");
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const res = await submitOAuthAuthorize({
        client_id: clientId,
        client_name: clientName,
        org_id: selectedOrgId,
        redirect_uri: redirectUri,
        code_challenge: codeChallenge,
        code_challenge_method: codeChallengeMethod,
        scopes,
        state: state || undefined,
      });

      // Redirect back to client callback
      window.location.href = res.redirect_uri;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authorization failed");
      setSubmitting(false);
    }
  }

  function handleCancel() {
    if (!redirectUri) {
      window.close();
      return;
    }
    const delimiter = redirectUri.includes("?") ? "&" : "?";
    let url = `${redirectUri}${delimiter}error=access_denied&error_description=User+cancelled+authorization`;
    if (state) {
      url += `&state=${encodeURIComponent(state)}`;
    }
    window.location.href = url;
  }

  const isCli = clientId.toLowerCase().includes("cli");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-4 py-12">
      <div className="mb-6 flex items-center gap-3">
        <EpureBrandMark className="h-8 w-8" />
        <span className="font-mono text-sm tracking-widest uppercase text-ink-muted">
          Epure Connect
        </span>
      </div>

      <Card className="w-full max-w-md shadow-xl border-border bg-surface">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface-muted/60 text-accent">
            {isCli ? <Terminal size={24} /> : <Bot size={24} />}
          </div>
          <CardTitle className="text-xl">Authorize {clientName}</CardTitle>
          <CardDescription className="text-xs mt-1">
            <span className="font-mono font-medium text-ink">{clientName}</span> is requesting access to your Epure account.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-lg border border-state-error/40 bg-state-error/10 p-3 text-xs text-state-error flex items-start gap-2">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="py-8 text-center text-sm text-ink-muted">
              Loading authorization context…
            </div>
          ) : (
            <>
              {/* Workspace selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  Select Workspace / Organization
                </label>
                <select
                  value={selectedOrgId}
                  onChange={(e) => setSelectedOrgId(e.target.value)}
                  className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  {orgs.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name} ({org.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Scopes requested */}
              <div className="space-y-2 pt-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  Requested Permissions
                </label>
                <div className="rounded-lg border border-border/70 bg-bg/40 p-3 space-y-2">
                  {scopes.includes("read:agent") && (
                    <div className="flex items-start gap-2 text-xs">
                      <Check size={14} className="text-state-success shrink-0 mt-0.5" />
                      <div>
                        <span className="font-medium text-ink">Read Telemetry</span>
                        <p className="text-[11px] text-ink-muted">Read issues, stack traces, and project metadata.</p>
                      </div>
                    </div>
                  )}
                  {scopes.includes("write:triage") && (
                    <div className="flex items-start gap-2 text-xs">
                      <Check size={14} className="text-state-success shrink-0 mt-0.5" />
                      <div>
                        <span className="font-medium text-ink">Triage Issues</span>
                        <p className="text-[11px] text-ink-muted">Resolve, snooze, ignore, and merge issue groups.</p>
                      </div>
                    </div>
                  )}
                  {scopes.includes("write:admin") && (
                    <div className="flex items-start gap-2 text-xs">
                      <Check size={14} className="text-state-success shrink-0 mt-0.5" />
                      <div>
                        <span className="font-medium text-ink">Administer Workspace</span>
                        <p className="text-[11px] text-ink-muted">Create projects, manage alerts, and update configurations.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1 text-[11px] text-ink-subtle">
                <ShieldCheck size={13} className="shrink-0 text-accent" />
                <span>Redirects safely to <code className="font-mono text-ink-muted truncate max-w-[240px]">{redirectUri}</code></span>
              </div>
            </>
          )}
        </CardContent>

        <CardFooter className="flex items-center justify-between gap-3 pt-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={submitting}
            className="w-1/2"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleAuthorize}
            disabled={loading || submitting || !selectedOrgId}
            className="w-1/2"
          >
            {submitting ? "Authorizing…" : "Authorize"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

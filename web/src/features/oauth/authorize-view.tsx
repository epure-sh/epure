import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
  fetchOAuthInfo,
  submitOAuthAuthorize,
  type OAuthInfoOrg,
} from "../../lib/api";
import { Button } from "../../ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../../ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EpureBrandMark } from "../../ui/logo";
import { Bot, Check, ShieldCheck, Terminal, AlertTriangle, ArrowRight } from "lucide-react";

export function AuthorizeView() {
  const [searchParams] = useSearchParams();
  const clientId = searchParams.get("client_id") || "";
  const clientName = searchParams.get("client_name") || clientId || "AI Coding Assistant";
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

  const handleAuthorize = useCallback(async () => {
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
  }, [clientId, clientName, selectedOrgId, redirectUri, codeChallenge, codeChallengeMethod, scopes, state]);

  const handleCancel = useCallback(() => {
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
  }, [redirectUri, state]);

  // Keyboard shortcut: Enter to Approve, Esc to Cancel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return;
      }
      if (e.key === "Enter" && !loading && !submitting && selectedOrgId) {
        e.preventDefault();
        void handleAuthorize();
      } else if (e.key === "Escape" && !submitting) {
        e.preventDefault();
        handleCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [loading, submitting, selectedOrgId, handleAuthorize, handleCancel]);

  const isCli = clientId.toLowerCase().includes("cli");
  const isCursor = clientId.toLowerCase().includes("cursor") || clientName.toLowerCase().includes("cursor");
  const isClaude = clientId.toLowerCase().includes("claude") || clientName.toLowerCase().includes("claude");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-base px-4 py-12 select-none">
      <div className="mb-6 flex items-center gap-3">
        <EpureBrandMark className="h-8 w-8" />
        <span className="font-mono text-sm tracking-widest uppercase text-fg-muted">
          Epure Connect
        </span>
      </div>

      <Card className="w-full max-w-md shadow-float border-border-strong bg-surface-1">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-border-subtle bg-surface-2 text-accent">
            {isCli ? (
              <Terminal size={24} />
            ) : isCursor || isClaude ? (
              <Bot size={24} className="text-accent" />
            ) : (
              <Bot size={24} />
            )}
          </div>
          <CardTitle className="text-lg font-semibold tracking-tight text-fg-primary">
            Authorize {clientName}
          </CardTitle>
          <CardDescription className="text-xs mt-1 text-fg-muted">
            <span className="font-mono font-medium text-fg-primary">{clientName}</span> is requesting PKCE access to your Epure triage workspace.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-lg border border-semantic-danger/40 bg-semantic-danger/10 p-3 text-xs text-semantic-danger flex items-start gap-2">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="py-8 text-center text-sm text-fg-muted">
              Loading authorization context…
            </div>
          ) : (
            <>
              {/* Workspace selector */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
                  Select Workspace / Organization
                </label>
                <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                  <SelectTrigger size="sm" className="w-full">
                    <SelectValue placeholder="Select workspace" />
                  </SelectTrigger>
                  <SelectContent>
                    {orgs.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name} ({org.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Scopes requested */}
              <div className="space-y-2 pt-2">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
                  Requested Capabilities
                </label>
                <div className="rounded-lg border border-border-subtle bg-surface-2/40 p-3 space-y-2.5">
                  {scopes.includes("read:agent") && (
                    <div className="flex items-start gap-2 text-xs">
                      <Check size={14} className="text-healthy shrink-0 mt-0.5 stroke-[2.5]" />
                      <div>
                        <span className="font-medium text-fg-primary">Read Telemetry</span>
                        <p className="text-[11px] text-fg-muted">Read issues, stack traces, and breadcrumb context for AI diagnosis.</p>
                      </div>
                    </div>
                  )}
                  {scopes.includes("write:triage") && (
                    <div className="flex items-start gap-2 text-xs">
                      <Check size={14} className="text-healthy shrink-0 mt-0.5 stroke-[2.5]" />
                      <div>
                        <span className="font-medium text-fg-primary">Triage & Fix Exceptions</span>
                        <p className="text-[11px] text-fg-muted">Resolve, snooze, and attach automated bug fix pull requests.</p>
                      </div>
                    </div>
                  )}
                  {scopes.includes("write:admin") && (
                    <div className="flex items-start gap-2 text-xs">
                      <Check size={14} className="text-healthy shrink-0 mt-0.5 stroke-[2.5]" />
                      <div>
                        <span className="font-medium text-fg-primary">Administer Workspace</span>
                        <p className="text-[11px] text-fg-muted">Create projects, manage alert rules, and update DSN keys.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1 text-[11px] text-fg-muted">
                <ShieldCheck size={13} className="shrink-0 text-accent" />
                <span>Redirects safely to <code className="font-mono text-fg-secondary truncate max-w-[240px]">{redirectUri}</code></span>
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
            Cancel (Esc)
          </Button>
          <Button
            variant="primary"
            onClick={() => void handleAuthorize()}
            disabled={loading || submitting || !selectedOrgId}
            className="w-1/2 gap-1.5 shadow-tactile font-medium"
          >
            {submitting ? (
              "Approving…"
            ) : (
              <>
                <span>Approve</span>
                <kbd className="rounded bg-primary-fg/20 px-1 py-0.5 font-mono text-[10px] text-primary-fg">
                  ⏎
                </kbd>
                <ArrowRight className="size-3.5 ml-0.5" />
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

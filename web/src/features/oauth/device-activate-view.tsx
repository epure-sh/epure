import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  approveDeviceCode,
  fetchOAuthInfo,
  verifyDeviceCode,
  type DeviceVerifyResponse,
  type OAuthInfoOrg,
} from "../../lib/api";
import { Button } from "../../ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../../ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EpureBrandMark } from "../../ui/logo";
import { Badge } from "../../ui/badge";
import { AlertTriangle, CheckCircle2, Terminal } from "lucide-react";

export function DeviceActivateView() {
  const [searchParams] = useSearchParams();
  const initialCode = searchParams.get("user_code") || "";

  const [code, setCode] = useState(initialCode);
  const [verifying, setVerifying] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<DeviceVerifyResponse | null>(null);
  const [orgs, setOrgs] = useState<OAuthInfoOrg[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [success, setSuccess] = useState(false);

  function formatUserCode(raw: string): string {
    const clean = raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 8);
    if (clean.length > 4) {
      return `${clean.slice(0, 4)}-${clean.slice(4)}`;
    }
    return clean;
  }

  function handleCodeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const formatted = formatUserCode(e.target.value);
    setCode(formatted);
    setError(null);
    if (formatted.length < 9) {
      setDeviceInfo(null);
    }
  }

  useEffect(() => {
    const clean = code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    if (clean.length === 8 && !deviceInfo && !success) {
      const formatted = `${clean.slice(0, 4)}-${clean.slice(4)}`;
      setVerifying(true);
      setError(null);

      Promise.all([
        verifyDeviceCode(formatted),
        fetchOAuthInfo("device"),
      ])
        .then(([dev, info]) => {
          setDeviceInfo(dev);
          setOrgs(info.organizations);
          setSelectedOrgId(info.current_org_id || info.organizations[0]?.id || "");
          setVerifying(false);
        })
        .catch(() => {
          setError("Code is invalid, already used, or expired. Please check your terminal.");
          setVerifying(false);
        });
    }
  }, [code, deviceInfo, success]);

  async function handleApprove() {
    if (!deviceInfo || !selectedOrgId) {
      return;
    }
    setApproving(true);
    setError(null);

    try {
      await approveDeviceCode(deviceInfo.user_code, selectedOrgId);
      setSuccess(true);
    } catch {
      setError("Failed to approve device. It may have expired.");
    } finally {
      setApproving(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-4 py-12">
      <div className="mb-6 flex items-center gap-3">
        <EpureBrandMark className="h-8 w-8" />
        <span className="font-mono text-sm tracking-widest uppercase text-ink-muted">
          Epure Device Activation
        </span>
      </div>

      <Card className="w-full max-w-md shadow-xl border-border bg-surface">
        {success ? (
          <div className="p-8 text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-state-success/15 text-state-success border border-state-success/30">
              <CheckCircle2 size={32} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-ink">Device Connected!</h2>
              <p className="mt-1.5 text-xs text-ink-muted">
                Your CLI or headless agent session has been approved. You can safely close this browser window and return to your terminal.
              </p>
            </div>
          </div>
        ) : (
          <>
            <CardHeader className="text-center pb-4">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface-muted/60 text-accent">
                <Terminal size={24} />
              </div>
              <CardTitle className="text-xl">Connect a Device</CardTitle>
              <CardDescription className="text-xs mt-1">
                Enter the 8-character confirmation code displayed on your CLI or server.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {error && (
                <div className="rounded-lg border border-state-error/40 bg-state-error/10 p-3 text-xs text-state-error flex items-start gap-2">
                  <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Code input */}
              <div className="space-y-1.5 text-center">
                <Input
                  type="text"
                  value={code}
                  onChange={handleCodeChange}
                  placeholder="ABCD-1234"
                  maxLength={9}
                  autoFocus
                  disabled={Boolean(deviceInfo) || verifying}
                  className="text-center font-mono text-xl font-bold tracking-widest uppercase h-10"
                />
                {verifying && (
                  <p className="text-xs text-ink-muted animate-pulse">Verifying code with server…</p>
                )}
              </div>

              {deviceInfo && (
                <div className="space-y-4 pt-2 border-t border-border">
                  <div className="rounded-lg border border-border/80 bg-bg/50 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-ink-muted">Device / Client</span>
                      <span className="text-xs font-medium text-ink font-mono">{deviceInfo.client_name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-ink-muted">Requested Scopes</span>
                      <div className="flex gap-1">
                        {deviceInfo.scopes.map((s) => (
                          <Badge key={s} variant="secondary" className="text-[10px] px-1.5 py-0">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Workspace selector */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      Authorize for Workspace
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
                </div>
              )}
            </CardContent>

            <CardFooter className="flex items-center justify-between gap-3 pt-2">
              {deviceInfo ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDeviceInfo(null);
                      setCode("");
                    }}
                    disabled={approving}
                    className="w-1/2"
                  >
                    Change Code
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleApprove}
                    disabled={approving || !selectedOrgId}
                    className="w-1/2"
                  >
                    {approving ? "Approving…" : "Approve Device"}
                  </Button>
                </>
              ) : (
                <div className="w-full text-center text-xs text-ink-muted">
                  Waiting for complete 8-character code…
                </div>
              )}
            </CardFooter>
          </>
        )}
      </Card>
    </div>
  );
}

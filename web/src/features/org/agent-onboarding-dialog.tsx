import { useMemo, useState } from "react";
import { Copy, Check, Terminal, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AgentVendorAvatars } from "@/ui/components/agent-vendor-avatars";
import { toast } from "@/components/ui/sonner";
import { workspaceSettingsPath } from "@/lib/paths";

export interface AgentOnboardingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type AgentTab = "claude" | "cursor" | "vscode" | "cli";

export function AgentOnboardingDialog({ open, onOpenChange }: AgentOnboardingDialogProps) {
  const [activeTab, setActiveTab] = useState<AgentTab>("claude");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "https://app.epure.sh";

  const claudeCommand = `claude mcp add epure --env EPURE_URL=${origin} -- npx -y @epure/mcp@latest`;
  const cliCommand = `npx -y @epure/cli login --url ${origin}`;

  const cursorConfigJson = useMemo(() => {
    return JSON.stringify(
      {
        mcpServers: {
          epure: {
            command: "npx",
            args: ["-y", "@epure/mcp@latest"],
            env: {
              EPURE_URL: origin,
            },
          },
        },
      },
      null,
      2,
    );
  }, [origin]);

  const vscodeConfigJson = useMemo(() => {
    return JSON.stringify(
      {
        "mcp.servers": {
          epure: {
            command: "npx",
            args: ["-y", "@epure/mcp@latest"],
            env: {
              EPURE_URL: origin,
            },
          },
        },
      },
      null,
      2,
    );
  }, [origin]);

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl sm:max-w-2xl p-6">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2">
            <AgentVendorAvatars size={22} />
            <DialogTitle className="text-base font-semibold text-fg-primary">
              Onboard your AI Coding Agent
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-fg-muted">
            Connect Claude Code, Cursor, VS Code, or terminal agents to Epure via surgical MCP. Inspect exceptions, retrieve stack traces, and triage bugs directly from your editor.
          </DialogDescription>
        </DialogHeader>

        {/* Tab selection */}
        <div className="mt-3 flex flex-wrap gap-1.5 border-b border-border-subtle pb-3">
          <Button
            type="button"
            variant={activeTab === "claude" ? "primary" : "ghost"}
            size="xs"
            onClick={() => setActiveTab("claude")}
            className="gap-1.5"
          >
            <span className="size-2 rounded-full bg-[#D97757]" />
            Claude Code
          </Button>
          <Button
            type="button"
            variant={activeTab === "cursor" ? "primary" : "ghost"}
            size="xs"
            onClick={() => setActiveTab("cursor")}
            className="gap-1.5"
          >
            <span className="size-2 rounded-full bg-fg-primary" />
            Cursor
          </Button>
          <Button
            type="button"
            variant={activeTab === "vscode" ? "primary" : "ghost"}
            size="xs"
            onClick={() => setActiveTab("vscode")}
            className="gap-1.5"
          >
            <span className="size-2 rounded-full bg-blue-500" />
            VS Code
          </Button>
          <Button
            type="button"
            variant={activeTab === "cli" ? "primary" : "ghost"}
            size="xs"
            onClick={() => setActiveTab("cli")}
            className="gap-1.5"
          >
            <Terminal className="size-3" />
            Epure CLI
          </Button>
        </div>

        {/* Tab contents */}
        <div className="mt-3 min-h-[160px] space-y-3">
          {activeTab === "claude" && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-fg-primary">
                  1-Click Claude Code Setup
                </p>
                <Badge variant="neutral" size="sm">
                  Recommended
                </Badge>
              </div>
              <p className="text-2xs text-fg-muted">
                Run this single command in your terminal inside your project directory to register Epure MCP with Claude Code.
              </p>
              <div className="relative rounded-md border border-border-subtle bg-surface-2 p-3 font-mono text-xs text-fg-primary">
                <pre className="overflow-x-auto whitespace-pre-wrap break-all pr-12">
                  {claudeCommand}
                </pre>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon-xs"
                  className="absolute right-2 top-2"
                  onClick={() => handleCopy(claudeCommand, "claude")}
                  title="Copy command"
                >
                  {copiedKey === "claude" ? (
                    <Check className="size-3.5 text-healthy" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </Button>
              </div>
            </div>
          )}

          {activeTab === "cursor" && (
            <div className="space-y-2.5">
              <p className="text-xs font-medium text-fg-primary">
                Cursor MCP Configuration
              </p>
              <p className="text-2xs text-fg-muted">
                Add to your project’s <code className="rounded bg-surface-2 px-1 py-0.5 text-2xs">.cursor/mcp.json</code> or paste into Cursor Settings → Features → MCP:
              </p>
              <div className="relative rounded-md border border-border-subtle bg-surface-2 p-3 font-mono text-xs text-fg-primary">
                <pre className="max-h-40 overflow-y-auto whitespace-pre font-mono text-[11px]">
                  {cursorConfigJson}
                </pre>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon-xs"
                  className="absolute right-2 top-2"
                  onClick={() => handleCopy(cursorConfigJson, "cursor")}
                  title="Copy JSON"
                >
                  {copiedKey === "cursor" ? (
                    <Check className="size-3.5 text-healthy" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </Button>
              </div>
            </div>
          )}

          {activeTab === "vscode" && (
            <div className="space-y-2.5">
              <p className="text-xs font-medium text-fg-primary">
                VS Code / GitHub Copilot MCP
              </p>
              <p className="text-2xs text-fg-muted">
                Place this in your workspace <code className="rounded bg-surface-2 px-1 py-0.5 text-2xs">.vscode/mcp.json</code>:
              </p>
              <div className="relative rounded-md border border-border-subtle bg-surface-2 p-3 font-mono text-xs text-fg-primary">
                <pre className="max-h-40 overflow-y-auto whitespace-pre font-mono text-[11px]">
                  {vscodeConfigJson}
                </pre>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon-xs"
                  className="absolute right-2 top-2"
                  onClick={() => handleCopy(vscodeConfigJson, "vscode")}
                  title="Copy JSON"
                >
                  {copiedKey === "vscode" ? (
                    <Check className="size-3.5 text-healthy" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </Button>
              </div>
            </div>
          )}

          {activeTab === "cli" && (
            <div className="space-y-2.5">
              <p className="text-xs font-medium text-fg-primary">
                Epure CLI Fast Auth
              </p>
              <p className="text-2xs text-fg-muted">
                Authenticate your local command line with your Epure workspace in one command:
              </p>
              <div className="relative rounded-md border border-border-subtle bg-surface-2 p-3 font-mono text-xs text-fg-primary">
                <pre className="overflow-x-auto whitespace-pre-wrap break-all pr-12">
                  {cliCommand}
                </pre>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon-xs"
                  className="absolute right-2 top-2"
                  onClick={() => handleCopy(cliCommand, "cli")}
                  title="Copy command"
                >
                  {copiedKey === "cli" ? (
                    <Check className="size-3.5 text-healthy" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer info & link */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-3">
          <Link
            to={workspaceSettingsPath("agent")}
            className="inline-flex items-center gap-1 text-2xs text-fg-muted hover:text-fg-primary hover:underline"
            onClick={() => onOpenChange(false)}
          >
            <span>Manage OAuth sessions &amp; agent tokens</span>
            <ExternalLink className="size-3" />
          </Link>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

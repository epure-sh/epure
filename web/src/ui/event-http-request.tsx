import { Check, Copy } from "lucide-react";
import { useState } from "react";
import type { EventDetail } from "../lib/api";
import { Badge } from "./badge";
import { Button } from "./button";
import { useToast } from "./toast-provider";

export interface ParsedHttpRequest {
  method: string;
  url: string;
  path: string;
  status: number | null;
  headers: Record<string, string>;
  body: string | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringifyBody(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function pathFromUrl(url: string): string {
  try {
    const parsed = new URL(url, "https://example.invalid");
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

export function parseEventHttpRequest(event: EventDetail | null): ParsedHttpRequest | null {
  if (!event) return null;
  const payload = event.payload_json ?? {};
  const request = asRecord(payload.request);
  if (!request) return null;

  const method = String(request.method ?? "GET").toUpperCase();
  const url = String(request.url ?? request.path ?? "");
  if (!url) return null;

  const headerBag = asRecord(request.headers) ?? {};
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(headerBag)) {
    if (value == null) continue;
    headers[key] = Array.isArray(value) ? value.map(String).join(", ") : String(value);
  }

  const contexts = asRecord(payload.contexts);
  const response = asRecord(contexts?.response) ?? asRecord(payload.response);
  const statusRaw = response?.status_code ?? response?.status ?? request.status_code;
  const status =
    typeof statusRaw === "number"
      ? statusRaw
      : typeof statusRaw === "string" && statusRaw.trim()
        ? Number.parseInt(statusRaw, 10)
        : null;

  return {
    method,
    url,
    path: pathFromUrl(url),
    status: Number.isFinite(status) ? status : null,
    headers,
    body: stringifyBody(request.data ?? request.body),
  };
}

function buildCurl(request: ParsedHttpRequest): string {
  const parts = [`curl -X ${request.method} ${JSON.stringify(request.url)}`];
  for (const [key, value] of Object.entries(request.headers)) {
    parts.push(`  -H ${JSON.stringify(`${key}: ${value}`)}`);
  }
  if (request.body) {
    parts.push(`  -d ${JSON.stringify(request.body)}`);
  }
  return parts.join(" \\\n");
}

export function EventHttpRequest({ event }: { event: EventDetail | null }) {
  const parsed = parseEventHttpRequest(event);
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  if (!parsed) {
    return null;
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildCurl(parsed));
      setCopied(true);
      toast("Copied cURL to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("Failed to copy cURL");
    }
  };

  return (
    <section className="space-y-2" aria-label="HTTP request">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-mono text-2xs uppercase tracking-wide text-fg-muted">HTTP request</h3>
        <Button type="button" variant="ghost" size="xs" onClick={() => void handleCopy()}>
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          Copy cURL
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="neutral" size="compact" className="font-mono font-normal">
          {parsed.method}
        </Badge>
        <code className="min-w-0 flex-1 font-mono text-xs text-fg-primary [overflow-wrap:anywhere]">
          {parsed.path}
        </code>
        {parsed.status != null ? (
          <Badge
            variant={parsed.status >= 400 ? "warning" : "healthy"}
            size="compact"
            className="font-mono font-normal"
          >
            {parsed.status}
          </Badge>
        ) : null}
      </div>
      {parsed.body ? (
        <pre className="max-h-48 overflow-auto rounded-md border border-border-subtle bg-surface-1 px-3 py-2 font-mono text-2xs leading-relaxed text-fg-secondary whitespace-pre-wrap shadow-xs [overflow-wrap:anywhere]">
          {parsed.body}
        </pre>
      ) : null}
    </section>
  );
}

/**
 * Optional print blocks on alert detail — gated by create-rule payload checkboxes.
 *
 * Layout helpers:
 * - Crash site + Request → top band beside the pipeline
 * - Stack → full-width hero under that band
 * - Remaining context → grid below the stack
 */
import type { ReactNode } from "react";
import { SectionCard } from "@/components/kit/section-card";
import { Badge } from "@/components/ui/badge";
import { SourceCodeBlock } from "@/ui/source-code-block";
import type { AlertRow } from "@/lib/api";
import { cn } from "@/lib/cn";
import {
  alertActionEnabled,
  getAlertPayloadContext,
  getAlertPayloadOptions,
  payloadBlockOn,
  payloadFrameLimit,
  payloadOptionOn,
  type AlertPayloadContext,
  type AlertPayloadOptions,
  type AlertStackFrame,
} from "./alert-payload-context";

function shortPath(filename: string): string {
  return filename.replace(/^webpack:\/\/\/?\.\//, "").replace(/^app:\/\//, "");
}

function frameLabel(frame: AlertStackFrame): string {
  const fn = frame.function?.trim() || "<anonymous>";
  const file = frame.filename ? shortPath(frame.filename) : "unknown";
  const loc =
    frame.lineno != null
      ? `:${frame.lineno}${frame.colno != null ? `:${frame.colno}` : ""}`
      : "";
  return `${fn} (${file}${loc})`;
}

function selectFrames(frames: AlertStackFrame[], options: AlertPayloadOptions): AlertStackFrame[] {
  let list = frames;
  if (payloadOptionOn(options, "stack:in_app")) {
    const inApp = list.filter((frame) => frame.in_app === true);
    if (inApp.length > 0) {
      list = inApp;
    }
  }
  const limit = payloadFrameLimit(options);
  return list.slice(-limit).reverse();
}

function crashingFrame(frames: AlertStackFrame[]): AlertStackFrame | null {
  // Frames are oldest-first; the crashing frame is the newest with source.
  const newestFirst = [...frames].reverse();
  const withLine = newestFirst.find((frame) => frame.context_line && frame.in_app !== false);
  return withLine ?? newestFirst.find((frame) => frame.context_line) ?? null;
}

function MonoPill({ children }: { children: string }) {
  return (
    <Badge variant="neutral" size="compact" className="max-w-full font-mono font-normal">
      <span className="[overflow-wrap:anywhere]">{children}</span>
    </Badge>
  );
}

function Kv({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-start gap-x-3">
      <dt className="pt-0.5 font-mono text-[10px] uppercase tracking-wide text-fg-muted">{label}</dt>
      <dd className="min-w-0 text-sm text-fg-primary">{children}</dd>
    </div>
  );
}

function CrashSiteCard({
  options,
  ctx,
}: {
  options: AlertPayloadOptions;
  ctx: AlertPayloadContext;
}) {
  if (!payloadBlockOn(options, "culprit")) {
    return null;
  }
  const showFile = payloadOptionOn(options, "culprit:file") && ctx.culpritFile;
  const showRoute = payloadOptionOn(options, "culprit:route") && ctx.culpritRoute;
  if (!showFile && !showRoute) {
    return null;
  }
  return (
    <SectionCard title="Crash site" className="flex h-full min-w-0 flex-1 flex-col">
      <dl className="flex flex-col gap-2.5">
        {showFile ? (
          <Kv label="File">
            <MonoPill>{ctx.culpritFile!}</MonoPill>
          </Kv>
        ) : null}
        {showRoute ? (
          <Kv label="Route">
            <MonoPill>{ctx.culpritRoute!}</MonoPill>
          </Kv>
        ) : null}
      </dl>
    </SectionCard>
  );
}

function RequestCard({
  options,
  ctx,
}: {
  options: AlertPayloadOptions;
  ctx: AlertPayloadContext;
}) {
  if (!payloadBlockOn(options, "request")) {
    return null;
  }
  const method = payloadOptionOn(options, "request:method") ? ctx.requestMethod : null;
  const url = payloadOptionOn(options, "request:url") ? ctx.requestUrl : null;
  if (!method && !url) {
    return null;
  }
  return (
    <SectionCard title="Request" className="flex h-full min-w-0 flex-1 flex-col">
      <dl className="flex flex-col gap-2.5">
        {method ? (
          <Kv label="Method">
            <MonoPill>{method}</MonoPill>
          </Kv>
        ) : null}
        {url ? (
          <Kv label="URL">
            <MonoPill>{url}</MonoPill>
          </Kv>
        ) : null}
      </dl>
    </SectionCard>
  );
}

function crashSiteVisible(options: AlertPayloadOptions, ctx: AlertPayloadContext): boolean {
  if (!payloadBlockOn(options, "culprit")) {
    return false;
  }
  const showFile = payloadOptionOn(options, "culprit:file") && Boolean(ctx.culpritFile);
  const showRoute = payloadOptionOn(options, "culprit:route") && Boolean(ctx.culpritRoute);
  return showFile || showRoute;
}

function requestVisible(options: AlertPayloadOptions, ctx: AlertPayloadContext): boolean {
  if (!payloadBlockOn(options, "request")) {
    return false;
  }
  const method = payloadOptionOn(options, "request:method") ? ctx.requestMethod : null;
  const url = payloadOptionOn(options, "request:url") ? ctx.requestUrl : null;
  return Boolean(method || url);
}

/** Crash site + Request side-by-side under the metrics grid. */
export function AlertDetailCrashRequestRow({
  alert,
  className,
}: {
  alert: AlertRow;
  className?: string;
}) {
  const options = getAlertPayloadOptions(alert);
  const ctx = getAlertPayloadContext(alert);
  const showCrash = crashSiteVisible(options, ctx);
  const showRequest = requestVisible(options, ctx);
  if (!showCrash && !showRequest) {
    return null;
  }
  return (
    <div className={cn("flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-stretch", className)}>
      {showCrash ? <CrashSiteCard options={options} ctx={ctx} /> : null}
      {showRequest ? <RequestCard options={options} ctx={ctx} /> : null}
    </div>
  );
}

/** Full-width stack under the metrics/pipeline band. */
export function AlertDetailStackBlock({
  alert,
  className,
}: {
  alert: AlertRow;
  className?: string;
}) {
  const options = getAlertPayloadOptions(alert);
  const ctx = getAlertPayloadContext(alert);
  // Hide only when the rule explicitly unchecked stack; empty options + frames still print.
  if (Object.keys(options).length > 0 && !payloadBlockOn(options, "stack_frames")) {
    return null;
  }
  if (ctx.frames.length === 0) {
    return null;
  }

  const frames = selectFrames(ctx.frames, options);
  if (frames.length === 0) {
    return null;
  }
  const showLine =
    Object.keys(options).length === 0 || payloadOptionOn(options, "stack:line");
  const crash = showLine ? crashingFrame(ctx.frames) : null;

  return (
    <SectionCard
      className={cn("w-full min-w-0", className)}
      title="Stack"
      description={
        payloadOptionOn(options, "stack:in_app") ? "In-app frames" : "Suspect frames"
      }
    >
      <div className="flex flex-col gap-3">
        {crash?.context_line && crash.filename ? (
          <SourceCodeBlock
            filename={shortPath(crash.filename)}
            functionName={crash.function}
            lineno={crash.lineno}
            colno={crash.colno}
            density="default"
            faultTone="accent"
            lines={[
              ...(crash.pre_context ?? []).map((text, index) => ({
                number: (crash.lineno ?? 1) - (crash.pre_context?.length ?? 0) + index,
                text,
              })),
              {
                number: crash.lineno ?? 1,
                text: crash.context_line,
                fault: true,
              },
              ...(crash.post_context ?? []).map((text, index) => ({
                number: (crash.lineno ?? 1) + 1 + index,
                text,
              })),
            ]}
          />
        ) : null}
        <ul className="m-0 flex list-none flex-col overflow-hidden rounded-md border border-border-subtle p-0">
          {frames.map((frame, index) => (
            <li
              key={`${frame.filename}-${frame.lineno}-${index}`}
              className={cn(
                "border-b border-border-subtle px-4 py-2.5 font-mono text-xs leading-relaxed text-fg-primary last:border-b-0",
                frame.in_app && "bg-surface-2/30",
              )}
            >
              <span className="text-fg-muted">at </span>
              {frameLabel(frame)}
            </li>
          ))}
        </ul>
      </div>
    </SectionCard>
  );
}

/** Remaining context cards (not crash/request/stack). */
export function AlertDetailContextGrid({
  alert,
  className,
}: {
  alert: AlertRow;
  className?: string;
}) {
  const options = getAlertPayloadOptions(alert);
  if (Object.keys(options).length === 0) {
    return null;
  }

  const ctx = getAlertPayloadContext(alert);
  const cards: ReactNode[] = [];

  if (payloadBlockOn(options, "affected_user")) {
    const email = payloadOptionOn(options, "person:email") ? ctx.userEmail : null;
    const key = payloadOptionOn(options, "person:key") ? ctx.userKey : null;
    if (email || key) {
      cards.push(
        <SectionCard key="person" title="Person">
          <dl className="flex flex-col gap-2.5">
            {email ? (
              <Kv label="Email">
                <span className="font-mono text-xs [overflow-wrap:anywhere]">{email}</span>
              </Kv>
            ) : null}
            {key ? (
              <Kv label="User key">
                <span className="font-mono text-xs [overflow-wrap:anywhere]">{key}</span>
              </Kv>
            ) : null}
          </dl>
        </SectionCard>,
      );
    }
  }

  if (payloadBlockOn(options, "breadcrumbs") && ctx.breadcrumbs.length > 0) {
    const crumbs = ctx.breadcrumbs.slice(-3);
    cards.push(
      <SectionCard key="breadcrumbs" title="Breadcrumbs" description="Last steps before the error">
        <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
          {crumbs.map((crumb, index) => (
            <li
              key={`${crumb.timestamp ?? index}-${crumb.message ?? ""}`}
              className="rounded-md border border-border-subtle bg-surface-2/40 px-2.5 py-1.5"
            >
              <div className="flex items-baseline gap-2">
                {crumb.category ? (
                  <span className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-fg-muted">
                    {crumb.category}
                  </span>
                ) : null}
                <span className="min-w-0 text-xs leading-snug text-fg-primary">
                  {crumb.message ?? "—"}
                </span>
              </div>
            </li>
          ))}
        </ol>
      </SectionCard>,
    );
  }

  if (payloadBlockOn(options, "runtime")) {
    const browser = payloadOptionOn(options, "runtime:browser") ? ctx.browser : null;
    const os = payloadOptionOn(options, "runtime:os") ? ctx.os : null;
    const runtime = payloadOptionOn(options, "runtime:name") ? ctx.runtime : null;
    if (browser || os || runtime) {
      cards.push(
        <SectionCard key="runtime" title="Runtime">
          <div className="flex flex-wrap gap-1.5">
            {browser ? <MonoPill>{browser}</MonoPill> : null}
            {os ? <MonoPill>{os}</MonoPill> : null}
            {runtime ? <MonoPill>{runtime}</MonoPill> : null}
          </div>
        </SectionCard>,
      );
    }
  }

  if (payloadBlockOn(options, "tags")) {
    const pills: { id: string; label: string; value: string }[] = [];
    if (payloadOptionOn(options, "tag:tenant") && ctx.tags.tenant) {
      pills.push({ id: "tenant", label: "tenant", value: ctx.tags.tenant });
    }
    if (payloadOptionOn(options, "tag:region") && ctx.tags.region) {
      pills.push({ id: "region", label: "region", value: ctx.tags.region });
    }
    if (payloadOptionOn(options, "tag:plan") && ctx.tags.plan) {
      pills.push({ id: "plan", label: "plan", value: ctx.tags.plan });
    }
    if (pills.length > 0) {
      cards.push(
        <SectionCard key="tags" title="Tags">
          <div className="flex flex-wrap gap-1.5">
            {pills.map((pill) => (
              <Badge key={pill.id} variant="env" size="compact" className="font-mono font-normal">
                {pill.label}:{pill.value}
              </Badge>
            ))}
          </div>
        </SectionCard>,
      );
    }
  }

  if (cards.length === 0) {
    return null;
  }

  return (
    <div className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3", className)}>
      {cards}
    </div>
  );
}

export { alertActionEnabled, getAlertPayloadOptions };

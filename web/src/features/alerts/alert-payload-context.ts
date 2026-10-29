/**
 * Resolve which optional print blocks a fired alert opted into, plus the
 * context snapshot those blocks can render.
 */
import type { AlertRow } from "@/lib/api";
import { DEFAULT_PAYLOAD } from "@/components/kit/create-alert-rule-model";

export type AlertPayloadOptions = Record<string, boolean>;

export type AlertStackFrame = {
  filename?: string;
  function?: string;
  lineno?: number;
  colno?: number;
  in_app?: boolean;
  context_line?: string;
  pre_context?: string[];
  post_context?: string[];
};

export type AlertBreadcrumb = {
  category?: string;
  message?: string;
  level?: string;
  timestamp?: number;
};

export type AlertPayloadContext = {
  frames: AlertStackFrame[];
  breadcrumbs: AlertBreadcrumb[];
  culpritFile: string | null;
  culpritRoute: string | null;
  requestMethod: string | null;
  requestUrl: string | null;
  userEmail: string | null;
  userKey: string | null;
  browser: string | null;
  os: string | null;
  runtime: string | null;
  tags: { tenant?: string; region?: string; plan?: string };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asBoolMap(value: unknown): AlertPayloadOptions {
  if (!isRecord(value)) {
    return {};
  }
  const out: AlertPayloadOptions = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "boolean") {
      out[key] = item;
    }
  }
  return out;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asFrames(value: unknown): AlertStackFrame[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is AlertStackFrame => isRecord(item));
}

function asBreadcrumbs(value: unknown): AlertBreadcrumb[] {
  let list: unknown[] = [];
  if (Array.isArray(value)) {
    list = value;
  } else if (isRecord(value) && Array.isArray(value.values)) {
    list = value.values;
  }
  return list.filter((item): item is AlertBreadcrumb => isRecord(item));
}

/**
 * Checkbox map stored on the fire (`payload_options` / `payload`).
 * Missing map falls back to create-rule defaults when a context snapshot exists,
 * so seeded / older fires still render print blocks.
 */
export function getAlertPayloadOptions(alert?: AlertRow | null): AlertPayloadOptions {
  if (!alert) {
    return {};
  }
  const payload = alert.payload_json ?? {};
  const stored = asBoolMap(payload.payload_options ?? payload.payload);
  if (Object.keys(stored).length > 0) {
    return stored;
  }
  const context = isRecord(payload.context) ? payload.context : null;
  const hasContext =
    context != null ||
    Array.isArray(payload.stack_frames) ||
    payload.breadcrumbs != null ||
    typeof payload.culprit === "string" ||
    isRecord(payload.exception);
  return hasContext ? { ...DEFAULT_PAYLOAD } : {};
}

export function payloadOptionOn(options: AlertPayloadOptions, id: string): boolean {
  return options[id] === true;
}

/** Parent block on + any required child still gated by callers. */
export function payloadBlockOn(options: AlertPayloadOptions, blockId: string): boolean {
  return options[blockId] === true;
}

export function payloadFrameLimit(options: AlertPayloadOptions): number {
  if (options["stack:frames:5"]) return 5;
  if (options["stack:frames:1"]) return 1;
  if (options["stack:frames:3"]) return 3;
  return 3;
}

function framesFromException(value: unknown): AlertStackFrame[] {
  if (!isRecord(value)) {
    return [];
  }
  const values = Array.isArray(value.values) ? value.values : [];
  const first = values.find((item) => isRecord(item));
  if (!isRecord(first)) {
    return [];
  }
  const stacktrace = isRecord(first.stacktrace) ? first.stacktrace : null;
  return asFrames(stacktrace?.frames);
}

export function getAlertPayloadContext(alert?: AlertRow | null): AlertPayloadContext {
  const empty: AlertPayloadContext = {
    frames: [],
    breadcrumbs: [],
    culpritFile: null,
    culpritRoute: null,
    requestMethod: null,
    requestUrl: null,
    userEmail: null,
    userKey: null,
    browser: null,
    os: null,
    runtime: null,
    tags: {},
  };
  if (!alert) {
    return empty;
  }

  const payload = alert.payload_json ?? {};
  const context = isRecord(payload.context) ? payload.context : {};

  const storedFrames = asFrames(context.stack_frames ?? payload.stack_frames);
  const frames =
    storedFrames.length > 0
      ? storedFrames
      : framesFromException(context.exception ?? payload.exception);
  const breadcrumbs = asBreadcrumbs(context.breadcrumbs ?? payload.breadcrumbs);

  const tagsRaw = isRecord(context.tags)
    ? context.tags
    : isRecord(payload.tags)
      ? payload.tags
      : {};

  return {
    frames,
    breadcrumbs,
    culpritFile:
      asString(context.culprit_file) ??
      asString(context.culprit) ??
      asString(payload.culprit),
    culpritRoute:
      asString(context.route) ??
      asString(context.transaction) ??
      asString(payload.transaction) ??
      asString(payload.route),
    requestMethod: asString(context.request_method) ?? asString(payload.request_method),
    requestUrl: asString(context.request_url) ?? asString(payload.request_url),
    userEmail: asString(context.user_email) ?? asString(payload.user_email),
    userKey: asString(context.user_id) ?? asString(payload.user_id),
    browser: asString(context.browser) ?? asString(payload.browser),
    os: asString(context.os) ?? asString(payload.os),
    runtime: asString(context.runtime) ?? asString(payload.runtime),
    tags: {
      tenant: asString(tagsRaw.tenant) ?? undefined,
      region: asString(tagsRaw.region) ?? undefined,
      plan: asString(tagsRaw.plan) ?? undefined,
    },
  };
}

/** Header action visibility — missing options map keeps legacy “show all”. */
export function alertActionEnabled(
  options: AlertPayloadOptions,
  actionId: "action:view" | "action:fix" | "action:resolve" | "action:mute",
): boolean {
  if (Object.keys(options).length === 0) {
    return true;
  }
  if (options.actions === false) {
    return false;
  }
  return options[actionId] !== false;
}

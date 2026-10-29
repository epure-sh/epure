import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EpureBrandIcon, LOGO_CANONICAL_VARIANT, LOGO_VARIANT_NAMES, LogoMark } from "@/ui/logo";
import { PreviewBlock, PreviewRow } from "../shared";

const EDITABLE_COLOR_TOKENS = [
  { cssVar: "--accent", label: "Accent", hint: "Primary actions, focus, unread cue" },
  { cssVar: "--accent-muted", label: "Accent muted", hint: "Selected wash" },
  { cssVar: "--bg", label: "Canvas", hint: "Page paper" },
  { cssVar: "--bg-subtle", label: "Canvas subtle", hint: "Rail / inset wash" },
  { cssVar: "--surface", label: "Surface", hint: "Cards, panels" },
  { cssVar: "--text", label: "Ink", hint: "Primary type" },
  { cssVar: "--danger", label: "Danger", hint: "Critical / escalating" },
  { cssVar: "--success", label: "Success", hint: "Healthy" },
  { cssVar: "--warning", label: "Warning", hint: "Regression / caution" },
] as const;

function readCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Best-effort normalize to #rrggbb for <input type="color">. */
function toColorInputValue(raw: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw;
  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    const r = raw[1];
    const g = raw[2];
    const b = raw[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return "#4f46e5";
}

function TokenSwatch({ cssVar, fallback }: { cssVar: string; fallback: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.background = fallback || `var(${cssVar})`;
  }, [cssVar, fallback]);
  return (
    <div
      ref={ref}
      className="size-5 shrink-0 rounded-xs border border-border-subtle"
      aria-hidden
    />
  );
}

function LiveTokenCraft() {
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [dirty, setDirty] = React.useState(false);

  const refresh = React.useCallback(() => {
    const next: Record<string, string> = {};
    for (const token of EDITABLE_COLOR_TOKENS) {
      next[token.cssVar] = readCssVar(token.cssVar);
    }
    setValues(next);
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const apply = (cssVar: string, value: string) => {
    document.documentElement.style.setProperty(cssVar, value);
    setValues((prev) => ({ ...prev, [cssVar]: value }));
    setDirty(true);
  };

  const reset = () => {
    for (const token of EDITABLE_COLOR_TOKENS) {
      document.documentElement.style.removeProperty(token.cssVar);
    }
    setDirty(false);
    requestAnimationFrame(refresh);
  };

  return (
    <PreviewBlock
      id="brand-tokens"
      title="Live token craft"
      description="Writes CSS variables on :root for this session. Product routes inherit immediately because they consume the same tokens. Persist by editing design/themes/orbit.css (or design/tokens.css for type/space/motion/chrome)."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {EDITABLE_COLOR_TOKENS.map((token) => {
          const raw = values[token.cssVar] ?? "";
          const picker = toColorInputValue(raw.startsWith("#") ? raw : readCssVar(token.cssVar));
          return (
            <div
              key={token.cssVar}
              className="space-y-1.5 rounded-control border border-border-subtle bg-surface-2/30 p-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor={`tok-${token.cssVar}`} className="text-xs text-fg-primary">
                  {token.label}
                </Label>
                <TokenSwatch cssVar={token.cssVar} fallback={raw} />
              </div>
              <p className="font-mono text-[10px] text-fg-muted">{token.cssVar}</p>
              <p className="text-[10px] text-fg-muted">{token.hint}</p>
              <div className="flex items-center gap-2">
                <Input
                  id={`tok-color-${token.cssVar}`}
                  type="color"
                  size="sm"
                  wrapperClassName="h-8 w-10 shrink-0 p-0.5"
                  className="cursor-pointer"
                  value={picker}
                  onChange={(e) => apply(token.cssVar, e.target.value)}
                  aria-label={`${token.label} color`}
                />
                <Input
                  id={`tok-${token.cssVar}`}
                  size="sm"
                  className="font-mono text-[11px]"
                  value={raw}
                  onChange={(e) => apply(token.cssVar, e.target.value)}
                  spellCheck={false}
                />
              </div>
            </div>
          );
        })}
      </div>
      <PreviewRow label="Session" className="mt-3">
        <Button type="button" size="sm" variant="outline" onClick={reset} disabled={!dirty}>
          Reset session overrides
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={refresh}>
          Re-read computed
        </Button>
      </PreviewRow>
    </PreviewBlock>
  );
}

const SHOWCASE_VARIANTS = [18, 7, 1, 8, 9, 5] as const;

export function BrandSection() {
  return (
    <section className="space-y-4">
      <header className="space-y-2 border-b border-border-subtle pb-3">
        <p className="font-mono text-[10px] uppercase tracking-wide text-fg-muted">Brand</p>
        <h2 className="epure-page-title text-fg-primary">Calm Ledger identity</h2>
        <p className="max-w-2xl text-xs leading-relaxed text-fg-muted">
          Epure is an error-tracking instrument on Polar Orbit: cool gray/polar canvas, indigo accent, Inter + Geist Mono.
          Vision — surface pure signal from exception noise. Mission — triage and resolve with
          operational calm, never marketing chrome. Changing tokens here updates every surface that
          imports <code className="font-mono text-[11px]">@/components/ui</code>,{" "}
          <code className="font-mono text-[11px]">kit</code>, and{" "}
          <code className="font-mono text-[11px]">src/ui</code>.
        </p>
      </header>

      <PreviewBlock
        id="brand-voice"
        title="Voice & type roles"
        description="Sentence case UI. Mono for IDs and counts. No display sizes in-app. Wordmark is title-case Epure."
      >
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 rounded-panel border border-border-subtle bg-surface px-3 py-2">
            <span className="flex size-8 items-center justify-center rounded-md bg-accent text-accent-contrast">
              <EpureBrandIcon size={18} />
            </span>
            <span className="text-sm font-medium tracking-[-0.007em] text-fg-primary">Epure</span>
          </div>
          <div className="space-y-1 text-xs text-fg-muted">
            <p>
              Accent lock: <code className="font-mono">--accent</code> · signal aliases accent (no
              second brand green).
            </p>
            <p>
              Persist kit: <code className="font-mono">design/brand/kit/</code> · regenerate with{" "}
              <code className="font-mono">python3 kit/generate.py</code>.
            </p>
          </div>
        </div>
      </PreviewBlock>

      <LiveTokenCraft />

      <PreviewBlock
        id="brand-assets"
        title="Marks & assets"
        description={`Canonical in-app mark: #${LOGO_CANONICAL_VARIANT} ${LOGO_VARIANT_NAMES[LOGO_CANONICAL_VARIANT]}. Chain-link (EpureBrandIcon) is the export-kit symbol under design/brand/kit/.`}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
          <div className="flex flex-col items-center gap-2 rounded-control border border-border-subtle bg-surface-2/40 p-3">
            <span className="flex size-12 items-center justify-center rounded-md bg-accent text-accent-contrast">
              <EpureBrandIcon size={28} />
            </span>
            <p className="text-center font-mono text-[10px] text-fg-muted">Chain link kit</p>
          </div>
          {SHOWCASE_VARIANTS.map((variant) => (
            <div
              key={variant}
              className="flex flex-col items-center gap-2 rounded-control border border-border-subtle bg-surface-2/40 p-3"
            >
              <LogoMark variant={variant} size={48} />
              <p className="text-center font-mono text-[10px] text-fg-muted">
                #{variant} {LOGO_VARIANT_NAMES[variant]}
              </p>
            </div>
          ))}
        </div>
      </PreviewBlock>
    </section>
  );
}

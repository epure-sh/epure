import {
  LOGO_CANONICAL_VARIANT,
  LOGO_ROUND2_VARIANTS,
  LOGO_ROUND3_VARIANTS,
  LOGO_VARIANT_NAMES,
  LogoLockup,
  LogoMark,
  type LogoVariant,
} from "../../ui/logo";
import { PageChrome } from "../../ui/page-chrome";

const legacyVariants: LogoVariant[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

function MarkRow({
  title,
  variants,
  size,
  showWordmark = false,
  lead,
}: {
  title: string;
  variants: LogoVariant[];
  size: number;
  showWordmark?: boolean;
  lead?: LogoVariant;
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-mono text-xs uppercase tracking-wide text-ink-muted">{title}</h2>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {variants.map((variant) => (
          <div
            key={variant}
            className="flex shrink-0 flex-col items-center gap-2 rounded-lg border border-border bg-surface px-4 py-3"
          >
            <span className="font-mono text-2xs text-ink-muted">
              #{variant}
              {variant === lead ? " · lead" : ""}
            </span>
            {showWordmark ? (
              <LogoLockup variant={variant} markSize={size} />
            ) : (
              <LogoMark variant={variant} size={size} />
            )}
            <span className="max-w-[7rem] text-center text-2xs text-ink-subtle">
              {LOGO_VARIANT_NAMES[variant]}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function BrandComparePage() {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto">
      <PageChrome
        title="Logo directions — round 3 · bold"
        description="8 personalized marks. Navbar + favicon preview #18 until you pick a winner."
      />
      <div className="space-y-10 p-6">
        <MarkRow
          title="Round 3 · Lockup 48px"
          variants={LOGO_ROUND3_VARIANTS}
          size={48}
          showWordmark
          lead={LOGO_CANONICAL_VARIANT}
        />
        <MarkRow
          title="Round 3 · Mark 32px"
          variants={LOGO_ROUND3_VARIANTS}
          size={32}
          lead={LOGO_CANONICAL_VARIANT}
        />
        <MarkRow
          title="Round 3 · Navbar 22px"
          variants={LOGO_ROUND3_VARIANTS}
          size={22}
          lead={LOGO_CANONICAL_VARIANT}
        />
        <MarkRow
          title="Round 3 · Favicon 16px"
          variants={LOGO_ROUND3_VARIANTS}
          size={16}
          lead={LOGO_CANONICAL_VARIANT}
        />

        <details className="rounded-lg border border-border bg-surface-muted/30 p-4">
          <summary className="cursor-pointer font-mono text-xs uppercase tracking-wide text-ink-muted">
            Round 2 — click to expand
          </summary>
          <div className="mt-4 space-y-6">
            <MarkRow title="Round 2 · 32px" variants={LOGO_ROUND2_VARIANTS} size={32} />
          </div>
        </details>

        <details className="rounded-lg border border-border bg-surface-muted/30 p-4">
          <summary className="cursor-pointer font-mono text-xs uppercase tracking-wide text-ink-muted">
            Round 1 (archived) — click to expand
          </summary>
          <div className="mt-4 space-y-6">
            <MarkRow title="Round 1 · 32px" variants={legacyVariants} size={32} />
          </div>
        </details>
      </div>
    </div>
  );
}

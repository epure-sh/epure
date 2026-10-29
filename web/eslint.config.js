// eslint.config.js — Calm Ledger product bans + Orbit LLM-safe contract (Polar).
// Orbit rules mirror Polar’s oxlint intent: docs suggest; CI is the contract.
// See design/ORBIT_CONTRACT.md.
import tsParser from "@typescript-eslint/parser";

/** Pre-Orbit product surfaces — façade imports, no raw controls. */
const calmLedgerRestrictedSyntax = [
  {
    selector: "JSXOpeningElement[name.name='button']",
    message: "Raw <button> is forbidden. Import { Button } from '@/components/ui/button'.",
  },
  {
    selector: "JSXOpeningElement[name.name='input']",
    message:
      "Raw <input> is forbidden. Import { Input } from '@/components/ui/input' or { Checkbox } from '@/components/ui/checkbox'.",
  },
  {
    selector: "JSXOpeningElement[name.name='select']",
    message: "Raw <select> is forbidden. Import { Select } from '@/components/ui/select'.",
  },
  {
    selector: "JSXAttribute[name.name='style']",
    message:
      "Inline style={{}} is forbidden. Use semantic tokens / Box props (design/ORBIT_CONTRACT.md).",
  },
];

/**
 * Orbit zone — Polar LLM-safe contract.
 * Tokens are the only vocabulary; bare layout HTML is unavailable, not discouraged.
 */
const orbitRestrictedSyntax = [
  {
    selector:
      "JSXOpeningElement[name.name=/^(div|span|section|main|nav|header|footer|aside|article|ul|ol|li)$/]",
    message:
      "Use <Box /> from '@polar-sh/orbit/Box' (polymorphic `as`) instead of raw layout HTML. See design/ORBIT_CONTRACT.md.",
  },
  {
    selector:
      "JSXOpeningElement[name.name='Box'] > JSXAttribute[name.name='className']",
    message:
      "className on Box is forbidden in the Orbit zone. Use typed token props (padding, backgroundColor, gap, …). If a decision is missing, add a token — do not bypass.",
  },
  {
    selector:
      "JSXOpeningElement[name.name='Text'] > JSXAttribute[name.name='className']",
    message:
      "className on Text is forbidden. Use variant / color / align / monospace / tabularNums token props.",
  },
  {
    selector:
      "JSXOpeningElement[name.name=/^(Box|Text)$/] > JSXAttribute[name.name='style']",
    message:
      "Inline style on Box/Text is forbidden. Prefer typed token props; extend BoxStyleProps if a property is missing.",
  },
  {
    selector:
      "JSXAttribute[value.expression.type='Literal'][value.expression.value=/#[0-9A-Fa-f]{3,8}/]",
    message:
      "Raw hex colors are forbidden. Use semantic tokens (background-*, border-*, Text color=).",
  },
  {
    selector: "Literal[value=/\\bdark:/]",
    message:
      "dark: variants are forbidden — semantic tokens resolve light/dark via light-dark().",
  },
  {
    selector:
      "JSXAttribute[name.name='className'][value.value=/\\b(bg|text|border|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|rounded|shadow|w-|h-|flex|grid|absolute|relative)-/]",
    message:
      "Tailwind layout/color utility strings are forbidden in the Orbit zone. Express decisions as Box/Text token props.",
  },
];

/** Files under the Orbit contract — expand as surfaces migrate (same PR). */
const orbitZoneFiles = [
  "src/pages/dev/orbit-*/**/*.{ts,tsx}",
  "src/pages/dev/design-kit/docs/**/*.{ts,tsx}",
  "src/pages/dev/design-kit/docs-entry.tsx",
  // Orbit façades
  "src/components/ui/button.tsx",
  "src/components/ui/input.tsx",
  "src/components/ui/checkbox.tsx",
  "src/components/ui/switch.tsx",
  "src/components/ui/tabs.tsx",
  "src/components/ui/select.tsx",
  "src/components/ui/tooltip.tsx",
  "src/components/ui/badge.tsx",
  "src/components/ui/modal.tsx",
  "src/components/ui/textarea.tsx",
  "src/ui/button.tsx",
  "src/ui/input.tsx",
  "src/ui/checkbox.tsx",
  "src/ui/switch.tsx",
  "src/ui/tabs.tsx",
  "src/ui/select.tsx",
  "src/ui/tooltip.tsx",
  "src/ui/badge.tsx",
  // Kit on Orbit + Epure Orbit extensions
  "src/components/kit/page-shell.tsx",
  "src/components/kit/empty-state.tsx",
  "src/components/kit/section-card.tsx",
  "src/components/kit/code-frame.tsx",
  "src/components/kit/data-table.tsx",
  "src/components/kit/filter-bar.tsx",
  "src/components/kit/command-bar.tsx",
  "src/components/kit/usage-meter-card.tsx",
  "src/components/kit/nav-count-pastille.tsx",
  "src/components/kit/polar-card.tsx",
  "src/components/kit/alert-execution-pipeline.tsx",
  // Migrated product Orbit surfaces
  "src/features/org/project-list.tsx",
  "src/features/org/home.tsx",
];

export default [
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
  },
  {
    files: [
      "src/pages/**/*.tsx",
      "src/features/**/*.tsx",
      "src/shell/**/*.tsx",
      "src/components/kit/**/*.tsx",
    ],
    ignores: [
      "src/pages/dev/orbit-*/**",
      "src/pages/dev/design-kit/docs/**",
      "src/pages/dev/design-kit/docs-entry.tsx",
      // Orbit-zone files use the stricter block below (avoid double-rule stacks)
      ...orbitZoneFiles,
    ],
    rules: {
      "no-restricted-syntax": ["error", ...calmLedgerRestrictedSyntax],
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "radix-ui",
              message:
                "Do not import radix-ui directly in pages/kit. Use wrapped primitives from '@/components/ui/*'.",
            },
            {
              name: "cmdk",
              message:
                "Do not import cmdk directly in pages. Use <CommandBar /> from '@/components/kit/command-bar'.",
            },
            {
              name: "@phosphor-icons/react",
              message:
                "Do not import @phosphor-icons/react directly in pages/kit. Use '@/components/ui/icon'.",
            },
            {
              name: "sonner",
              message:
                "Do not import sonner directly in pages/kit. Use { toast, Toaster } from '@/components/ui/sonner'.",
            },
            {
              name: "vaul",
              message:
                "Do not import vaul directly in pages/kit. Use '@/components/ui/sheet'.",
            },
          ],
        },
      ],
    },
  },
  {
    files: orbitZoneFiles,
    rules: {
      "no-restricted-syntax": ["error", ...orbitRestrictedSyntax],
    },
  },
];

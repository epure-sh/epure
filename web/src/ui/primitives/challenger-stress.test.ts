// web/src/ui/primitives/challenger-stress.test.ts
// Empirical stress harness and boundary verification for Milestone 1 primitives.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as React from "react";
import { renderToString } from "react-dom/server";

import {
  // Tokens
  palette,
  spacing,
  fontSizes,
  borderRadii,
  durations,
  easings,
  backgroundColors,
  textColors,
  borderColors,
  CSS_VARIABLES,
  orbitCssVariableBridge,
  // Principles
  ORBIT_CORE_PRINCIPLES,
  PRODUCT_DESIGN_PRINCIPLES,
  VOICE_GUIDELINES,
  // Brand
  BRAND_NAME,
  CANONICAL_MARK_INDEX,
  LOGO_CANONICAL_VARIANT,
  LOGO_VARIANT_NAMES,
  EpureBrandIcon,
  EpureBrandMark,
  LogoMark,
  LogoWordmark,
  LogoLockup,
  LogoNavButton,
  // Typography
  Text,
  formatNumber,
  formatCompact,
  // Layout
  Box,
  Grid,
  // Elements
  Button,
  buttonVariants,
  Input,
  TextArea,
  Checkbox,
  Switch,
  Badge,
  badgeVariants,
  Status,
  Avatar,
  Spinner,
  SpinnerNoMargin,
  Kbd,
  Separator,
  Skeleton,
  Icon,
  Label,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
  closeOpenSelects,
  restorePagePointerEvents,
  SegmentedControl,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  Popover,
  PopoverTrigger,
  PopoverContent,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  RadioGroup,
  RadioGroupItem,
  Alert,
  Flame,
  Sparkle,
  Warning,
} from "./index";

describe("Empirical Challenger: Milestone 1 Stress Suite", () => {
  describe("1. Tokens & Variable Resolution Stress Tests", () => {
    it("validates all CSS_VARIABLES format and fallbacks", () => {
      const vars = Object.entries(CSS_VARIABLES);
      assert.ok(vars.length >= 25, `Expected at least 25 CSS variables, found ${vars.length}`);

      for (const [key, value] of vars) {
        // Starts with var(--[a-z0-9-]+ and ends with )
        assert.ok(
          value.startsWith("var(--") && value.endsWith(")"),
          `CSS_VARIABLES.${key} = "${value}" does not start with var(-- or end with )`,
        );
      }
    });

    it("validates orbitCssVariableBridge mappings completeness and valid naming", () => {
      // Surfaces
      for (const [token, cssVar] of Object.entries(orbitCssVariableBridge.surfaces)) {
        assert.ok(token.length > 0);
        assert.match(cssVar, /^--[a-z0-9-]+$/, `Surfaces bridge var ${cssVar} is malformed`);
      }
      // Text
      for (const [token, cssVar] of Object.entries(orbitCssVariableBridge.text)) {
        assert.ok(token.length > 0);
        assert.match(cssVar, /^--[a-z0-9-]+$/, `Text bridge var ${cssVar} is malformed`);
      }
      // Borders
      for (const [token, cssVar] of Object.entries(orbitCssVariableBridge.borders)) {
        assert.ok(token.length > 0);
        assert.match(cssVar, /^--[a-z0-9-]+$/, `Borders bridge var ${cssVar} is malformed`);
      }
      // Radii
      assert.equal(orbitCssVariableBridge.radii.none, "0px");
      assert.equal(orbitCssVariableBridge.radii.full, "9999px");
      assert.match(orbitCssVariableBridge.radii.s, /var\(--radius-sm/);
      assert.match(orbitCssVariableBridge.radii.m, /var\(--radius-md/);
      assert.match(orbitCssVariableBridge.radii.l, /var\(--radius-lg/);
      assert.match(orbitCssVariableBridge.radii.xl, /var\(--radius-xl/);
      // Motion
      assert.equal(orbitCssVariableBridge.motion.durations.instant, "0ms");
      assert.match(orbitCssVariableBridge.motion.durations.fast, /120ms/);
      assert.match(orbitCssVariableBridge.motion.durations.base, /200ms/);
      assert.match(orbitCssVariableBridge.motion.durations.slow, /320ms/);
      assert.equal(orbitCssVariableBridge.motion.durations.slower, "480ms");
    });

    it("verifies Orbit token collections re-exported from StyleX", () => {
      assert.ok(palette, "palette must exist");
      assert.ok(spacing, "spacing must exist");
      assert.ok(fontSizes, "fontSizes must exist");
      assert.ok(borderRadii, "borderRadii must exist");
      assert.ok(durations, "durations must exist");
      assert.ok(easings, "easings must exist");
      assert.ok(backgroundColors, "backgroundColors must exist");
      assert.ok(textColors, "textColors must exist");
      assert.ok(borderColors, "borderColors must exist");
    });
  });

  describe("2. Typography & Numeric Formatter Boundary Stress Tests", () => {
    it("stress-tests formatNumber with extreme numbers and boundaries", () => {
      // Normal numbers
      assert.equal(formatNumber(0), "0");
      assert.equal(formatNumber(-0), "-0"); // IEEE 754 Intl.NumberFormat preserves signed zero
      assert.equal(formatNumber(1), "1");
      assert.equal(formatNumber(-1), "-1");
      assert.equal(formatNumber(999), "999");
      assert.equal(formatNumber(1000), "1,000");
      assert.equal(formatNumber(10243), "10,243");
      assert.equal(formatNumber(-1250000), "-1,250,000");

      // Large safe integers
      assert.equal(formatNumber(Number.MAX_SAFE_INTEGER), "9,007,199,254,740,991");
      assert.equal(formatNumber(Number.MIN_SAFE_INTEGER), "-9,007,199,254,740,991");

      // Decimals and floats
      assert.equal(formatNumber(1284.5), "1,284.5");
      assert.equal(formatNumber("1284.75"), "1,284.75");

      // Non-numeric strings and NaN fallbacks
      assert.equal(formatNumber(NaN), "NaN");
      assert.equal(formatNumber("NaN"), "NaN");
      assert.equal(formatNumber("not-a-number"), "not-a-number");
      assert.equal(formatNumber("1284 members"), "1284 members");

      // Empty string conversion: Number("") evaluates to 0
      assert.equal(formatNumber(""), "0");

      // Infinity
      assert.equal(formatNumber(Infinity), "∞");
      assert.equal(formatNumber(-Infinity), "-∞");
    });

    it("stress-tests formatCompact with magnitudes and boundaries", () => {
      assert.equal(formatCompact(0), "0");
      assert.equal(formatCompact(12), "12");
      assert.equal(formatCompact(999), "999");
      assert.equal(formatCompact(1000), "1K");
      assert.equal(formatCompact(1500), "1.5K");
      assert.equal(formatCompact(25000), "25K");
      assert.equal(formatCompact(1000000), "1M");
      assert.equal(formatCompact(2500000), "2.5M");
      assert.equal(formatCompact(1000000000), "1B");
      assert.equal(formatCompact(1000000000000), "1T");

      // Boundary values
      assert.equal(formatCompact(NaN), "NaN");
      assert.equal(formatCompact("not-a-number"), "not-a-number");
      assert.equal(formatCompact(Infinity), "∞");
    });

    it("verifies Text primitive exports and typing", () => {
      assert.ok(Text, "Text primitive must be exported");
      assert.equal(typeof Text, "function");
    });
  });

  describe("3. Layout Containers (Box, Grid) Stress Tests", () => {
    it("verifies Box and Grid layout component exports and contracts", () => {
      assert.ok(Box, "Box must be exported");
      assert.ok(Grid, "Grid must be exported");
      assert.ok(["function", "object"].includes(typeof Box));
      assert.ok(["function", "object"].includes(typeof Grid));
    });
  });

  describe("4. Brand Identity & Logo Robustness Stress Tests", () => {
    it("validates brand invariants strictly", () => {
      assert.equal(BRAND_NAME, "Epure");
      assert.equal(CANONICAL_MARK_INDEX, 25);
      assert.equal(LOGO_CANONICAL_VARIANT, 25);
      assert.equal(Object.keys(LOGO_VARIANT_NAMES).length, 25);
      assert.equal(LOGO_VARIANT_NAMES[25], "Chain Link (Canonical)");
    });

    it("renders EpureBrandIcon and EpureBrandMark with custom sizes", () => {
      const iconHtml = renderToString(React.createElement(EpureBrandIcon, { size: 24 }));
      assert.ok(iconHtml.includes('width="24"'));
      assert.ok(iconHtml.includes('height="24"'));
      assert.ok(iconHtml.includes('viewBox="0 0 32 32"'));
      assert.ok(iconHtml.includes('aria-label="Epure"'));

      const markHtml = renderToString(React.createElement(EpureBrandMark, { size: 48 }));
      assert.ok(markHtml.includes('width="48"'));
      assert.ok(markHtml.includes('height="48"'));
      assert.ok(markHtml.includes('rx="8"'));
    });

    it("stress-tests LogoMark with canonical, known, and unknown fallback variants", () => {
      // Canonical variant 25
      const mark25 = renderToString(React.createElement(LogoMark, { variant: 25 }));
      assert.ok(mark25.includes("Chain Link (Canonical)"));

      // Known variants (7, 18)
      const mark7 = renderToString(React.createElement(LogoMark, { variant: 7 }));
      assert.ok(mark7.includes("Pure Spike"));

      const mark18 = renderToString(React.createElement(LogoMark, { variant: 18 }));
      assert.ok(mark18.includes("Ledger Rupture"));

      // Unknown variants fallback cleanly to canonical without throwing
      const markInvalid = renderToString(React.createElement(LogoMark, { variant: 999 as any }));
      assert.ok(markInvalid.includes("Chain Link (Canonical)"));

      const markNegative = renderToString(React.createElement(LogoMark, { variant: -1 as any }));
      assert.ok(markNegative.includes("Chain Link (Canonical)"));
    });

    it("renders LogoWordmark, LogoLockup, and LogoNavButton", () => {
      const wordmark = renderToString(React.createElement(LogoWordmark, null));
      assert.ok(wordmark.includes("Epure"));

      const lockup = renderToString(React.createElement(LogoLockup, null));
      assert.ok(lockup.includes("Epure"));

      const navBtn = renderToString(React.createElement(LogoNavButton, null));
      assert.ok(navBtn.includes('type="button"'));
      assert.ok(navBtn.includes('aria-label="Epure home"'));
    });
  });

  describe("5. Atomic Elements Boundary and Props Matrix Stress Tests", () => {
    it("renders Button across all variant and size permutations", () => {
      const variants = [
        "primary",
        "secondary",
        "outline",
        "ghost",
        "danger",
        "signal",
        "link",
        "filterEscalating",
        "filterRegression",
      ] as const;

      const sizes = [
        "xs",
        "sm",
        "md",
        "default",
        "toolbar",
        "lg",
        "icon",
        "icon-xs",
      ] as const;

      for (const variant of variants) {
        for (const size of sizes) {
          const html = renderToString(
            React.createElement(
              Button,
              {
                variant,
                size,
                hotkey: "⌘K",
              },
              `Btn-${variant}-${size}`,
            ),
          );
          assert.ok(html.includes(`Btn-${variant}-${size}`));
          assert.ok(html.includes("⌘K"));
        }
      }
    });

    it("renders Button asChild slotting with an anchor tag", () => {
      const asChildHtml = renderToString(
        React.createElement(
          Button,
          {
            asChild: true,
            variant: "primary",
          },
          React.createElement("a", { href: "/issues" }, "Go to Issues"),
        ),
      );
      assert.ok(asChildHtml.startsWith("<a"));
      assert.ok(asChildHtml.includes('href="/issues"'));
      assert.ok(asChildHtml.includes("Go to Issues"));
    });

    it("renders Button loading and disabled states", () => {
      const loadingHtml = renderToString(
        React.createElement(
          Button,
          {
            loading: true,
          },
          "Submitting",
        ),
      );
      assert.ok(loadingHtml.includes("disabled"));

      const disabledHtml = renderToString(
        React.createElement(
          Button,
          {
            disabled: true,
          },
          "Disabled",
        ),
      );
      assert.ok(disabledHtml.includes("disabled"));
    });

    it("verifies Badge variant and size contracts", () => {
      assert.equal(typeof Badge, "function");
      assert.equal(typeof badgeVariants, "function");

      const badgeVariantList = [
        "neutral",
        "escalating",
        "regression",
        "healthy",
        "info",
        "warning",
        "error",
        "accent",
        "env",
        "flat",
        "resolved",
        "default",
        "secondary",
      ] as const;

      for (const variant of badgeVariantList) {
        const className = badgeVariants({ variant });
        assert.equal(typeof className, "string");
      }
    });

    it("verifies Switch and Tabs contracts and structure", () => {
      assert.equal(typeof Switch, "function");
      assert.equal(typeof Tabs, "function");
      assert.equal(typeof TabsList, "function");
      assert.equal(typeof TabsTrigger, "function");
      assert.equal(typeof TabsContent, "function");
    });

    it("executes Select helper functions safely", () => {
      assert.doesNotThrow(() => {
        closeOpenSelects();
      });
      assert.doesNotThrow(() => {
        restorePagePointerEvents();
      });
    });

    it("renders Kbd, Skeleton, Separator, and Icon primitives", () => {
      const kbdHtml = renderToString(React.createElement(Kbd, { keys: "⌘K" }));
      assert.ok(kbdHtml.includes("⌘K"));

      const skeletonHtml = renderToString(React.createElement(Skeleton, { className: "h-4 w-32" }));
      assert.ok(skeletonHtml.includes("epure-skeleton"));

      const separatorHtml = renderToString(React.createElement(Separator, { orientation: "vertical" }));
      assert.ok(separatorHtml.includes("bg-border-subtle"));

      const iconHtml = renderToString(
        React.createElement(Icon, { icon: Flame, size: 20, weight: "bold" }),
      );
      assert.ok(iconHtml.includes('data-slot="icon"'));
    });

    it("renders RadioGroup and RadioGroupItem", () => {
      const radioHtml = renderToString(
        React.createElement(
          RadioGroup,
          { defaultValue: "opt1" },
          React.createElement(RadioGroupItem, { value: "opt1" }),
          React.createElement(RadioGroupItem, { value: "opt2" }),
        ),
      );
      assert.ok(radioHtml.includes('data-slot="radio-group"'));
      assert.ok(radioHtml.includes('data-slot="radio-group-item"'));
    });

    it("renders DialogHeader and DialogFooter containers", () => {
      const headerHtml = renderToString(
        React.createElement(DialogHeader, { className: "test-header" }, "Header Content"),
      );
      assert.ok(headerHtml.includes("Header Content"));
      assert.ok(headerHtml.includes('data-slot="dialog-header"'));

      const footerHtml = renderToString(
        React.createElement(DialogFooter, { className: "test-footer" }, "Footer Content"),
      );
      assert.ok(footerHtml.includes("Footer Content"));
      assert.ok(footerHtml.includes('data-slot="dialog-footer"'));
    });

    it("verifies Dialog, Popover, and DropdownMenu exports and contract", () => {
      assert.ok(Dialog);
      assert.ok(DialogTrigger);
      assert.ok(DialogContent);
      assert.ok(DialogTitle);
      assert.ok(DialogDescription);

      assert.ok(Popover);
      assert.ok(PopoverTrigger);
      assert.ok(PopoverContent);

      assert.ok(DropdownMenu);
      assert.ok(DropdownMenuTrigger);
      assert.ok(DropdownMenuContent);
      assert.ok(DropdownMenuItem);
      assert.ok(DropdownMenuCheckboxItem);
      assert.ok(DropdownMenuRadioItem);
      assert.ok(DropdownMenuLabel);
      assert.ok(DropdownMenuSeparator);
      assert.ok(DropdownMenuShortcut);
    });

    it("verifies Input, TextArea, Checkbox, Status, Avatar, Spinner, Label, Tooltip, Alert contracts", () => {
      assert.ok(Input);
      assert.ok(TextArea);
      assert.ok(Checkbox);
      assert.ok(Status);
      assert.ok(Avatar);
      assert.ok(Spinner);
      assert.ok(SpinnerNoMargin);
      assert.ok(Label);
      assert.ok(Tooltip);
      assert.ok(TooltipTrigger);
      assert.ok(TooltipContent);
      assert.ok(TooltipProvider);
      assert.ok(Select);
      assert.ok(SelectTrigger);
      assert.ok(SelectContent);
      assert.ok(SelectItem);
      assert.ok(SelectValue);
      assert.ok(SelectGroup);
      assert.ok(SelectLabel);
      assert.ok(SelectSeparator);
      assert.ok(SegmentedControl);
      assert.ok(Alert);
    });
  });
});

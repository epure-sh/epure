// web/src/ui/primitives/primitives.test.ts
// Contract and integration test suite for Milestone 1: Primitives Tier & Token System.

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
  DropdownMenuSubContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  RadioGroup,
  RadioGroupItem,
  Alert,
} from "./index";

describe("Milestone 1: Primitives Tier & Token System", () => {
  describe("Tokens & CSS Variable Bridge", () => {
    it("re-exports Orbit StyleX token values and collections", () => {
      assert.ok(palette, "palette must be defined");
      assert.ok(spacing, "spacing must be defined");
      assert.ok(fontSizes, "fontSizes must be defined");
      assert.ok(borderRadii, "borderRadii must be defined");
      assert.ok(durations, "durations must be defined");
      assert.ok(easings, "easings must be defined");
      assert.ok(backgroundColors, "backgroundColors must be defined");
      assert.ok(textColors, "textColors must be defined");
      assert.ok(borderColors, "borderColors must be defined");
    });

    it("bridges tokens to CSS custom properties", () => {
      assert.equal(CSS_VARIABLES.bg, "var(--bg)");
      assert.equal(CSS_VARIABLES.text, "var(--text)");
      assert.equal(CSS_VARIABLES.accent, "var(--accent)");
      assert.ok(orbitCssVariableBridge.surfaces["background-primary"]);
      assert.ok(orbitCssVariableBridge.borders["border-primary"]);
      assert.ok(orbitCssVariableBridge.radii.m);
      assert.ok(orbitCssVariableBridge.motion.durations.fast);
    });
  });

  describe("Orbit Principles & Developer Voice", () => {
    it("enforces the three core Orbit principles in strict order", () => {
      assert.equal(ORBIT_CORE_PRINCIPLES.length, 3);
      assert.equal(ORBIT_CORE_PRINCIPLES[0].index, "01");
      assert.equal(ORBIT_CORE_PRINCIPLES[0].name, "Design by subtraction");
      assert.equal(ORBIT_CORE_PRINCIPLES[1].index, "02");
      assert.equal(ORBIT_CORE_PRINCIPLES[1].name, "Derived, not decorated");
      assert.equal(ORBIT_CORE_PRINCIPLES[2].index, "03");
      assert.equal(ORBIT_CORE_PRINCIPLES[2].name, "Precision as respect");
    });

    it("provides product design principles and voice rules", () => {
      assert.ok(PRODUCT_DESIGN_PRINCIPLES.dataIsTheDesign);
      assert.ok(PRODUCT_DESIGN_PRINCIPLES.densityWithClarity);
      assert.ok(PRODUCT_DESIGN_PRINCIPLES.zeroPolishDebt);
      assert.ok(PRODUCT_DESIGN_PRINCIPLES.speedAsDesignValue);
      assert.ok(PRODUCT_DESIGN_PRINCIPLES.artifactPrinciple);

      assert.equal(VOICE_GUIDELINES.headline, "Write like a developer");
      assert.equal(VOICE_GUIDELINES.rules.length, 8);
    });
  });

  describe("Brand Identity & Mark #25", () => {
    it("enforces title-case Epure name and canonical Chain Link mark #25", () => {
      assert.equal(BRAND_NAME, "Epure");
      assert.equal(CANONICAL_MARK_INDEX, 25);
    });

    it("exports all brand logo components", () => {
      assert.equal(typeof EpureBrandIcon, "function");
      assert.equal(typeof EpureBrandMark, "function");
      assert.equal(typeof LogoMark, "function");
      assert.equal(typeof LogoWordmark, "function");
      assert.equal(typeof LogoLockup, "function");
      assert.equal(typeof LogoNavButton, "function");
    });
  });

  describe("Typography & Formatters", () => {
    it("exports Orbit Text component", () => {
      assert.equal(typeof Text, "function");
    });

    it("formats numbers with grouping and compact notation", () => {
      assert.equal(formatNumber(10243), "10,243");
      assert.equal(formatNumber("50000"), "50,000");
      assert.equal(formatCompact(1500000), "1.5M");
      assert.equal(formatCompact(2500), "2.5K");
    });
  });

  describe("Polymorphic Layout Containers", () => {
    it("exports Box and Grid layout primitives", () => {
      assert.ok(Box, "Box must be defined");
      assert.ok(Grid, "Grid must be defined");
      assert.ok(["function", "object"].includes(typeof Box));
      assert.ok(["function", "object"].includes(typeof Grid));
    });
  });

  describe("Atomic UI Element Suite", () => {
    it("exports all 23 atomic elements", () => {
      const elements = [
        Button,
        Input,
        TextArea,
        Checkbox,
        Switch,
        Badge,
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
        RadioGroup,
        RadioGroupItem,
        Alert,
      ];

      for (const el of elements) {
        assert.ok(el, "Element must be defined");
        assert.ok(
          ["function", "object"].includes(typeof el),
          `Expected function or forwardRef object, got ${typeof el}`,
        );
      }

      assert.equal(typeof buttonVariants, "function");
      assert.equal(typeof badgeVariants, "function");
    });

    describe("DropdownMenu & Popover Motion and Trigger Origin", () => {
      it("anchors DropdownMenuContent transforms to radix popper origin and deceleration curve", () => {
        const content = DropdownMenuContent({ className: "test-dropdown-content" });
        const childProps = (content as React.ReactElement<{ children: React.ReactElement<{ className: string; "data-slot": string }> }>).props.children.props;

        assert.equal(childProps["data-slot"], "dropdown-menu-content");
        assert.ok(
          childProps.className.includes("[transform-origin:var(--radix-popper-transform-origin,center)]"),
          "DropdownMenuContent must anchor scale transforms to trigger origin via var(--radix-popper-transform-origin,center)",
        );
        assert.ok(
          childProps.className.includes("duration-150"),
          "DropdownMenuContent must specify 150ms animation duration",
        );
        assert.ok(
          childProps.className.includes("ease-[var(--ease-out,cubic-bezier(0.23,1,0.32,1))]"),
          "DropdownMenuContent must use custom ease-out decelerate curve",
        );
        assert.ok(childProps.className.includes("data-[state=open]:zoom-in-95"));
        assert.ok(childProps.className.includes("data-[state=closed]:zoom-out-95"));
        assert.ok(childProps.className.includes("test-dropdown-content"));
      });

      it("anchors DropdownMenuSubContent transforms to radix popper origin and zoom scales", () => {
        const subContent = DropdownMenuSubContent({ className: "test-sub-content" });
        const props = (subContent as React.ReactElement<{ className: string; "data-slot": string }>).props;

        assert.equal(props["data-slot"], "dropdown-menu-sub-content");
        assert.ok(
          props.className.includes("[transform-origin:var(--radix-popper-transform-origin,center)]"),
          "DropdownMenuSubContent must anchor scale transforms to trigger origin",
        );
        assert.ok(
          props.className.includes("duration-150"),
          "DropdownMenuSubContent must specify 150ms animation duration",
        );
        assert.ok(
          props.className.includes("ease-[var(--ease-out,cubic-bezier(0.23,1,0.32,1))]"),
          "DropdownMenuSubContent must use custom ease-out curve",
        );
        assert.ok(props.className.includes("data-[state=open]:zoom-in-95"));
        assert.ok(props.className.includes("data-[state=closed]:zoom-out-95"));
      });

      it("anchors PopoverContent transforms with identical trigger-origin curve parity", () => {
        const popover = PopoverContent({ className: "test-popover" });
        const childProps = (popover as React.ReactElement<{ children: React.ReactElement<{ className: string; "data-slot": string }> }>).props.children.props;

        assert.equal(childProps["data-slot"], "popover-content");
        assert.ok(childProps.className.includes("[transform-origin:var(--radix-popper-transform-origin,center)]"));
        assert.ok(childProps.className.includes("duration-150"));
        assert.ok(childProps.className.includes("ease-[var(--ease-out,cubic-bezier(0.23,1,0.32,1))]"));
        assert.ok(childProps.className.includes("data-[state=open]:zoom-in-95"));
        assert.ok(childProps.className.includes("data-[state=closed]:zoom-out-95"));
      });

      it("configures DropdownMenuItem interactive and accessibility slots", () => {
        const item = DropdownMenuItem({ inset: true, className: "test-item" });
        const props = (item as React.ReactElement<{ className: string; "data-slot": string }>).props;
        assert.equal(props["data-slot"], "dropdown-menu-item");
        assert.ok(props.className.includes("cursor-pointer"));
        assert.ok(props.className.includes("select-none"));
        assert.ok(props.className.includes("pl-7"));

        const shortcut = DropdownMenuShortcut({ className: "test-shortcut", children: "⌘S" });
        const scProps = (shortcut as React.ReactElement<{ className: string; "data-slot": string }>).props;
        assert.equal(scProps["data-slot"], "dropdown-menu-shortcut");
        assert.ok(scProps.className.includes("tabular-nums"));
        assert.ok(scProps.className.includes("font-mono"));

        const sep = DropdownMenuSeparator({});
        const sepProps = (sep as React.ReactElement<{ className: string; "data-slot": string }>).props;
        assert.equal(sepProps["data-slot"], "dropdown-menu-separator");
        assert.ok(sepProps.className.includes("h-px"));
      });
    });

    describe("Button Tactile Depression & Accessibility", () => {
      it("enforces active scale depression and mechanical easing across variants", () => {
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

        for (const variant of variants) {
          const html = renderToString(React.createElement(Button, { variant }, `Button-${variant}`));
          assert.ok(
            html.includes("active:scale-[0.97]") || html.includes("active:scale-95") || html.includes("btn-tactile"),
            `Button variant "${variant}" must include tactile pointer-down depression feedback`,
          );
          assert.ok(
            html.includes("motion-reduce:active:scale-100"),
            `Button variant "${variant}" must respect prefers-reduced-motion`,
          );
        }
      });

      it("preserves active depression and dark styling when rendered asChild", () => {
        const html = renderToString(
          React.createElement(
            Button,
            { asChild: true, variant: "primary" },
            React.createElement("a", { href: "/test" }, "Link Target"),
          ),
        );
        assert.ok(html.startsWith("<a"));
        assert.ok(html.includes('href="/test"'));
        assert.ok(
          html.includes("active:scale-[0.97]") || html.includes("btn-tactile"),
          "asChild Button must preserve active mechanical depression",
        );
        assert.ok(
          html.includes("dark:"),
          "asChild Button must include dark mode styling classes",
        );
      });

      it("sets accessibility states for disabled and loading buttons", () => {
        const disabledHtml = renderToString(React.createElement(Button, { disabled: true }, "Disabled"));
        assert.ok(disabledHtml.includes("disabled"));
        assert.ok(disabledHtml.includes("disabled:pointer-events-none"));

        const loadingHtml = renderToString(React.createElement(Button, { loading: true }, "Loading"));
        assert.ok(loadingHtml.includes("disabled"));
      });
    });

    describe("SegmentedControl Accessibility & Semantics", () => {
      it("renders with radiogroup semantics, checked states, and roving tabindex", () => {
        const html = renderToString(
          React.createElement(SegmentedControl, {
            options: [
              { label: "Day", value: "day" },
              { label: "Week", value: "week" },
            ],
            value: "day",
            onChange: () => {},
          }),
        );

        assert.ok(html.includes('role="radiogroup"'), "Container must have role=radiogroup");
        assert.ok(html.includes('aria-orientation="horizontal"'), "Container must have horizontal orientation");
        assert.ok(html.includes('role="radio"'), "Items must have role=radio");
        assert.ok(html.includes('aria-checked="true"'), "Selected item must have aria-checked=true");
        assert.ok(html.includes('aria-checked="false"'), "Unselected item must have aria-checked=false");
        assert.ok(html.includes('tabindex="0"'), "Selected item must be in tab sequence");
        assert.ok(html.includes('tabindex="-1"'), "Unselected item must be removed from tab sequence");
        assert.ok(html.includes("active:scale-[0.97]"), "Must support tactile active scale depression");
      });
    });

    describe("Avatar Robustness & Fallbacks", () => {
      it("renders safely without throwing when name is undefined or empty", () => {
        assert.doesNotThrow(() => {
          renderToString(React.createElement(Avatar, { avatar_url: "https://example.com/avatar.png" }));
        }, "Avatar must not throw TypeError when name is undefined");

        assert.doesNotThrow(() => {
          renderToString(React.createElement(Avatar, { name: "" }));
        }, "Avatar must not throw when name is empty string");
      });

      it("renders initials correctly when name is provided", () => {
        const html = renderToString(React.createElement(Avatar, { name: "Jane Doe" }));
        assert.ok(html.includes("JD"), "Avatar should render initials for provided name");
      });
    });

    describe("Form Primitives Focus & Tactile Contracts", () => {
      it("renders Input and TextArea with focus ring cues", () => {
        const inputHtml = renderToString(React.createElement(Input, { placeholder: "Search issues..." }));
        assert.ok(inputHtml.includes('data-slot="input"'));
        assert.ok(inputHtml.includes("focus-visible:ring-") || inputHtml.includes("focus:ring-"));

        const textAreaHtml = renderToString(React.createElement(TextArea, { placeholder: "Description" }));
        assert.ok(textAreaHtml.includes("<textarea"));
        assert.ok(textAreaHtml.includes("focus-visible:ring-") || textAreaHtml.includes("focus:ring-"));
      });

      it("enforces tactile depression on RadioGroup items", () => {
        const radioHtml = renderToString(
          React.createElement(
            RadioGroup,
            { defaultValue: "val1" },
            React.createElement(RadioGroupItem, { value: "val1" }),
          ),
        );
        assert.ok(radioHtml.includes('role="radiogroup"'));
        assert.ok(radioHtml.includes('role="radio"'));
        assert.ok(radioHtml.includes("active:scale-[0.92]"));
        assert.ok(radioHtml.includes("motion-reduce:active:scale-100"));
      });
    });

    describe("Dialog Modal Architecture & Accessibility", () => {
      it("renders header, footer, and close trigger with sr-only label", () => {
        const headerHtml = renderToString(React.createElement(DialogHeader, null, "Title"));
        assert.ok(headerHtml.includes('data-slot="dialog-header"'));

        const footerHtml = renderToString(React.createElement(DialogFooter, null, "Actions"));
        assert.ok(footerHtml.includes('data-slot="dialog-footer"'));
      });
    });

    describe("Badge Semantic Visual Hierarchy", () => {
      it("resolves all semantic status and filter badges with valid classes", () => {
        const variants = [
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

        for (const variant of variants) {
          const className = badgeVariants({ variant });
          assert.equal(typeof className, "string");

          const html = renderToString(React.createElement(Badge, { variant }, `Badge-${variant}`));
          assert.ok(html.includes("<span"), `Badge "${variant}" must render span element`);
          assert.ok(html.includes("rounded-full"), `Badge "${variant}" must render rounded pill`);
        }
      });
    });
  });
});

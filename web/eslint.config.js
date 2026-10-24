// eslint.config.js
import tsParser from "@typescript-eslint/parser";

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
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXOpeningElement[name.name='button']",
          message: "Raw <button> is forbidden. Import { Button } from '@/components/ui/button'.",
        },
        {
          selector: "JSXOpeningElement[name.name='input']",
          message: "Raw <input> is forbidden. Import { Input } from '@/components/ui/input' or { Checkbox } from '@/components/ui/checkbox'.",
        },
        {
          selector: "JSXOpeningElement[name.name='select']",
          message: "Raw <select> is forbidden. Import { Select } from '@/components/ui/select'.",
        },
        {
          selector: "JSXAttribute[name.name='style']",
          message: "Inline style={{}} is forbidden. Use semantic Tailwind tokens from src/styles/tokens.css.",
        },
      ],
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "radix-ui",
              message: "Do not import radix-ui directly in pages/kit. Use wrapped primitives from '@/components/ui/*'.",
            },
            {
              name: "cmdk",
              message: "Do not import cmdk directly in pages. Use <CommandBar /> from '@/components/kit/command-bar'.",
            },
            {
              name: "@phosphor-icons/react",
              message: "Do not import @phosphor-icons/react directly in pages/kit. Use wrapped primitives or re-exports from '@/components/ui/icon'.",
            },
            {
              name: "sonner",
              message: "Do not import sonner directly in pages/kit. Use { toast, Toaster } from '@/components/ui/sonner'.",
            },
            {
              name: "vaul",
              message: "Do not import vaul directly in pages/kit. Use wrapped primitives from '@/components/ui/sheet'.",
            },
          ],
        },
      ],
    },
  },
];

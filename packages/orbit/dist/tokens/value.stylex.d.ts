import * as stylex from '@stylexjs/stylex';
export declare const palette: stylex.VarGroup<Readonly<{
    readonly white: "#ffffff";
    readonly black: "#000000";
    readonly gray50: "oklch(0.985 0.002 247.839)";
    readonly gray100: "oklch(0.967 0.003 264.542)";
    readonly gray200: "oklch(0.928 0.006 264.531)";
    readonly gray300: "oklch(0.872 0.01 258.338)";
    readonly gray400: "oklch(0.707 0.022 261.325)";
    readonly gray500: "oklch(0.551 0.027 264.364)";
    readonly gray600: "oklch(0.446 0.03 256.802)";
    readonly gray700: "oklch(0.373 0.034 259.733)";
    readonly gray800: "oklch(0.278 0.033 256.848)";
    readonly gray900: "oklch(0.21 0.034 264.665)";
    readonly gray950: "oklch(0.13 0.028 261.692)";
    readonly polar50: "hsl(0, 0%, 85%)";
    readonly polar100: "hsl(0, 0%, 79%)";
    readonly polar200: "hsl(0, 0%, 68%)";
    readonly polar300: "hsl(0, 0%, 62%)";
    readonly polar400: "hsl(0, 0%, 52%)";
    readonly polar500: "hsl(0, 0%, 46%)";
    readonly polar600: "hsl(0, 0%, 16%)";
    readonly polar700: "hsl(0, 0%, 13%)";
    readonly polar800: "hsl(0, 0%, 9.5%)";
    readonly polar900: "hsl(0, 0%, 6.5%)";
    readonly polar950: "hsl(0, 0%, 3.5%)";
    readonly emerald50: "oklch(0.979 0.021 166.113)";
    readonly emerald100: "oklch(0.95 0.052 163.051)";
    readonly emerald200: "oklch(0.905 0.093 164.15)";
    readonly emerald300: "oklch(0.845 0.143 164.978)";
    readonly emerald400: "oklch(0.765 0.177 163.223)";
    readonly emerald500: "oklch(0.696 0.17 162.48)";
    readonly emerald600: "oklch(0.596 0.145 163.225)";
    readonly emerald700: "oklch(0.508 0.118 165.612)";
    readonly emerald800: "oklch(0.432 0.095 166.913)";
    readonly emerald900: "oklch(0.378 0.077 168.94)";
    readonly emerald950: "oklch(0.262 0.051 172.552)";
    readonly red50: "oklch(0.971 0.013 17.38)";
    readonly red100: "oklch(0.936 0.032 17.717)";
    readonly red200: "oklch(0.885 0.062 18.334)";
    readonly red300: "oklch(0.808 0.114 19.571)";
    readonly red400: "oklch(0.704 0.191 22.216)";
    readonly red500: "oklch(0.637 0.237 25.331)";
    readonly red600: "oklch(0.577 0.245 27.325)";
    readonly red700: "oklch(0.505 0.213 27.518)";
    readonly red800: "oklch(0.444 0.177 26.899)";
    readonly red900: "oklch(0.396 0.141 25.723)";
    readonly red950: "oklch(0.258 0.092 26.042)";
    readonly amber50: "oklch(0.987 0.022 95.277)";
    readonly amber100: "oklch(0.962 0.059 95.617)";
    readonly amber200: "oklch(0.924 0.12 95.746)";
    readonly amber300: "oklch(0.879 0.169 91.605)";
    readonly amber400: "oklch(0.828 0.189 84.429)";
    readonly amber500: "oklch(0.769 0.188 70.08)";
    readonly amber600: "oklch(0.666 0.179 58.318)";
    readonly amber700: "oklch(0.555 0.163 48.998)";
    readonly amber800: "oklch(0.473 0.137 46.201)";
    readonly amber900: "oklch(0.414 0.112 45.904)";
    readonly amber950: "oklch(0.279 0.077 45.635)";
    readonly indigo50: "oklch(0.962 0.018 272.314)";
    readonly indigo100: "oklch(0.93 0.034 272.788)";
    readonly indigo200: "oklch(0.87 0.065 274.039)";
    readonly indigo300: "oklch(0.785 0.115 274.713)";
    readonly indigo400: "oklch(0.673 0.182 276.935)";
    readonly indigo500: "oklch(0.585 0.233 277.117)";
    readonly indigo600: "oklch(0.511 0.262 276.966)";
    readonly indigo700: "oklch(0.457 0.24 277.023)";
    readonly indigo800: "oklch(0.398 0.195 277.366)";
    readonly indigo900: "oklch(0.359 0.144 278.697)";
    readonly indigo950: "oklch(0.257 0.09 281.288)";
}>, symbol>;
export declare const fontSizes: stylex.VarGroup<Readonly<{
    readonly 1: "0.75rem";
    readonly 2: "0.875rem";
    readonly 3: "1rem";
    readonly 4: "1.125rem";
    readonly 5: "1.25rem";
    readonly 6: "1.5rem";
    readonly 7: "1.875rem";
    readonly 8: "2.25rem";
    readonly 9: "3rem";
    readonly 10: "3.75rem";
    readonly 11: "4.5rem";
    readonly 12: "6rem";
}>, symbol>;
export declare const lineHeights: stylex.VarGroup<Readonly<{
    readonly none: "1";
    readonly tight: "1.25";
    readonly snug: "1.375";
    readonly normal: "1.5";
    readonly relaxed: "1.625";
}>, symbol>;
export declare const fontWeights: stylex.VarGroup<Readonly<{
    readonly regular: "400";
    readonly medium: "500";
    readonly semibold: "600";
}>, symbol>;
export declare const letterSpacings: stylex.VarGroup<Readonly<{
    readonly tight: "-0.02em";
    readonly normal: "0";
    readonly wide: "0.025em";
}>, symbol>;
export declare const fontFamilies: stylex.VarGroup<Readonly<{
    readonly sans: "'PP Neue Montreal', 'Inter', sans-serif";
    readonly display: "'PP Neue Montreal', 'InterDisplay', sans-serif";
    readonly mono: "'GeistMono', monospace";
}>, symbol>;
export declare const spacing: stylex.VarGroup<Readonly<{
    readonly none: "0";
    readonly xs: "4px";
    readonly s: "8px";
    readonly m: "12px";
    readonly l: "16px";
    readonly xl: "24px";
    readonly '2xl': "32px";
    readonly '3xl': "48px";
    readonly '4xl': "64px";
    readonly '5xl': "96px";
}>, symbol>;
export declare const borderRadii: stylex.VarGroup<Readonly<{
    readonly none: "0";
    readonly s: "8px";
    readonly m: "12px";
    readonly l: "16px";
    readonly xl: "32px";
    readonly full: "9999px";
}>, symbol>;
export declare const shadows: stylex.VarGroup<Readonly<{
    readonly none: "none";
    readonly s: "0 1px 2px rgba(0, 0, 0, 0.05)";
    readonly m: "0 0px 15px rgba(0, 0, 0, 0.04), 0 0px 2px rgba(0, 0, 0, 0.06)";
    readonly l: "0 0px 20px rgba(0, 0, 0, 0.04), 0 0px 5px rgba(0, 0, 0, 0.06)";
    readonly xl: "0 0px 30px rgba(0, 0, 0, 0.04), 0 0px 10px rgba(0, 0, 0, 0.06)";
}>, symbol>;
export declare const breakpoints: {
    readonly sm: 640;
    readonly md: 768;
    readonly lg: 1024;
    readonly xl: 1280;
};
export declare const durations: stylex.VarGroup<Readonly<{
    readonly instant: "0ms";
    readonly fast: "120ms";
    readonly base: "200ms";
    readonly slow: "320ms";
    readonly slower: "480ms";
}>, symbol>;
export declare const easings: {
    readonly standard: "cubic-bezier(0.2, 0, 0, 1)";
    readonly decelerate: "cubic-bezier(0, 0, 0, 1)";
    readonly accelerate: "cubic-bezier(0.3, 0, 1, 1)";
    readonly spring: "cubic-bezier(0.5, 1.25, 0.4, 1)";
};
type StyleXTokenKeys<T> = Exclude<keyof T, '__opaqueId' | '__tokens' | symbol | 'toString' | 'valueOf' | 'description'>;
export type PaletteToken = StyleXTokenKeys<typeof palette>;
export type FontSizeToken = StyleXTokenKeys<typeof fontSizes>;
export type LineHeightToken = StyleXTokenKeys<typeof lineHeights>;
export type FontWeightToken = StyleXTokenKeys<typeof fontWeights>;
export type LetterSpacingToken = StyleXTokenKeys<typeof letterSpacings>;
export type FontFamilyToken = StyleXTokenKeys<typeof fontFamilies>;
export type PositiveSpacingToken = StyleXTokenKeys<typeof spacing>;
export type NegativeSpacingToken = `-${Exclude<PositiveSpacingToken, 'none'>}`;
/**
 * The full spacing scale, mirrored into negatives (`'-xs'` … `'-5xl'`,
 * resolved as `calc(token * -1)`). Props where negative lengths are invalid
 * CSS (padding, gap) accept only `PositiveSpacingToken`.
 */
export type SpacingToken = PositiveSpacingToken | NegativeSpacingToken;
export type BorderRadiusToken = StyleXTokenKeys<typeof borderRadii>;
export type ShadowToken = StyleXTokenKeys<typeof shadows>;
export type BreakpointKey = keyof typeof breakpoints;
export type DurationToken = StyleXTokenKeys<typeof durations>;
export type EasingToken = keyof typeof easings;
export {};

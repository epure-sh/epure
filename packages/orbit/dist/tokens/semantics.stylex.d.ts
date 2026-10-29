import * as stylex from '@stylexjs/stylex';
export declare const backgroundColors: stylex.VarGroup<Readonly<{
    readonly 'background-primary': `light-dark(${stylex.StyleXVar<"#ffffff">}, ${stylex.StyleXVar<"hsl(0, 0%, 3.5%)">})`;
    readonly 'background-secondary': `light-dark(${stylex.StyleXVar<"oklch(0.985 0.002 247.839)">}, ${stylex.StyleXVar<"hsl(0, 0%, 6.5%)">})`;
    readonly 'background-card': `light-dark(${stylex.StyleXVar<"oklch(0.967 0.003 264.542)">}, ${stylex.StyleXVar<"hsl(0, 0%, 9.5%)">})`;
    readonly 'background-inverse': `light-dark(${stylex.StyleXVar<"oklch(0.21 0.034 264.665)">}, ${stylex.StyleXVar<"#ffffff">})`;
    readonly 'background-accent': `light-dark(${stylex.StyleXVar<"oklch(0.962 0.018 272.314)">}, ${stylex.StyleXVar<"oklch(0.257 0.09 281.288)">})`;
    readonly 'background-warning': `light-dark(${stylex.StyleXVar<"oklch(0.987 0.022 95.277)">}, ${stylex.StyleXVar<"oklch(0.279 0.077 45.635)">})`;
    readonly 'background-success': `light-dark(${stylex.StyleXVar<"oklch(0.979 0.021 166.113)">}, ${stylex.StyleXVar<"oklch(0.262 0.051 172.552)">})`;
    readonly 'background-danger': `light-dark(${stylex.StyleXVar<"oklch(0.971 0.013 17.38)">}, ${stylex.StyleXVar<"oklch(0.258 0.092 26.042)">})`;
}>, symbol>;
export declare const textColors: stylex.VarGroup<Readonly<{
    readonly 'text-primary': `light-dark(${stylex.StyleXVar<"#000000">}, ${stylex.StyleXVar<"#ffffff">})`;
    readonly 'text-secondary': `light-dark(${stylex.StyleXVar<"oklch(0.551 0.027 264.364)">}, ${stylex.StyleXVar<"hsl(0, 0%, 52%)">})`;
    readonly 'text-tertiary': `light-dark(${stylex.StyleXVar<"oklch(0.707 0.022 261.325)">}, ${stylex.StyleXVar<"hsl(0, 0%, 46%)">})`;
    readonly 'text-disabled': `light-dark(${stylex.StyleXVar<"oklch(0.872 0.01 258.338)">}, ${stylex.StyleXVar<"hsl(0, 0%, 16%)">})`;
    readonly 'text-success': `light-dark(${stylex.StyleXVar<"oklch(0.696 0.17 162.48)">}, ${stylex.StyleXVar<"oklch(0.696 0.17 162.48)">})`;
    readonly 'text-danger': `light-dark(${stylex.StyleXVar<"oklch(0.637 0.237 25.331)">}, ${stylex.StyleXVar<"oklch(0.637 0.237 25.331)">})`;
    readonly 'text-warning': `light-dark(${stylex.StyleXVar<"oklch(0.769 0.188 70.08)">}, ${stylex.StyleXVar<"oklch(0.769 0.188 70.08)">})`;
    readonly 'text-accent': `light-dark(${stylex.StyleXVar<"oklch(0.585 0.233 277.117)">}, ${stylex.StyleXVar<"oklch(0.585 0.233 277.117)">})`;
}>, symbol>;
export declare const borderColors: stylex.VarGroup<Readonly<{
    readonly 'border-primary': `light-dark(${stylex.StyleXVar<"oklch(0.928 0.006 264.531)">}, ${stylex.StyleXVar<"hsl(0, 0%, 13%)">})`;
    readonly 'border-secondary': `light-dark(${stylex.StyleXVar<"oklch(0.967 0.003 264.542)">}, ${stylex.StyleXVar<"hsl(0, 0%, 9.5%)">})`;
    readonly 'border-warning': `light-dark(${stylex.StyleXVar<"oklch(0.879 0.169 91.605)">}, ${stylex.StyleXVar<"oklch(0.555 0.163 48.998)">})`;
}>, symbol>;
export declare const textRoleStyles: Readonly<{
    readonly default: Readonly<{
        readonly fontFamily: stylex.StyleXClassNameFor<"fontFamily", "'PP Neue Montreal', 'Inter', sans-serif">;
        readonly fontSize: stylex.StyleXClassNameFor<"fontSize", "0.875rem">;
        readonly lineHeight: stylex.StyleXClassNameFor<"lineHeight", "1.5">;
    }>;
    readonly title: Readonly<{
        readonly fontFamily: stylex.StyleXClassNameFor<"fontFamily", "'PP Neue Montreal', 'Inter', sans-serif">;
        readonly fontSize: stylex.StyleXClassNameFor<"fontSize", "0.875rem">;
        readonly lineHeight: stylex.StyleXClassNameFor<"lineHeight", "1.5">;
        readonly fontWeight: stylex.StyleXClassNameFor<"fontWeight", "500">;
    }>;
    readonly body: Readonly<{
        readonly fontFamily: stylex.StyleXClassNameFor<"fontFamily", "'PP Neue Montreal', 'Inter', sans-serif">;
        readonly fontSize: stylex.StyleXClassNameFor<"fontSize", "1rem">;
        readonly lineHeight: stylex.StyleXClassNameFor<"lineHeight", "1.5">;
    }>;
    readonly label: Readonly<{
        readonly fontFamily: stylex.StyleXClassNameFor<"fontFamily", "'PP Neue Montreal', 'Inter', sans-serif">;
        readonly fontSize: stylex.StyleXClassNameFor<"fontSize", "0.75rem">;
        readonly lineHeight: stylex.StyleXClassNameFor<"lineHeight", "1.375">;
        readonly fontWeight: stylex.StyleXClassNameFor<"fontWeight", "500">;
    }>;
    readonly caption: Readonly<{
        readonly fontFamily: stylex.StyleXClassNameFor<"fontFamily", "'PP Neue Montreal', 'Inter', sans-serif">;
        readonly fontSize: stylex.StyleXClassNameFor<"fontSize", "0.75rem">;
        readonly lineHeight: stylex.StyleXClassNameFor<"lineHeight", "1.375">;
    }>;
    readonly 'heading-2xl': Readonly<{
        readonly fontFamily: stylex.StyleXClassNameFor<"fontFamily", "'PP Neue Montreal', 'InterDisplay', sans-serif">;
        readonly fontSize: stylex.StyleXClassNameFor<"fontSize", "3.75rem" | "6rem">;
        readonly lineHeight: stylex.StyleXClassNameFor<"lineHeight", "1">;
        readonly fontWeight: stylex.StyleXClassNameFor<"fontWeight", "400">;
        readonly letterSpacing: stylex.StyleXClassNameFor<"letterSpacing", "0em">;
    }>;
    readonly 'heading-xl': Readonly<{
        readonly fontFamily: stylex.StyleXClassNameFor<"fontFamily", "'PP Neue Montreal', 'InterDisplay', sans-serif">;
        readonly fontSize: stylex.StyleXClassNameFor<"fontSize", "3rem" | "4.5rem">;
        readonly lineHeight: stylex.StyleXClassNameFor<"lineHeight", "1">;
        readonly fontWeight: stylex.StyleXClassNameFor<"fontWeight", "400">;
        readonly letterSpacing: stylex.StyleXClassNameFor<"letterSpacing", "0em">;
    }>;
    readonly 'heading-l': Readonly<{
        readonly fontFamily: stylex.StyleXClassNameFor<"fontFamily", "'PP Neue Montreal', 'InterDisplay', sans-serif">;
        readonly fontSize: stylex.StyleXClassNameFor<"fontSize", "2.25rem" | "3rem">;
        readonly lineHeight: stylex.StyleXClassNameFor<"lineHeight", "1.25">;
        readonly fontWeight: stylex.StyleXClassNameFor<"fontWeight", "400">;
        readonly letterSpacing: stylex.StyleXClassNameFor<"letterSpacing", "0em">;
    }>;
    readonly 'heading-m': Readonly<{
        readonly fontFamily: stylex.StyleXClassNameFor<"fontFamily", "'PP Neue Montreal', 'Inter', sans-serif">;
        readonly fontSize: stylex.StyleXClassNameFor<"fontSize", "1.875rem" | "2.25rem">;
        readonly lineHeight: stylex.StyleXClassNameFor<"lineHeight", "1.25">;
        readonly fontWeight: stylex.StyleXClassNameFor<"fontWeight", "400">;
        readonly letterSpacing: stylex.StyleXClassNameFor<"letterSpacing", "0em">;
    }>;
    readonly 'heading-s': Readonly<{
        readonly fontFamily: stylex.StyleXClassNameFor<"fontFamily", "'PP Neue Montreal', 'Inter', sans-serif">;
        readonly fontSize: stylex.StyleXClassNameFor<"fontSize", "1.5rem" | "1.875rem">;
        readonly lineHeight: stylex.StyleXClassNameFor<"lineHeight", "1.375">;
        readonly fontWeight: stylex.StyleXClassNameFor<"fontWeight", "400">;
        readonly letterSpacing: stylex.StyleXClassNameFor<"letterSpacing", "0em">;
    }>;
    readonly 'heading-xs': Readonly<{
        readonly fontFamily: stylex.StyleXClassNameFor<"fontFamily", "'PP Neue Montreal', 'Inter', sans-serif">;
        readonly fontSize: stylex.StyleXClassNameFor<"fontSize", "1.25rem" | "1.5rem">;
        readonly lineHeight: stylex.StyleXClassNameFor<"lineHeight", "1.375">;
        readonly fontWeight: stylex.StyleXClassNameFor<"fontWeight", "400">;
    }>;
    readonly 'heading-xxs': Readonly<{
        readonly fontFamily: stylex.StyleXClassNameFor<"fontFamily", "'PP Neue Montreal', 'Inter', sans-serif">;
        readonly fontSize: stylex.StyleXClassNameFor<"fontSize", "1.125rem" | "1.25rem">;
        readonly lineHeight: stylex.StyleXClassNameFor<"lineHeight", "1.375">;
        readonly fontWeight: stylex.StyleXClassNameFor<"fontWeight", "400">;
    }>;
}>;
export declare const textColorStyles: Readonly<{
    readonly default: Readonly<{
        readonly color: stylex.StyleXClassNameFor<"color", `light-dark(${stylex.StyleXVar<"#000000">}, ${stylex.StyleXVar<"#ffffff">})`>;
    }>;
    readonly muted: Readonly<{
        readonly color: stylex.StyleXClassNameFor<"color", `light-dark(${stylex.StyleXVar<"oklch(0.551 0.027 264.364)">}, ${stylex.StyleXVar<"hsl(0, 0%, 52%)">})`>;
    }>;
    readonly disabled: Readonly<{
        readonly color: stylex.StyleXClassNameFor<"color", `light-dark(${stylex.StyleXVar<"oklch(0.872 0.01 258.338)">}, ${stylex.StyleXVar<"hsl(0, 0%, 16%)">})`>;
    }>;
    readonly accent: Readonly<{
        readonly color: stylex.StyleXClassNameFor<"color", `light-dark(${stylex.StyleXVar<"oklch(0.585 0.233 277.117)">}, ${stylex.StyleXVar<"oklch(0.585 0.233 277.117)">})`>;
    }>;
    readonly danger: Readonly<{
        readonly color: stylex.StyleXClassNameFor<"color", `light-dark(${stylex.StyleXVar<"oklch(0.637 0.237 25.331)">}, ${stylex.StyleXVar<"oklch(0.637 0.237 25.331)">})`>;
    }>;
    readonly error: Readonly<{
        readonly color: stylex.StyleXClassNameFor<"color", `light-dark(${stylex.StyleXVar<"oklch(0.637 0.237 25.331)">}, ${stylex.StyleXVar<"oklch(0.637 0.237 25.331)">})`>;
    }>;
    readonly warning: Readonly<{
        readonly color: stylex.StyleXClassNameFor<"color", `light-dark(${stylex.StyleXVar<"oklch(0.769 0.188 70.08)">}, ${stylex.StyleXVar<"oklch(0.769 0.188 70.08)">})`>;
    }>;
    readonly success: Readonly<{
        readonly color: stylex.StyleXClassNameFor<"color", `light-dark(${stylex.StyleXVar<"oklch(0.696 0.17 162.48)">}, ${stylex.StyleXVar<"oklch(0.696 0.17 162.48)">})`>;
    }>;
    readonly inverse: Readonly<{
        readonly color: stylex.StyleXClassNameFor<"color", `light-dark(${stylex.StyleXVar<"#ffffff">}, ${stylex.StyleXVar<"#000000">})`>;
    }>;
    readonly white: Readonly<{
        readonly color: stylex.StyleXClassNameFor<"color", "#ffffff">;
    }>;
    readonly black: Readonly<{
        readonly color: stylex.StyleXClassNameFor<"color", "#000000">;
    }>;
    readonly inherit: Readonly<{}>;
}>;
type StyleXTokenKeys<T> = Exclude<keyof T, '__opaqueId' | '__tokens' | symbol | 'toString' | 'valueOf' | 'description'>;
export type BackgroundColorToken = StyleXTokenKeys<typeof backgroundColors>;
export type TextColorToken = StyleXTokenKeys<typeof textColors>;
export type BorderColorToken = StyleXTokenKeys<typeof borderColors>;
export type ColorToken = BackgroundColorToken | TextColorToken | BorderColorToken;
export {};

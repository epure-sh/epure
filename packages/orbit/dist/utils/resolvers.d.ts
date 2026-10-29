import * as stylex from '@stylexjs/stylex';
import type React from 'react';
import type { BoxStyleProps } from './types';
export declare const BOX_STYLE_PROP_KEYS: Set<string>;
export interface ResolvedStyles {
    stylexStyles: stylex.StyleXStyles[];
    inlineStyle: React.CSSProperties;
    responsiveCSS: string | null;
}
export declare function resolveBoxStyles(props: BoxStyleProps, scopeClass: string): ResolvedStyles;

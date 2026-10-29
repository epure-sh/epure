import { type ComponentPropsWithoutRef, type JSX, type ReactNode } from 'react';
type TextTag = 'p' | 'span' | 'label' | 'strong' | 'em' | 'small' | 'code' | 'div' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
export type TextVariant = 'default' | 'title' | 'body' | 'label' | 'caption' | 'heading-2xl' | 'heading-xl' | 'heading-l' | 'heading-m' | 'heading-s' | 'heading-xs' | 'heading-xxs';
export type TextColor = 'default' | 'muted' | 'disabled' | 'accent' | 'danger' | 'error' | 'warning' | 'success' | 'inverse' | 'white' | 'black' | 'inherit';
export type TextAlign = 'left' | 'center' | 'right' | 'justify';
export type TextWrap = 'wrap' | 'nowrap' | 'balance' | 'pretty';
export type TextLeading = 'none' | 'tight' | 'snug' | 'normal' | 'relaxed';
export type TextStyleProps = {
    variant?: TextVariant;
    color?: TextColor;
    align?: TextAlign;
    wrap?: TextWrap;
    leading?: TextLeading;
};
/**
 * How to render the value passed as children. A named preset keeps the common
 * cases discoverable; the function form is the escape hatch for the long tail
 * (currency, units, locale-specific rules). Either way the output is a string,
 * so no visual decision leaks out of the component.
 */
export type TextFormatter = 'number' | 'compact' | ((value: string | number) => string);
type TextProps<E extends TextTag = 'p'> = TextStyleProps & {
    /**
     * The role this text plays, which decides its size, weight and font family.
     * Headings use the display scale; `body`/`default`/`label`/`caption` cover
     * supporting copy. Pick the role, never a raw size.
     */
    variant?: TextStyleProps['variant'];
    /**
     * Semantic foreground color that resolves for light and dark automatically.
     * Use `inherit` to adopt the color of a parent Box.
     */
    color?: TextStyleProps['color'];
    /**
     * Underlying DOM element. Defaults to a sensible element per variant (heading
     * variants render `h1`–`h6`, everything else `p`). Override to keep a correct
     * document outline. DOM props for the element are typed and forwarded.
     */
    as?: E;
    /**
     * Horizontal text alignment.
     */
    align?: TextStyleProps['align'];
    /**
     * Line-wrapping behavior. Defaults are baked per role (headings `balance`,
     * body `pretty`); set this to override. Ignored while truncating.
     */
    wrap?: TextStyleProps['wrap'];
    /**
     * Line height, overriding the variant's default. Headings default to `snug`;
     * use `tight` when a multi-line headline needs to read as one block.
     */
    leading?: TextStyleProps['leading'];
    /**
     * The text to render. Prefer plain strings and numbers; inline elements are
     * allowed where you genuinely need them (a `<br>`, an inline link), but reach
     * for Box to compose layout rather than nesting containers inside Text.
     */
    children?: ReactNode;
    /**
     * Render a pulsing skeleton placeholder instead of children, for content that
     * is still loading.
     */
    loading?: boolean;
    /**
     * Sizes the single-line loading skeleton. Falls back to children, then to
     * "Loading...".
     */
    placeholderText?: string;
    /**
     * When greater than 1, renders a multi-line loading skeleton with that many
     * lines.
     */
    placeholderNumberOfLines?: number;
    /**
     * Apply a line-through decoration, e.g. for a struck-out previous price.
     */
    lineThrough?: boolean;
    /**
     * Render in the monospace font family while keeping the variant's size and
     * weight. Orthogonal to `variant`, so any text can be monospaced.
     */
    monospace?: boolean;
    /**
     * Align figures for vertical scanning in tables and stat readouts. Pairs well
     * with a numeric `formatter`.
     */
    tabularNums?: boolean;
    /**
     * Truncate overflow. `true` clamps to a single line with an ellipsis; a
     * number clamps to that many lines. The component owns the CSS, so callers
     * never hand-roll line-clamp utilities.
     */
    truncate?: boolean | number;
    /**
     * Format the children value for display. 'number' adds grouping separators
     * (3290033 → "3,290,033"), 'compact' shortens (3290033 → "3.3M"), or pass a
     * function for full control. Pass the raw value as children, not a
     * pre-formatted string.
     */
    formatter?: TextFormatter;
} & Omit<ComponentPropsWithoutRef<E>, keyof TextStyleProps | 'className' | 'loading' | 'children'>;
declare function Text<E extends TextTag = 'p'>({ as, variant, color, align, wrap, leading, children, style, loading, placeholderText, placeholderNumberOfLines, lineThrough, monospace, tabularNums, truncate, formatter, ...props }: TextProps<E> & {
    style?: React.CSSProperties;
}): JSX.Element;
declare namespace Text {
    var displayName: string;
}
export declare function createText(): typeof Text;
export { Text };

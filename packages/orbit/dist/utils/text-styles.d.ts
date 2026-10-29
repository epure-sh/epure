import * as stylex from '@stylexjs/stylex';
export declare const textAlignStyles: Readonly<{
    readonly left: Readonly<{
        readonly textAlign: stylex.StyleXClassNameFor<"textAlign", "left">;
    }>;
    readonly center: Readonly<{
        readonly textAlign: stylex.StyleXClassNameFor<"textAlign", "center">;
    }>;
    readonly right: Readonly<{
        readonly textAlign: stylex.StyleXClassNameFor<"textAlign", "right">;
    }>;
    readonly justify: Readonly<{
        readonly textAlign: stylex.StyleXClassNameFor<"textAlign", "justify">;
    }>;
}>;
export declare const textWrapStyles: Readonly<{
    readonly wrap: Readonly<{
        readonly textWrap: stylex.StyleXClassNameFor<"textWrap", "wrap">;
    }>;
    readonly nowrap: Readonly<{
        readonly textWrap: stylex.StyleXClassNameFor<"textWrap", "nowrap">;
    }>;
    readonly balance: Readonly<{
        readonly textWrap: stylex.StyleXClassNameFor<"textWrap", "balance">;
    }>;
    readonly pretty: Readonly<{
        readonly textWrap: stylex.StyleXClassNameFor<"textWrap", "pretty">;
    }>;
}>;
export declare const textLeadingStyles: Readonly<{
    readonly none: Readonly<{
        readonly lineHeight: stylex.StyleXClassNameFor<"lineHeight", "1">;
    }>;
    readonly tight: Readonly<{
        readonly lineHeight: stylex.StyleXClassNameFor<"lineHeight", "1.25">;
    }>;
    readonly snug: Readonly<{
        readonly lineHeight: stylex.StyleXClassNameFor<"lineHeight", "1.375">;
    }>;
    readonly normal: Readonly<{
        readonly lineHeight: stylex.StyleXClassNameFor<"lineHeight", "1.5">;
    }>;
    readonly relaxed: Readonly<{
        readonly lineHeight: stylex.StyleXClassNameFor<"lineHeight", "1.625">;
    }>;
}>;
export declare const textUtilityStyles: Readonly<{
    readonly monospace: Readonly<{
        readonly fontFamily: stylex.StyleXClassNameFor<"fontFamily", "'GeistMono', monospace">;
    }>;
    readonly tabularNums: Readonly<{
        readonly fontVariantNumeric: stylex.StyleXClassNameFor<"fontVariantNumeric", "tabular-nums">;
    }>;
    readonly lineThrough: Readonly<{
        readonly textDecoration: stylex.StyleXClassNameFor<"textDecoration", "line-through">;
    }>;
    readonly truncate: Readonly<{
        readonly overflow: stylex.StyleXClassNameFor<"overflow", "hidden">;
        readonly textOverflow: stylex.StyleXClassNameFor<"textOverflow", "ellipsis">;
        readonly whiteSpace: stylex.StyleXClassNameFor<"whiteSpace", "nowrap">;
    }>;
}>;

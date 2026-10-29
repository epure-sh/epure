import * as React from 'react';
import type { GridLine } from '../utils/grid';
import type { ResponsiveValue } from '../utils/types';
import { type BoxProps } from './Box';
type OmittedGridItemProps = 'gridArea' | 'gridColumn' | 'gridRow' | 'gridColumnStart' | 'gridColumnEnd' | 'gridRowStart' | 'gridRowEnd';
type Span = ResponsiveValue<number | 'auto'>;
type Line = ResponsiveValue<GridLine>;
export interface GridItemProps extends Omit<BoxProps, OmittedGridItemProps> {
    /** `grid-area`. */
    area?: ResponsiveValue<string>;
    /** Number of columns to span, or `"auto"`. */
    colSpan?: Span;
    /** `grid-column-start`. */
    colStart?: Line;
    /** `grid-column-end`. */
    colEnd?: Line;
    /** Number of rows to span, or `"auto"`. */
    rowSpan?: Span;
    /** `grid-row-start`. */
    rowStart?: Line;
    /** `grid-row-end`. */
    rowEnd?: Line;
}
/**
 * GridItem positions a single child inside a `Grid`. `colSpan`/`rowSpan` set how
 * many tracks the item spans; `colStart`/`colEnd`/`rowStart`/`rowEnd` and `area`
 * place it explicitly. All other Box props are inherited.
 */
export declare const GridItem: React.ForwardRefExoticComponent<GridItemProps & React.RefAttributes<HTMLElement>>;
export {};

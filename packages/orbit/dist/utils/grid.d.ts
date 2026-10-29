/** A single grid line: a (possibly negative) line number, `auto`, or a span. */
export type GridLine = number | 'auto' | `span ${number}`;
/** A `grid-column` / `grid-row` value: a single line, or `<start> / <end>`. */
export type GridPlacement = GridLine | `${GridLine} / ${GridLine}`;

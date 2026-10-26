// src/components/kit/data-table.tsx
import * as React from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";

export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  height?: number | string;
  estimateRowHeight?: number;
  emptyMessage?: string;
  onRowClick?: (row: TData) => void;
  className?: string;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  height = 400,
  estimateRowHeight = 36,
  emptyMessage = "No results found.",
  onRowClick,
  className,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const parentRef = React.useRef<HTMLDivElement>(null);
  const rows = table.getRowModel().rows;

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateRowHeight,
    overscan: 10,
  });

  return (
    <div
      data-slot="data-table"
      className={cn(
        "rounded-panel border border-border-subtle bg-surface-1 shadow-tactile overflow-hidden flex flex-col",
        className
      )}
    >
      {/* Locked Header Row */}
      <div className="shrink-0 border-b border-border-subtle bg-surface-1/90 px-3">
        {table.getHeaderGroups().map((headerGroup) => (
          <div
            key={headerGroup.id}
            className="flex h-8 items-center text-[11px] font-semibold text-fg-muted uppercase tracking-wider select-none"
          >
            {headerGroup.headers.map((header) => (
              <div
                key={header.id}
                ref={(el) => {
                  if (el) el.style.width = `${header.getSize()}px`;
                }}
                className={cn(
                  "px-2 truncate",
                  header.column.getCanSort() && "cursor-pointer hover:text-fg-primary"
                )}
                onClick={header.column.getToggleSortingHandler()}
              >
                {header.isPlaceholder
                  ? null
                  : flexRender(header.column.columnDef.header, header.getContext())}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Virtualized Body */}
      <div
        ref={(el) => {
          parentRef.current = el;
          if (el) el.style.height = typeof height === "number" ? `${height}px` : height;
        }}
        className="flex-1 overflow-auto divide-y divide-border-subtle"
      >
        {rows.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-xs text-fg-muted">
            {emptyMessage}
          </div>
        ) : (
          <div
            ref={(el) => {
              if (el) {
                el.style.height = `${rowVirtualizer.getTotalSize()}px`;
                el.style.width = "100%";
                el.style.position = "relative";
              }
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index];
              return (
                <div
                  key={row.id}
                  data-index={virtualRow.index}
                  onClick={() => onRowClick?.(row.original)}
                  ref={(el) => {
                    if (el) {
                      el.style.position = "absolute";
                      el.style.top = "0";
                      el.style.left = "0";
                      el.style.width = "100%";
                      el.style.height = `${virtualRow.size}px`;
                      el.style.transform = `translateY(${virtualRow.start}px)`;
                    }
                  }}
                  className={cn(
                    "flex select-none items-center px-3 text-[13px] tabular-nums text-fg-primary transition-[background-color] duration-150 ease-snap",
                    onRowClick && "cursor-pointer hover:bg-surface-2/60",
                    row.getIsSelected() ? "bg-surface-2" : "hover:bg-surface-2/40"
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <div
                      key={cell.id}
                      ref={(el) => {
                        if (el) el.style.width = `${cell.column.getSize()}px`;
                      }}
                      className="px-2 truncate"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

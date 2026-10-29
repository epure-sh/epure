import type { Cell, CellContext, Column, ColumnDef, ReactTable, Row, RowData } from '@tanstack/react-table';
export declare const dataTableFeatures: {
    columnSizingFeature: import("@tanstack/table-core").TableFeature;
    columnVisibilityFeature: import("@tanstack/table-core").TableFeature;
    rowExpandingFeature: import("@tanstack/table-core").TableFeature;
    expandedRowModel: (table: import("@tanstack/table-core").Table<any, any>) => () => import("@tanstack/table-core").RowModel<any, any>;
    rowPaginationFeature: import("@tanstack/table-core").TableFeature;
    rowSortingFeature: import("@tanstack/table-core").TableFeature;
};
export type DataTableFeatures = typeof dataTableFeatures;
export type DataTableCell<TData extends RowData, TValue = unknown> = Cell<DataTableFeatures, TData, TValue>;
export type DataTableCellContext<TData extends RowData, TValue = unknown> = CellContext<DataTableFeatures, TData, TValue>;
export type DataTableColumn<TData extends RowData, TValue = unknown> = Column<DataTableFeatures, TData, TValue>;
export type DataTableColumnDef<TData extends RowData, TValue = unknown> = ColumnDef<DataTableFeatures, TData, TValue>;
export type DataTableInstance<TData extends RowData> = ReactTable<DataTableFeatures, TData>;
export type DataTableRow<TData extends RowData> = Row<DataTableFeatures, TData>;

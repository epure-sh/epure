import { OnChangeFn, PaginationState, RowData, SortingState } from '@tanstack/react-table';
import React from 'react';
import { DataTableSelection } from './DataTableSelectionColumn';
import { DataTableCell, DataTableColumnDef, DataTableRow } from './features';
export interface ReactQueryLoading {
    isFetching: boolean;
    isFetched: boolean;
    isLoading: boolean;
    status: string;
    fetchStatus: string;
}
interface DataTableProps<TData extends RowData> {
    columns: DataTableColumnDef<TData>[];
    data: TData[];
    rowCount?: number;
    pageCount?: number;
    pagination?: PaginationState;
    onPaginationChange?: OnChangeFn<PaginationState>;
    sorting?: SortingState;
    onSortingChange?: OnChangeFn<SortingState>;
    getSubRows?: (row: TData) => TData[] | undefined;
    className?: string;
    wrapperClassName?: string;
    headerClassName?: string;
    isLoading: boolean | ReactQueryLoading;
    getCellColSpan?: (cell: DataTableCell<TData, unknown>) => number;
    getRowId?: (originalRow: TData, index: number, parent?: DataTableRow<TData>) => string;
    selection?: DataTableSelection<TData>;
    onRowClick?: (row: DataTableRow<TData>) => void;
    isRowActive?: (row: DataTableRow<TData>) => boolean;
}
export type DataTablePaginationState = PaginationState;
export type DataTableSortingState = SortingState;
export declare function DataTable<TData extends RowData>({ columns, data, rowCount, pageCount, pagination, onPaginationChange, sorting, onSortingChange, getSubRows, className, wrapperClassName, headerClassName, isLoading, getCellColSpan, getRowId, selection, onRowClick, isRowActive, }: DataTableProps<TData>): React.JSX.Element;
export {};

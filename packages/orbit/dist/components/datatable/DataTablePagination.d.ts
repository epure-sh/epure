import { RowData } from '@tanstack/react-table';
import { DataTableInstance } from './features';
interface DataTablePaginationProps<TData extends RowData> {
    table: DataTableInstance<TData>;
}
export declare function DataTablePagination<TData extends RowData>({ table, }: DataTablePaginationProps<TData>): import("react").JSX.Element;
export {};

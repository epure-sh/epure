import { RowData } from '@tanstack/react-table';
import { DataTableColumn } from './features';
interface DataTableColumnHeaderProps<TData extends RowData, TValue> extends React.HTMLAttributes<HTMLDivElement> {
    column: DataTableColumn<TData, TValue>;
    title: string;
}
export declare function DataTableColumnHeader<TData extends RowData, TValue>({ column, title, className, }: DataTableColumnHeaderProps<TData, TValue>): import("react").JSX.Element;
export {};

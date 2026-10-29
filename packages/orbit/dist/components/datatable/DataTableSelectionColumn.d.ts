import { RowData } from '@tanstack/react-table';
import { DataTableColumnDef } from './features';
export declare const SELECTION_COLUMN_ID = "select";
export declare const SELECTION_COLUMN_WIDTH = 36;
export interface DataTableSelection<TData extends RowData> {
    count: number;
    pageSelectedCount: number;
    pageSize: number;
    isSelected: (item: TData) => boolean;
    toggle: (item: TData, options?: {
        shiftKey?: boolean;
    }) => void;
    setPageSelected: (selected: boolean) => void;
}
export declare const createSelectionColumn: <TData extends RowData>(selection: DataTableSelection<TData>) => DataTableColumnDef<TData, unknown>;

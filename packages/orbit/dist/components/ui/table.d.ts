import * as React from 'react';
declare const Table: {
    ({ ref, className, ...props }: React.HTMLAttributes<HTMLTableElement> & {
        ref?: React.RefObject<HTMLTableElement>;
    }): React.JSX.Element;
    displayName: string;
};
declare const TableHeader: {
    ({ ref, className, ...props }: React.HTMLAttributes<HTMLTableSectionElement> & {
        ref?: React.RefObject<HTMLTableSectionElement>;
    }): React.JSX.Element;
    displayName: string;
};
declare const TableBody: {
    ({ ref, className, ...props }: React.HTMLAttributes<HTMLTableSectionElement> & {
        ref?: React.RefObject<HTMLTableSectionElement>;
    }): React.JSX.Element;
    displayName: string;
};
declare const TableRow: {
    ({ ref, className, ...props }: React.HTMLAttributes<HTMLTableRowElement> & {
        ref?: React.RefObject<HTMLTableRowElement>;
    }): React.JSX.Element;
    displayName: string;
};
declare const TableHead: {
    ({ ref, className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement> & {
        ref?: React.RefObject<HTMLTableCellElement>;
    }): React.JSX.Element;
    displayName: string;
};
declare const TableCell: {
    ({ ref, className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement> & {
        ref?: React.RefObject<HTMLTableCellElement>;
    }): React.JSX.Element;
    displayName: string;
};
export { Table, TableBody, TableCell, TableHead, TableHeader, TableRow };

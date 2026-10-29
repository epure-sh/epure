import { useMemo, useState } from "react";
import { Text } from "@polar-sh/orbit/Text";
import {
  DataTable,
  DataTableColumnHeader,
  type DataTableColumnDef,
  type DataTablePaginationState,
  type DataTableSortingState,
} from "@/components/kit/data-table";
import { PreviewBlock } from "../../shared";

type Row = { id: string; name: string; status: string };

const ALL: Row[] = [
  { id: "1", name: "auth", status: "healthy" },
  { id: "2", name: "ingest", status: "degraded" },
  { id: "3", name: "alerts", status: "healthy" },
  { id: "4", name: "billing", status: "pending" },
];

export default function DataTablePreview() {
  const [pagination, setPagination] = useState<DataTablePaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [sorting, setSorting] = useState<DataTableSortingState>([]);

  const columns = useMemo<DataTableColumnDef<Row>[]>(
    () => [
      {
        accessorKey: "id",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="ID" />
        ),
        cell: ({ row }) => <Text monospace>{row.original.id}</Text>,
      },
      {
        accessorKey: "name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Name" />
        ),
        cell: ({ row }) => <Text>{row.original.name}</Text>,
      },
      {
        accessorKey: "status",
        enableSorting: false,
        header: "Status",
        cell: ({ row }) => <Text color="muted">{row.original.status}</Text>,
      },
    ],
    [],
  );

  const sorted = useMemo(() => {
    const sort = sorting[0];
    if (!sort) return ALL;
    const dir = sort.desc ? -1 : 1;
    return [...ALL].sort((a, b) => {
      const av = String(a[sort.id as keyof Row] ?? "");
      const bv = String(b[sort.id as keyof Row] ?? "");
      return av.localeCompare(bv) * dir;
    });
  }, [sorting]);

  const page = useMemo(() => {
    const start = pagination.pageIndex * pagination.pageSize;
    return sorted.slice(start, start + pagination.pageSize);
  }, [pagination, sorted]);

  return (
    <PreviewBlock id="data-table" title="DataTable">
      <DataTable
        columns={columns}
        data={page}
        rowCount={sorted.length}
        isLoading={false}
        pagination={pagination}
        onPaginationChange={setPagination}
        sorting={sorting}
        onSortingChange={setSorting}
      />
    </PreviewBlock>
  );
}

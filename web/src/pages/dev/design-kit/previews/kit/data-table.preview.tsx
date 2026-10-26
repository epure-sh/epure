import { DataTable } from "@/components/kit/data-table";
import { PreviewBlock } from "../../shared";
const columns = [{ accessorKey: "id", header: "ID", size: 80 }, { accessorKey: "name", header: "Name", size: 160 }];
const data = [{ id: "1", name: "auth" }, { id: "2", name: "ingest" }];
export default function DataTablePreview() {
  return (
    <PreviewBlock id="data-table" title="DataTable"><DataTable columns={columns} data={data} height={120} /></PreviewBlock>
  );
}
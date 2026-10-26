import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PreviewBlock } from "../../shared";

export default function TablePreview() {
  return (
    <PreviewBlock id="table" title="Table">
      <Table><TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody><TableRow><TableCell className="font-mono tabular-nums">srv-01</TableCell><TableCell>healthy</TableCell></TableRow></TableBody></Table>
    </PreviewBlock>
  );
}
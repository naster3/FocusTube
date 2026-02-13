import type { CsvRow } from "../../../domain/exports/types";

const escapeCsvValue = (value: string) => `"${value.replace(/"/g, '""')}"`;

export const downloadCsv = (rows: CsvRow[], filename: string) => {
  const hasSection = rows.some((row) => row.section);
  const headers = hasSection ? ["section", "key", "value"] : ["key", "value"];
  const lines = [
    headers.map(escapeCsvValue).join(","),
    ...rows.map((row) => {
      const values = hasSection ? [row.section ?? "", row.key, row.value] : [row.key, row.value];
      return values.map(escapeCsvValue).join(",");
    })
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

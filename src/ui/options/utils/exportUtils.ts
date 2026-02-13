export type { CsvRow } from "../../../domain/exports/types";
export { extractRawJson, flattenRecord, formatValue, parseCsv } from "../../../domain/exports/format";
export { readRawJsonFromExcel } from "../../../domain/exports/importers";
export { downloadCsv } from "./csvUtils";
export { downloadXlsx } from "./xlsxUtils";

export const downloadJson = (payload: unknown, filename: string) => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

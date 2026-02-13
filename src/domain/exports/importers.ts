import * as XLSX from "xlsx";
import { extractRawJson } from "./format";

export const readRawJsonFromExcel = async (file: File) => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false }) as unknown[][];
    const rows = rawRows.map((row) => row.map((cell) => (cell === null || cell === undefined ? "" : String(cell))));
    const raw = extractRawJson(rows);
    if (raw) {
      return raw;
    }
  }
  return null;
};

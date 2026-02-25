import type { SheetData } from "../exporters/humanExcel";
import * as XLSX from "xlsx";

export const downloadXlsx = (sheets: SheetData[], filename: string) => {
  const workbook = XLSX.utils.book_new();
  sheets.forEach((sheet) => {
    const worksheet = XLSX.utils.aoa_to_sheet(sheet.rows);
    if (sheet.colWidths) {
      worksheet["!cols"] = sheet.colWidths.map((width) => ({ wch: width }));
    }
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
  });
  const out = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

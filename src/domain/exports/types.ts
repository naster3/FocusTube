export type ExportFormat = "json" | "csv" | "excel" | "pdf";
export type ExportType = "settings" | "backup";

export type CsvRow = { section?: string; key: string; value: string };

export type ExportMeta = {
  signature: string;
  version: number;
  type: ExportType;
  createdAt: string;
};

export type ExportWrapper<T = unknown> = {
  _focustube: ExportMeta;
  payload: T;
};

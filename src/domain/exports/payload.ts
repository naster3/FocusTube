import { EXPORT_SIGNATURE, EXPORT_VERSION } from "./constants";
import type { ExportType, ExportWrapper } from "./types";

export const buildExportPayload = <T>(type: ExportType, payload: T): ExportWrapper<T> => ({
  _focustube: {
    signature: EXPORT_SIGNATURE,
    version: EXPORT_VERSION,
    type,
    createdAt: new Date().toISOString()
  },
  payload
});

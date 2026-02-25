import React from "react";
import { t } from "../../../shared/i18n";
import type { ExportFormat, ExportType } from "../../../domain/exports/types";
import type { Settings } from "../../../domain/settings/types";

type ExportOption = { value: ExportFormat; label: string };

type DataPanelProps = {
  language: Settings["language"];
  settingsExportFormat: ExportFormat;
  backupExportFormat: ExportFormat;
  exportFormatOptions: ExportOption[];
  onChangeSettingsFormat: (value: ExportFormat) => void;
  onChangeBackupFormat: (value: ExportFormat) => void;
  onExportData: (kind: ExportType, format: ExportFormat) => void;
  onImportData: (file: File | null) => void;
};

export function DataPanel({
  language,
  settingsExportFormat,
  backupExportFormat,
  exportFormatOptions,
  onChangeSettingsFormat,
  onChangeBackupFormat,
  onExportData,
  onImportData,
}: DataPanelProps) {
  return (
    <section className="panel data-panel" data-guide="export">
      <h3>{t(language, "options.export.title")}</h3>
      <p className="data-note">{t(language, "options.data.pdf_note")}</p>
      <p className="data-note">{t(language, "options.data.privacy_note")}</p>
      <div className="data-grid">
        <div className="data-card" data-guide="export-settings-card">
          <div>
            <h4>{t(language, "options.data.settings_title")}</h4>
            <p className="option-desc">{t(language, "options.data.settings_desc")}</p>
          </div>
          <div className="data-actions">
            <label className="data-select">
              <span>{t(language, "options.data.format_label")}</span>
              <select
                value={settingsExportFormat}
                onChange={(event) => onChangeSettingsFormat(event.target.value as ExportFormat)}
              >
                {exportFormatOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={() => onExportData("settings", settingsExportFormat)}>
              {t(language, "options.data.export_button")}
            </button>
            <label className="import">
              {t(language, "options.data.import")}
              <input
                type="file"
                accept=".json,.csv,.xlsx,.xls,application/json,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                onChange={(event) => {
                  void onImportData(event.target.files?.[0] || null);
                  event.currentTarget.value = "";
                }}
              />
            </label>
          </div>
        </div>
        <div className="data-card" data-guide="export-backup-card">
          <div>
            <h4>{t(language, "options.data.backup_title")}</h4>
            <p className="option-desc">{t(language, "options.data.backup_desc")}</p>
          </div>
          <div className="data-actions">
            <label className="data-select">
              <span>{t(language, "options.data.format_label")}</span>
              <select
                value={backupExportFormat}
                onChange={(event) => onChangeBackupFormat(event.target.value as ExportFormat)}
              >
                {exportFormatOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={() => onExportData("backup", backupExportFormat)}>
              {t(language, "options.data.export_button")}
            </button>
            <label className="import">
              {t(language, "options.data.import")}
              <input
                type="file"
                accept=".json,.csv,.xlsx,.xls,application/json,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                onChange={(event) => {
                  void onImportData(event.target.files?.[0] || null);
                  event.currentTarget.value = "";
                }}
              />
            </label>
          </div>
        </div>
      </div>
    </section>
  );
}

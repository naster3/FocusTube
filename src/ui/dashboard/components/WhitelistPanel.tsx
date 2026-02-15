import React from "react";
import { t, tf } from "../../../shared/i18n";
import type { Settings } from "../../../domain/settings/types";
import { EmptyState } from "../../shared/components/EmptyState";

type WhitelistPanelProps = {
  language: Settings["language"];
  whitelistEnabled: boolean;
  whitelistInput: string;
  whitelist: string[];
  whitelistSlice: string[];
  whitelistTotal: number;
  whitelistStart: number;
  whitelistEnd: number;
  whitelistPageSafe: number;
  whitelistTotalPages: number;
  onToggleEnabled: (enabled: boolean) => void;
  onInputChange: (value: string) => void;
  onAdd: () => void;
  onRemove: (value: string) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
};

export function WhitelistPanel({
  language,
  whitelistEnabled,
  whitelistInput,
  whitelist,
  whitelistSlice,
  whitelistTotal,
  whitelistStart,
  whitelistEnd,
  whitelistPageSafe,
  whitelistTotalPages,
  onToggleEnabled,
  onInputChange,
  onAdd,
  onRemove,
  onPrevPage,
  onNextPage
}: WhitelistPanelProps) {
  return (
    <section className="panel" data-guide="whitelist">
      <h3>{t(language, "dashboard.whitelist.title")}</h3>
      <div className="whitelist-controls" data-guide="whitelist-controls">
        <label className="whitelist-toggle">
          <input type="checkbox" checked={whitelistEnabled} onChange={(event) => onToggleEnabled(event.target.checked)} />
          <span>{t(language, "dashboard.whitelist.enabled")}</span>
        </label>
        {!whitelistEnabled ? (
          <span className="whitelist-disabled-hint">{t(language, "dashboard.whitelist.disabled_hint")}</span>
        ) : null}
      </div>
      <div className="row" data-guide="whitelist-input-row">
        <input
          type="text"
          placeholder={t(language, "dashboard.whitelist.placeholder")}
          value={whitelistInput}
          onChange={(event) => onInputChange(event.target.value)}
        />
        <button onClick={onAdd}>{t(language, "dashboard.action.add")}</button>
      </div>
      {whitelist.length === 0 ? (
        <EmptyState
          title={t(language, "dashboard.empty.whitelist.title")}
          description={t(language, "dashboard.empty.whitelist.desc")}
        />
      ) : (
        <>
          <ul className="list whitelist-list">
            {whitelistSlice.map((entry, index) => (
              <li key={entry} className="whitelist-item" style={{ "--stagger-index": index } as React.CSSProperties}>
                <div className="whitelist-item-main">
                  <span className="whitelist-icon" aria-hidden="true">✓</span>
                  <span className="whitelist-url" title={entry}>
                    {entry}
                  </span>
                </div>
                <button className="btn-ghost btn-small" onClick={() => onRemove(entry)}>
                  {t(language, "dashboard.action.remove")}
                </button>
              </li>
            ))}
          </ul>
          {whitelistTotalPages > 1 ? (
            <div className="pagination">
              <span className="pagination-info">
                {tf(language, "dashboard.pagination.showing", {
                  from: String(whitelistStart + 1),
                  to: String(whitelistEnd),
                  total: String(whitelistTotal)
                })}
              </span>
              <div className="pagination-controls">
                <button
                  type="button"
                  className="pagination-btn"
                  onClick={onPrevPage}
                  disabled={whitelistPageSafe <= 1}
                >
                  {t(language, "dashboard.pagination.prev")}
                </button>
                <span className="pagination-page">
                  {tf(language, "dashboard.pagination.page", {
                    current: String(whitelistPageSafe),
                    total: String(whitelistTotalPages)
                  })}
                </span>
                <button
                  type="button"
                  className="pagination-btn"
                  onClick={onNextPage}
                  disabled={whitelistPageSafe >= whitelistTotalPages}
                >
                  {t(language, "dashboard.pagination.next")}
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

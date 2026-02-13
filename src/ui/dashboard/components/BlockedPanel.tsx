import React from "react";
import { t, tf } from "../../../shared/i18n";
import type { DomainTag, Settings } from "../../../domain/settings/types";
import { EmptyState } from "../../shared/components/EmptyState";

type TagOption = { value: DomainTag; label: string };

type BlockedPanelProps = {
  language: Settings["language"];
  blockedDomainInput: string;
  blockedDomains: string[];
  blockedSlice: string[];
  blockedPermissions: Record<string, boolean>;
  blockedDomainTags: Record<string, DomainTag[]>;
  blockedTagInput: DomainTag[];
  tagOptions: TagOption[];
  blockedTotal: number;
  blockedStart: number;
  blockedEnd: number;
  blockedPageSafe: number;
  blockedTotalPages: number;
  onDomainInputChange: (value: string) => void;
  onAdd: () => void;
  onRemove: (domain: string) => void;
  onToggleTagInput: (tag: DomainTag) => void;
  onToggleDomainTag: (domain: string, tag: DomainTag, enabled: boolean) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
};

export function BlockedPanel({
  language,
  blockedDomainInput,
  blockedDomains,
  blockedSlice,
  blockedPermissions,
  blockedDomainTags,
  blockedTagInput,
  tagOptions,
  blockedTotal,
  blockedStart,
  blockedEnd,
  blockedPageSafe,
  blockedTotalPages,
  onDomainInputChange,
  onAdd,
  onRemove,
  onToggleTagInput,
  onToggleDomainTag,
  onPrevPage,
  onNextPage
}: BlockedPanelProps) {
  return (
    <section className="panel" data-guide="blocked">
      <h3>{t(language, "dashboard.blocked.title")}</h3>
      <div className="row blocked-input-row">
        <input
          type="text"
          placeholder={t(language, "dashboard.blocked.placeholder")}
          value={blockedDomainInput}
          onChange={(event) => onDomainInputChange(event.target.value)}
        />
        <button onClick={onAdd}>{t(language, "dashboard.action.add")}</button>
      </div>
      <div className="tag-picker">
        <span>{t(language, "dashboard.domain.tags_label")}</span>
        <div className="tag-list">
          {tagOptions.map((tag) => {
            const active = blockedTagInput.includes(tag.value);
            return (
              <label key={tag.value} className={`tag-chip ${active ? "active" : "inactive"}`}>
                <input type="checkbox" checked={active} onChange={() => onToggleTagInput(tag.value)} />
                {tag.label}
              </label>
            );
          })}
        </div>
      </div>
      {blockedDomains.length === 0 ? (
        <EmptyState
          title={t(language, "dashboard.empty.blocked.title")}
          description={t(language, "dashboard.empty.blocked.desc")}
        />
      ) : (
        <>
          <ul className="list">
            {blockedSlice.map((entry) => {
              const hasPermission = blockedPermissions[entry] ?? true;
              const tags = blockedDomainTags[entry] ?? [];
              return (
                <li key={entry} className={`blocked-card ${hasPermission ? "" : "blocked-card-missing"}`}>
                  <div className="blocked-card-header">
                    <div className="blocked-domain-main">
                      <span className="blocked-domain-text">{entry}</span>
                      <span
                        className={`perm-dot ${hasPermission ? "perm-ok" : "perm-missing"}`}
                        title={t(
                          language,
                          hasPermission ? "dashboard.domain.permission_ok" : "dashboard.domain.permission_missing"
                        )}
                        aria-label={t(
                          language,
                          hasPermission ? "dashboard.domain.permission_ok" : "dashboard.domain.permission_missing"
                        )}
                      />
                    </div>
                    <button className="btn-ghost btn-small" onClick={() => onRemove(entry)}>
                      {t(language, "dashboard.action.remove")}
                    </button>
                  </div>
                  <div className="tag-list">
                    {tagOptions.map((tag) => {
                      const active = tags.includes(tag.value);
                      return (
                        <label key={`${entry}-${tag.value}`} className={`tag-chip ${active ? "active" : "inactive"}`}>
                          <input
                            type="checkbox"
                            checked={active}
                            onChange={(event) => onToggleDomainTag(entry, tag.value, event.target.checked)}
                          />
                          {tag.label}
                        </label>
                      );
                    })}
                    {tags.length === 0 ? (
                      <span className="tag-warning">{t(language, "dashboard.domain.tag_required")}</span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
          {blockedTotalPages > 1 ? (
            <div className="pagination">
              <span className="pagination-info">
                {tf(language, "dashboard.pagination.showing", {
                  from: String(blockedStart + 1),
                  to: String(blockedEnd),
                  total: String(blockedTotal)
                })}
              </span>
              <div className="pagination-controls">
                <button type="button" className="pagination-btn" onClick={onPrevPage} disabled={blockedPageSafe <= 1}>
                  {t(language, "dashboard.pagination.prev")}
                </button>
                <span className="pagination-page">
                  {tf(language, "dashboard.pagination.page", {
                    current: String(blockedPageSafe),
                    total: String(blockedTotalPages)
                  })}
                </span>
                <button type="button" className="pagination-btn" onClick={onNextPage} disabled={blockedPageSafe >= blockedTotalPages}>
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

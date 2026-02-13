import React from "react";
import { t } from "../../../shared/i18n";
import type { Settings } from "../../../domain/settings/types";

type StrictPanelProps = {
  language: Settings["language"];
  strictMode: boolean;
  pinInput: string;
  pinConfirm: string;
  pinCurrent: string;
  pinChangeNew: string;
  pinChangeConfirm: string;
  onPinInputChange: (value: string) => void;
  onPinConfirmChange: (value: string) => void;
  onPinCurrentChange: (value: string) => void;
  onPinChangeNewChange: (value: string) => void;
  onPinChangeConfirmChange: (value: string) => void;
  onEnableStrict: () => void;
  onDisableStrict: () => void;
  onChangePin: () => void;
};

export function StrictPanel({
  language,
  strictMode,
  pinInput,
  pinConfirm,
  pinCurrent,
  pinChangeNew,
  pinChangeConfirm,
  onPinInputChange,
  onPinConfirmChange,
  onPinCurrentChange,
  onPinChangeNewChange,
  onPinChangeConfirmChange,
  onEnableStrict,
  onDisableStrict,
  onChangePin
}: StrictPanelProps) {
  return (
    <section className="panel strict-panel">
      <div className="strict-header">
        <div>
          <h3>{t(language, "dashboard.strict.title")}</h3>
          <p className="strict-sub">
            {strictMode ? t(language, "dashboard.strict.active") : t(language, "dashboard.strict.desc")}
          </p>
        </div>
        <span className={`strict-badge ${strictMode ? "on" : "off"}`}>
          {strictMode ? t(language, "dashboard.strict.active") : t(language, "dashboard.strict.enable")}
        </span>
      </div>
      {!strictMode ? (
        <>
          <div className="strict-fields">
            <input
              type="password"
              placeholder={t(language, "dashboard.strict.pin")}
              value={pinInput}
              onChange={(event) => onPinInputChange(event.target.value)}
            />
            <input
              type="password"
              placeholder={t(language, "dashboard.strict.pin_confirm")}
              value={pinConfirm}
              onChange={(event) => onPinConfirmChange(event.target.value)}
            />
          </div>
          <div className="strict-actions">
            <button className="strict-primary" onClick={onEnableStrict}>
              {t(language, "dashboard.strict.enable")}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="strict-active">
            <span className="strict-dot" />
            <span>{t(language, "dashboard.strict.active")}</span>
          </div>
          <div className="strict-fields">
            <input
              type="password"
              placeholder={t(language, "dashboard.strict.pin_current")}
              value={pinCurrent}
              onChange={(event) => onPinCurrentChange(event.target.value)}
            />
          </div>
          <div className="strict-actions">
            <button className="strict-danger" onClick={onDisableStrict}>
              {t(language, "dashboard.strict.disable")}
            </button>
          </div>
          <div className="strict-divider" />
          <div className="strict-fields">
            <input
              type="password"
              placeholder={t(language, "dashboard.strict.pin_new")}
              value={pinChangeNew}
              onChange={(event) => onPinChangeNewChange(event.target.value)}
            />
            <input
              type="password"
              placeholder={t(language, "dashboard.strict.pin_new_confirm")}
              value={pinChangeConfirm}
              onChange={(event) => onPinChangeConfirmChange(event.target.value)}
            />
          </div>
          <div className="strict-actions">
            <button className="strict-secondary" onClick={onChangePin}>
              {t(language, "dashboard.strict.pin_updated")}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

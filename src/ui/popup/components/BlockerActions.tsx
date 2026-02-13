import React from "react";
import type { Language } from "../../../domain/settings/types";
import { t } from "../../../shared/i18n";

type BlockerActionsProps = {
  lang: Language;
  blockEnabled: boolean;
  onToggle: () => void;
  onOpenOptions: () => void;
};

export function BlockerActions({ lang, blockEnabled, onToggle, onOpenOptions }: BlockerActionsProps) {
  return (
    <>
      <div className="toggle">
        <label>
          <input type="checkbox" checked={blockEnabled} onChange={onToggle} />
          {t(lang, "popup.block_now")}
        </label>
      </div>

      <button className="primary" onClick={onOpenOptions}>
        {t(lang, "popup.open_options")}
      </button>
    </>
  );
}

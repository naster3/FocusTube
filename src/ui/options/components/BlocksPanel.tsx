import React from "react";
import { t } from "../../../shared/i18n";
import type { Settings } from "../../../domain/settings/types";

export type SocialBlock = {
  key: string;
  label: string;
  domains: string[];
  desc: string;
  icon: string;
  tone: string;
};

type BlocksPanelProps = {
  settings: Settings;
  language: Settings["language"];
  socialBlocks: SocialBlock[];
  onToggleAll: (enabled: boolean) => void;
  onToggleSocial: (domains: string[], enabled: boolean) => void;
  onSaveSettings: (next: Settings) => void;
};

export function BlocksPanel({
  settings,
  language,
  socialBlocks,
  onToggleAll,
  onToggleSocial,
  onSaveSettings,
}: BlocksPanelProps) {
  return (
    <section className="panel blocks-panel" data-guide="blocks">
      <div className="blocks-header">
        <div>
          <h3>{t(language, "options.blocks.title")}</h3>
          <p className="option-desc">{t(language, "options.blocks.desc")}</p>
        </div>
        <div className="blocks-actions" data-guide="blocks-actions">
          <button type="button" className="btn-ghost" onClick={() => onToggleAll(true)}>
            {t(language, "options.blocks.action.enable_all")}
          </button>
          <button type="button" className="btn-ghost" onClick={() => onToggleAll(false)}>
            {t(language, "options.blocks.action.disable_all")}
          </button>
        </div>
      </div>

      <div className="blocks-group">
        <div className="blocks-group-title">{t(language, "options.blocks.group.youtube")}</div>
        <div className="block-grid" data-guide="blocks-youtube-grid">
          <label className="block-card block-red">
            <span className="block-icon">YT</span>
            <span className="block-text">
              <span className="block-title">{t(language, "options.blocks.shorts")}</span>
              <span className="block-desc">youtube.com/shorts</span>
            </span>
            <span className="block-switch">
              <input
                type="checkbox"
                checked={settings.blockShorts}
                onChange={(event) => onSaveSettings({ ...settings, blockShorts: event.target.checked })}
              />
              <span className="block-slider" aria-hidden="true" />
            </span>
          </label>
          <label className="block-card block-indigo">
            <span className="block-icon">K</span>
            <span className="block-text">
              <span className="block-title">{t(language, "options.blocks.kids")}</span>
              <span className="block-desc">youtubekids.com</span>
            </span>
            <span className="block-switch">
              <input
                type="checkbox"
                checked={settings.blockKids}
                onChange={(event) => onSaveSettings({ ...settings, blockKids: event.target.checked })}
              />
              <span className="block-slider" aria-hidden="true" />
            </span>
          </label>
        </div>
      </div>

      <div className="blocks-group">
        <div className="blocks-group-title">{t(language, "options.blocks.group.social")}</div>
        <div className="block-grid" data-guide="blocks-social-grid">
          <label className="block-card block-purple">
            <span className="block-icon">IG</span>
            <span className="block-text">
              <span className="block-title">{t(language, "options.blocks.instagram_reels")}</span>
              <span className="block-desc">instagram.com/reels</span>
            </span>
            <span className="block-switch">
              <input
                type="checkbox"
                checked={settings.blockInstagramReels}
                onChange={(event) => onSaveSettings({ ...settings, blockInstagramReels: event.target.checked })}
              />
              <span className="block-slider" aria-hidden="true" />
            </span>
          </label>
          {socialBlocks.map((block) => {
            const checked = block.domains.every((domain) => settings.blockedDomains.includes(domain));
            return (
              <label key={block.key} className={`block-card block-${block.tone}`}>
                <span className="block-icon">{block.icon}</span>
                <span className="block-text">
                  <span className="block-title">{block.label}</span>
                  <span className="block-desc">{block.desc}</span>
                </span>
                <span className="block-switch">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => onToggleSocial(block.domains, event.target.checked)}
                  />
                  <span className="block-slider" aria-hidden="true" />
                </span>
              </label>
            );
          })}
        </div>
      </div>
    </section>
  );
}

import React from "react";
import { t } from "../../../shared/i18n";
import type { Settings } from "../../../domain/settings/types";

type HelpHeroProps = {
  language: Settings["language"];
};

export function HelpHero({ language }: HelpHeroProps) {
  return (
    <section className="help-hero">
      <h2>{t(language, "nav.help")}</h2>
      <p>{t(language, "help.intro.line1")}</p>
      <p>{t(language, "help.intro.line2")}</p>
    </section>
  );
}

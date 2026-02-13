import React, { useState } from "react";
import { t } from "../../../shared/i18n";
import { OptionsHeader } from "../../shared/OptionsHeader";
import { useSettingsSync } from "../../shared/hooks/useSettingsSync";
import { useThemeSync } from "../../shared/hooks/useThemeSync";
import { buildHelpGroups } from "../helpData";
import { filterHelpGroups } from "../helpFilter";
import { HelpHero } from "../components/HelpHero";
import { HelpUpdates } from "../components/HelpUpdates";
import { HelpTools } from "../components/HelpTools";
import { HelpGroupSection } from "../components/HelpGroupSection";
import { HelpEmpty } from "../components/HelpEmpty";
import "../styles/help.css";

export function Help() {
  const { settings } = useSettingsSync();
  const lang = settings.language;
  const [query, setQuery] = useState("");

  useThemeSync(settings.theme);

  const isDev = window.location.pathname.includes("/src/ui/");
  const optionsHref = isDev ? "/src/ui/options/index.html" : "options.html";
  const helpHref = isDev ? "/src/ui/help/index.html" : "help.html";
  const dashboardHref = isDev ? "/src/ui/dashboard/index.html" : "dashboard.html";

  const helpGroups = buildHelpGroups(lang);
  const { queryValue, filteredGroups } = filterHelpGroups(helpGroups, query);
  const hasResults = filteredGroups.length > 0;

  return (
    <div className="options help">
      <OptionsHeader
        title="FocusTube Blocker"
        subtitle={t(lang, "help.subtitle")}
        navItems={[
          { id: "config", label: t(lang, "nav.config"), href: optionsHref },
          { id: "dashboard", label: t(lang, "nav.dashboard"), href: dashboardHref },
          { id: "help", label: t(lang, "nav.help"), href: helpHref }
        ]}
        activeNavId="help"
      />

      <HelpHero language={lang} />

      <HelpUpdates language={lang} />

      <HelpTools
        language={lang}
        query={query}
        queryValue={queryValue}
        optionsHref={optionsHref}
        dashboardHref={dashboardHref}
        onQueryChange={setQuery}
        onClear={() => setQuery("")}
      />

      {hasResults ? (
        filteredGroups.map((group) => <HelpGroupSection key={group.id} group={group} />)
      ) : (
        <HelpEmpty language={lang} query={query.trim()} />
      )}
    </div>
  );
}


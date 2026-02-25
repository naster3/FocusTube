import React from "react";
import { tf } from "../../../shared/i18n";
import { EmptyState } from "../../shared/components/EmptyState";
import type { Settings } from "../../../domain/settings/types";

type HelpEmptyProps = {
  language: Settings["language"];
  query: string;
};

export function HelpEmpty({ language, query }: HelpEmptyProps) {
  return <EmptyState className="help-empty" title={tf(language, "help.search.empty", { query })} />;
}

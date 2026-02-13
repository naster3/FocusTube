import React from "react";
import type { HelpGroup } from "../types";

type HelpGroupSectionProps = {
  group: HelpGroup;
};

export function HelpGroupSection({ group }: HelpGroupSectionProps) {
  return (
    <section className="help-group">
      <div className="help-group-header">
        <h3 className="help-group-title">{group.title}</h3>
        <span className="help-group-count">{group.items.length}</span>
      </div>
      <div className="help-grid">
        {group.items.map((item) => (
          <div key={item.id} className="help-card">
            <h3>{item.title}</h3>
            <ul className="help-list">
              {item.lines.map((line, idx) => (
                <li key={`${item.id}-${idx}`}>{line}</li>
              ))}
            </ul>
            {item.note ? <div className="help-note">{item.note}</div> : null}
            {item.code ? <pre className="help-code">{item.code}</pre> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

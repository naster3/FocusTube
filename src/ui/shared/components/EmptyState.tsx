import React from "react";

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: string;
  className?: string;
};

export function EmptyState({ title, description, icon = "o o", className }: EmptyStateProps) {
  const classes = ["empty-state", className].filter(Boolean).join(" ");
  return (
    <div className={classes}>
      {icon ? (
        <div className="empty-state-icon" aria-hidden="true">
          {icon}
        </div>
      ) : null}
      <div className="empty-state-title">{title}</div>
      {description ? <div className="empty-state-text">{description}</div> : null}
    </div>
  );
}

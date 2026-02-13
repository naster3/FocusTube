import React from "react";

type NavItem = {
  id: string;
  label: string;
  href: string;
  target?: string;
  rel?: string;
};

type OptionsHeaderProps = {
  title: string;
  subtitle: string;
  navItems: NavItem[];
  activeNavId: string;
  showGuide?: boolean;
  guideLabel?: string;
  guideDisabled?: boolean;
  onGuideClick?: () => void;
  navDataGuide?: string;
};

export function OptionsHeader({
  title,
  subtitle,
  navItems,
  activeNavId,
  showGuide = false,
  guideLabel,
  guideDisabled = false,
  onGuideClick,
  navDataGuide = "nav"
}: OptionsHeaderProps) {
  const shouldShowGuide = showGuide && Boolean(guideLabel) && Boolean(onGuideClick);

  return (
    <header className="options-header">
      <div className="options-hero">
        <div className="options-brand">
          <span className="options-logo" aria-hidden="true">
            FT
          </span>
          <div className="options-title">
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
        </div>
        <div className="options-actions">
          {shouldShowGuide ? (
            <button type="button" className="btn-ghost" onClick={onGuideClick} disabled={guideDisabled}>
              {guideLabel}
            </button>
          ) : null}
        </div>
      </div>
      <nav className="options-nav" data-guide={navDataGuide}>
        {navItems.map((item) => (
          <a
            key={item.id}
            className={item.id === activeNavId ? "active" : ""}
            href={item.href}
            target={item.target}
            rel={item.rel}
          >
            {item.label}
          </a>
        ))}
      </nav>
    </header>
  );
}

import React from "react";

type ConfirmModalProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  tone?: "danger" | "default";
};

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  tone = "default"
}: ConfirmModalProps) {
  if (!open) {
    return null;
  }
  return (
    <div className="confirm-backdrop" role="presentation">
      <div
        className="confirm-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-desc"
      >
        <h4 className="confirm-title" id="confirm-title">
          {title}
        </h4>
        <p className="confirm-desc" id="confirm-desc">
          {description}
        </p>
        <div className="confirm-actions">
          <button type="button" className="btn-ghost" onClick={onCancel} aria-label={cancelLabel}>
            {cancelLabel}
          </button>
          <button type="button" className={tone === "danger" ? "primary" : ""} onClick={onConfirm} aria-label={confirmLabel}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

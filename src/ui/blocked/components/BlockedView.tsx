import React from "react";

export function BlockedView() {
  return (
    <>
      <div className="wrap">
        <div className="card">
          <div className="hero">
            <div className="tag" id="blocked-tag">
              FocusTube Blocker
            </div>
            <div className="alert-row">
              <div className="alert-icon" aria-hidden="true">
                !
              </div>
              <h1 id="blocked-title">Bloqueado por tus horarios</h1>
            </div>
            <p className="message" id="message">
              Respira, enfoca y vuelve con un objetivo claro.
            </p>
            <p className="carryover-note" id="carryover-note" role="status" aria-live="polite" />
          </div>
          <div className="meta-grid">
            <div className="meta-card">
              <span className="meta-label" id="attempts-label">
                Intentos hoy
              </span>
              <span className="meta-value" id="attempts">
                0
              </span>
            </div>
            <div className="meta-card">
              <span className="meta-label" id="last-attempt-label">
                Ultimo intento
              </span>
              <span className="meta-value" id="last-attempt">
                -
              </span>
            </div>
            <div className="meta-card">
              <span className="meta-label" id="blocked-reason-label">
                Motivo
              </span>
              <span className="meta-value" id="blocked-reason">
                -
              </span>
            </div>
          </div>
          <div className="url-card">
            <span className="meta-label" id="blocked-url-label">
              URL
            </span>
            <div className="url-row">
              <span className="url" id="blocked-url" />
              <button className="ghost small" id="copy-url-btn" type="button" aria-label="Copiar URL bloqueada">
                Copiar
              </button>
            </div>
          </div>
          <div className="actions">
            <button className="primary" id="unblock-btn" aria-label="Desbloquear por tiempo limitado">
              Desbloquear 5 minutos
            </button>
            <button className="ghost" id="close-btn" aria-label="Cerrar pestana bloqueada">
              Cerrar pestana
            </button>
          </div>
        </div>
      </div>
      <div className="confirm-backdrop" id="confirm-modal" aria-hidden="true">
        <div
          className="confirm-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          aria-describedby="confirm-desc"
          tabIndex={-1}
        >
          <h2 className="confirm-title" id="confirm-title">
            Confirmar
          </h2>
          <p className="confirm-desc" id="confirm-desc" />
          <div className="confirm-actions">
            <button className="ghost" id="confirm-cancel" type="button" aria-label="Cancelar accion">
              Cancelar
            </button>
            <button className="primary" id="confirm-confirm" type="button" aria-label="Confirmar accion">
              Confirmar
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

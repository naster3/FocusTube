// API minima para controlar el guard de bloqueo.
export type GuardHandle = {
  show: (label?: string) => void;
  hide: () => void;
  setLabel: (label: string) => void;
};

// Crea o reusa el guard visual para evitar el flash de contenido.
export function ensureBlockingGuard(): GuardHandle {
  const existing = document.getElementById("focustube-blocking-guard") as HTMLDivElement | null;
  const el = existing ?? document.createElement("div");
  el.id = "focustube-blocking-guard";
  el.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 2147483646;
    display: none;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: rgba(0,0,0,0.92);
    color: rgba(255,255,255,0.94);
    font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
    visibility: visible;
  `;

  // Arma el contenido solo una vez.
  if (!el.firstChild) {
    const box = document.createElement("div");
    box.style.cssText = `
      max-width: 520px;
      width: 100%;
      border: 1px solid rgba(255,255,255,0.14);
      border-radius: 18px;
      background: rgba(18,18,18,0.72);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      padding: 18px 18px;
      box-shadow: 0 18px 60px rgba(0,0,0,0.45);
      display: grid;
      gap: 8px;
    `;

    const title = document.createElement("div");
    title.textContent = "FocusTube";
    title.style.cssText = "font-weight:900; font-size: 16px; letter-spacing: 0.2px;";

    const label = document.createElement("div");
    label.id = "focustube-blocking-guard-label";
    label.textContent = "Verificando reglasƒ?İ";
    label.style.cssText = "font-weight:700; font-size: 13px; opacity: 0.9;";

    const hint = document.createElement("div");
    hint.textContent = "Si estA­s en horario de foco, esto es normal.";
    hint.style.cssText = "font-size: 12px; opacity: 0.7;";

    box.appendChild(title);
    box.appendChild(label);
    box.appendChild(hint);
    el.appendChild(box);
  }

  // Inserta el guard si es nuevo.
  if (!existing) {
    (document.documentElement ?? document).appendChild(el);
  }

  // Actualiza el texto de estado.
  const setLabel = (label: string) => {
    const labelEl = document.getElementById("focustube-blocking-guard-label");
    if (labelEl) {
      labelEl.textContent = label;
    }
  };

  // Muestra el guard y oculta el documento.
  const show = (label?: string) => {
    try {
      document.documentElement.style.visibility = "hidden";
      if (label) setLabel(label);
      el.style.display = "flex";
    } catch {
      // noop
    }
  };

  // Oculta el guard y restaura visibilidad.
  const hide = () => {
    try {
      el.style.display = "none";
      document.documentElement.style.visibility = "visible";
    } catch {
      // noop
    }
  };

  return { show, hide, setLabel };
}

import React from "react";
import { createRoot } from "react-dom/client";
import { BlockedView } from "./components/BlockedView";
import { initBlockedPage } from "./app/blockedApp";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<BlockedView />);
  window.requestAnimationFrame(() => {
    initBlockedPage();
  });
}

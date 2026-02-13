import React from "react";
import { createRoot } from "react-dom/client";
import { Help } from "./app/HelpApp";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <React.StrictMode>
      <Help />
    </React.StrictMode>
  );
}

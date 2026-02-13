// Entry de UI.
import React from "react";
import { createRoot } from "react-dom/client";
import { Options } from "./app/OptionsApp";
import "./styles/options.css";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <React.StrictMode>
      <Options />
    </React.StrictMode>
  );
}

import React from "react";
import { createRoot } from "react-dom/client";
import { Dashboard } from "./app/DashboardApp";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <React.StrictMode>
      <Dashboard />
    </React.StrictMode>
  );
}

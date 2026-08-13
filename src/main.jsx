import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import { AdminApp } from "./AdminApp.jsx";
import { I18nProvider } from "./i18n.jsx";
import "./styles.css";

const RootApp = window.location.pathname.startsWith("/admin") ? AdminApp : App;

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <I18nProvider>
      <RootApp />
    </I18nProvider>
  </React.StrictMode>,
);

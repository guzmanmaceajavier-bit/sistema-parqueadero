import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

import { AuthProvider } from "./context/AuthContext";
import { CajaProvider } from "./context/CajaContext";

const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
  if (args.some(a => String(a).includes("insertBefore"))) return;
  originalConsoleError.apply(console, args);
};

ReactDOM.createRoot(document.getElementById("root"), {
  onRecoverableError(error) {
    if (String(error).includes("insertBefore") || error?.name === "NotFoundError") return;
  },
}).render(
  <React.StrictMode>
    <AuthProvider>
      <CajaProvider>
        <App />
      </CajaProvider>
    </AuthProvider>
  </React.StrictMode>
);
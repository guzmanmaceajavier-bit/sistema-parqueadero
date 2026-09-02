import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

import { AuthProvider } from "./context/AuthContext";
import { CajaProvider } from "./context/CajaContext";

ReactDOM.createRoot(document.getElementById("root"), {
  onRecoverableError(error, errorInfo) {
    if (error?.name === "NotFoundError" || String(error).includes("insertBefore")) return;
    console.error("Recoverable error:", error, errorInfo);
  }
}).render(
  <AuthProvider>
    <CajaProvider>
      <App />
    </CajaProvider>
  </AuthProvider>
);
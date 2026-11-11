import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import App from "./App";
import "./styles/globals.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
    {/* Toast notifications (sonner): every toast closes automatically after 3 seconds. */}
    <Toaster position="top-right" duration={3000} richColors closeButton />
  </React.StrictMode>
);

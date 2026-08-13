import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "@glazelab/react/styles.css";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("The React consumer root is missing.");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

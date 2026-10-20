import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import ViewerDemo from "./ViewerDemo.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* Keep the team's existing canvas as the default; the package demo is opt-in. */}
    {new URLSearchParams(window.location.search).has(
      "viewerDemo"
    ) ? (
      <ViewerDemo />
    ) : (
      <App />
    )}
  </StrictMode>
);

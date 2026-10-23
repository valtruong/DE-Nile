import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Send /api calls to the Express backend, so the session
    // cookie stays on the same origin as the app.
    proxy: {
      "/api": "http://localhost:8000"
    }
  }
});

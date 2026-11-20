import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: { include: ["tests/**/*.test.{ts,tsx}"] },
  server: {
    // Send /api calls to the Express backend, so the session
    // cookie stays on the same origin as the app.
    proxy: {
      "/api": "http://localhost:8000"
    }
  }
});

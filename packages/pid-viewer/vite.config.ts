import { defineConfig } from "vite";

export default defineConfig({
  build: {
    emptyOutDir: false, // Preserve the declarations emitted by tsc before bundling.
    lib: {
      entry: "src/bundle.ts",
      formats: ["es"],
      fileName: "index",
      cssFileName: "pid-viewer"
    },
    rollupOptions: {
      external: [
        /^react($|\/)/,
        /^react-dom($|\/)/,
        "@xyflow/react"
      ]
    }
  }
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/admin/",
  server: {
    proxy: {
      "/admin/config": "http://localhost:8080",
      "/admin": "http://localhost:8080",
      "/status": "http://localhost:8080",
      "/record": "http://localhost:8080",
      "/health": "http://localhost:8080",
      "/v1": "http://localhost:8080",
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});

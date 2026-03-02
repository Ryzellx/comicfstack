/// frontend/vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api/v2": {
        target: "https://aniwatch-api-production-f302.up.railway.app",
        changeOrigin: true,
        secure: true,
      },
    },
  },
});

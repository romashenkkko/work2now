import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const FRONTEND_PORT = parseInt(process.env.VITE_PORT || "5500", 10);
const BACKEND_PORT = process.env.VITE_API_PORT || "5600";
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ["ogl"],
    force: true,
  },
  server: {
    port: FRONTEND_PORT,
    strictPort: false,
    host: "0.0.0.0",
    proxy: {
      "/api": { target: BACKEND_URL, changeOrigin: true },
    },
  },
});

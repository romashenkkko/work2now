import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
var FRONTEND_PORT = parseInt(process.env.VITE_PORT || "5500", 10);
var BACKEND_PORT = process.env.VITE_API_PORT || "5600";
var BACKEND_URL = "http://localhost:".concat(BACKEND_PORT);
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

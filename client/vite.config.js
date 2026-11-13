import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@/layout": path.resolve(__dirname, "./layout"),
      "@/layouts": path.resolve(__dirname, "./layout"),
      "@/features": path.resolve(__dirname, "./features"),
      "@/components": path.resolve(__dirname, "./components"),
      "@/pages": path.resolve(__dirname, "./pages"),
      "@": path.resolve(__dirname, "./"),
    },
  },
  server: {
    port: 3000,
    open: false,
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-icons": ["lucide-react"],
          "vendor-charts": ["recharts"],
        },
      },
    },
  },
});

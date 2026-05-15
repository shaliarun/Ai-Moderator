import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const port    = Number(process.env.PORT     ?? "3000");
const basePath = process.env.BASE_PATH      ?? "/";
const apiPort  = Number(process.env.API_PORT ?? "8080");
const isReplit = !!process.env.REPL_ID;

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    ...(isReplit
      ? [
          await import("@replit/vite-plugin-runtime-error-modal").then((m) => m.default()),
          ...(process.env.NODE_ENV !== "production"
            ? [
                await import("@replit/vite-plugin-cartographer").then((m) =>
                  m.cartographer({ root: path.resolve(import.meta.dirname, "..") }),
                ),
                await import("@replit/vite-plugin-dev-banner").then((m) => m.devBanner()),
              ]
            : []),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@":       path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir:    path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: { strict: true },
    // Proxy /api/* to the API server when running locally (no Replit routing layer)
    proxy: isReplit
      ? undefined
      : { "/api": { target: `http://localhost:${apiPort}`, changeOrigin: true } },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});

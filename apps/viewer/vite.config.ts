import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  root: "src",
  envDir: resolve(__dirname, "../.."),
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
  server: {
    host: "0.0.0.0",
    port: 5174,
  },
  resolve: {
    alias: {
      "@uos/shared": resolve(__dirname, "../../packages/shared/src"),
    },
  },
});

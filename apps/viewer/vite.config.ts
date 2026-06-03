import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  root: "src",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
  server: {
    port: 5174,
  },
  resolve: {
    alias: {
      "@uos/shared": resolve(__dirname, "../../packages/shared/src"),
    },
  },
});

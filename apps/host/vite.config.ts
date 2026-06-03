import { defineConfig } from "vite";
import electron from "vite-plugin-electron";
import electronRenderer from "vite-plugin-electron-renderer";
import { resolve } from "node:path";

export default defineConfig({
  root: "src/renderer",
  build: {
    outDir: "../../dist/renderer",
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@uos/shared": resolve(__dirname, "../../packages/shared/src"),
    },
  },
  plugins: [
    electron([
      {
        entry: "src/main/main.ts",
        vite: {
          build: {
            outDir: "dist/main",
            rollupOptions: {
              external: ["electron"],
            },
          },
          resolve: {
            alias: {
              "@uos/shared": resolve(__dirname, "../../packages/shared/src"),
            },
          },
        },
      },
      {
        entry: "src/preload/preload.ts",
        onstart(options) {
          options.reload();
        },
        vite: {
          build: {
            outDir: "dist/preload",
            rollupOptions: {
              external: ["electron"],
            },
          },
        },
      },
    ]),
    electronRenderer(),
  ],
});

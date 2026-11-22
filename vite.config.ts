import { readFileSync } from "node:fs";
import { copyFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

const root = import.meta.dirname;

/** The Supabase project URL and public anon key live in config.js (the daily sync reads it too). */
function readSupabaseConfig(): { url: string; anonKey: string } {
  const src = readFileSync(resolve(root, "config.js"), "utf8");
  const url = /url:\s*"([^"]+)"/.exec(src)?.[1];
  const anonKey = /anonKey:\s*"([^"]+)"/.exec(src)?.[1];
  if (!url || !anonKey) throw new Error("config.js needs a Supabase url and anonKey");
  return { url, anonKey };
}

/**
 * catalog.json and prices.json sit at the repo root because the daily sync rewrites them there.
 * Serve them in dev and ship them next to the app in the build.
 */
const DATA_FILES = ["catalog.json", "prices.json"];
function siteData(): Plugin {
  return {
    name: "want-list:site-data",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const name = DATA_FILES.find((f) => req.url?.split("?")[0]?.endsWith("/" + f));
        if (!name) return next();
        res.setHeader("content-type", "application/json");
        res.end(await readFile(resolve(root, name)));
      });
    },
    async generateBundle() {
      for (const fileName of DATA_FILES) {
        this.emitFile({ type: "asset", fileName, source: await readFile(resolve(root, fileName)) });
      }
    },
  };
}

/** GitHub Pages serves 404.html for unknown paths, so deep links still boot the app. */
function spaFallback(): Plugin {
  let outDir = "dist";
  return {
    name: "want-list:spa-fallback",
    apply: "build",
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    async closeBundle() {
      await copyFile(resolve(outDir, "index.html"), resolve(outDir, "404.html"));
    },
  };
}

const supabase = readSupabaseConfig();

export default defineConfig({
  base: process.env.BASE_PATH ?? "/want-list/",
  resolve: { alias: { "~": resolve(root, "src") } },
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabase.url),
    "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(supabase.anonKey),
  },
  plugins: [
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    siteData(),
    spaFallback(),
  ],
  build: { target: "es2022" },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});

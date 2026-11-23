import { readFileSync } from "node:fs";
import { copyFile, mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";
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
      server.middlewares.use((req, res, next) => {
        const name = DATA_FILES.find((f) => req.url?.split("?")[0]?.endsWith("/" + f));
        if (!name) {
          next();
          return;
        }
        readFile(resolve(root, name)).then(
          (body) => {
            res.setHeader("content-type", "application/json");
            res.end(body);
          },
          (err: unknown) => {
            next(err);
          },
        );
      });
    },
    async generateBundle() {
      for (const fileName of DATA_FILES) {
        this.emitFile({ type: "asset", fileName, source: await readFile(resolve(root, fileName)) });
      }
    },
  };
}

/**
 * GitHub Pages serves 404.html for unknown paths, so deep links still boot the app. The shared want list
 * also gets a real page at share/, so link previews in Messages and the like get a 200 rather than a 404.
 */
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
      await mkdir(resolve(outDir, "share"), { recursive: true });
      await copyFile(resolve(outDir, "index.html"), resolve(outDir, "share", "index.html"));
    },
  };
}

const supabase = readSupabaseConfig();

const DAY = 24 * 60 * 60;
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Offline support: the app shell is precached, so a repeat visit (or the home screen app) opens with no
 * network at all. Data and pictures are cached as they're used, each cache capped so it can't fill the phone.
 * A new deploy waits until the person taps Refresh (see UpdatePrompt), so a page never runs half old, half new.
 */
const offline = VitePWA({
  registerType: "prompt",
  injectRegister: false,
  // public/manifest.webmanifest is the app's manifest; the plugin only makes the service worker.
  manifest: false,
  workbox: {
    globPatterns: ["**/*.{js,css,html,png,svg,webmanifest}"],
    globIgnores: ["404.html", "share/**"],
    navigateFallback: "index.html",
    // Opening a file directly (catalog.json, an icon) gets the file, not the app.
    navigateFallbackDenylist: [/\/[^/?]+\.[a-z0-9]+$/i],
    cleanupOutdatedCaches: true,
    clientsClaim: true,
    runtimeCaching: [
      {
        // Every card ever made (2.4 MB): open from the cache at once, refresh it in the background.
        urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.endsWith("/catalog.json"),
        handler: "StaleWhileRevalidate",
        options: { cacheName: "catalog", expiration: { maxEntries: 1 } },
      },
      {
        // Today's prices are small, so fetch them fresh, falling back to the last copy when offline or slow.
        urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.endsWith("/prices.json"),
        handler: "NetworkFirst",
        options: { cacheName: "prices", networkTimeoutSeconds: 3, expiration: { maxEntries: 1 } },
      },
      {
        urlPattern: ({ url }) => url.origin === "https://api.tcgdex.net",
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "tcgdex",
          expiration: { maxEntries: 200, maxAgeSeconds: 7 * DAY, purgeOnQuotaError: true },
          cacheableResponse: { statuses: [200] },
        },
      },
      {
        // Full-size pictures for the photo view: fewer kept, since each is larger.
        urlPattern: ({ url }) =>
          (url.origin === "https://tcgplayer-cdn.tcgplayer.com" && url.pathname.includes("_in_1000x1000")) ||
          (url.origin === "https://assets.tcgdex.net" && url.pathname.endsWith("/high.webp")),
        handler: "CacheFirst",
        options: {
          cacheName: "card-images-big",
          expiration: { maxEntries: 80, maxAgeSeconds: 60 * DAY, purgeOnQuotaError: true },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      {
        // A RegExp, not a function: workbox copies match functions into the worker as text, without this file's variables.
        urlPattern: new RegExp(
          `^(https://tcgplayer-cdn\\.tcgplayer\\.com/|https://assets\\.tcgdex\\.net/|${escapeRegExp(supabase.url)}/storage/v1/object/public/)`,
        ),
        handler: "CacheFirst",
        options: {
          cacheName: "card-images",
          expiration: { maxEntries: 600, maxAgeSeconds: 60 * DAY, purgeOnQuotaError: true },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
    ],
  },
});

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
    offline,
  ],
  build: { target: "es2022" },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});

import { readFileSync } from "node:fs";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

/**
 * The built page may load files only from its own origin: no CDN, no web
 * fonts from Google, no analytics. GitHub Pages cannot send response headers,
 * so the policy goes into a meta tag. The tag is added to the build only,
 * because the dev server injects an inline React Refresh script that this
 * policy would block. The e2e suite runs against the build and checks both
 * the tag and the absence of foreign requests.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join("; ");

function contentSecurityPolicy(): Plugin {
  return {
    name: "medini-atlas:content-security-policy",
    apply: "build",
    transformIndexHtml() {
      return [
        {
          tag: "meta",
          attrs: {
            "http-equiv": "Content-Security-Policy",
            content: CONTENT_SECURITY_POLICY,
          },
          // A meta policy only covers what follows it, so it goes first.
          injectTo: "head-prepend",
        },
      ];
    },
  };
}

/**
 * MIT and Apache licences ask that their notices travel with the code. The
 * bundle contains third-party code, so the site ships the generated notices
 * (see scripts/check-licenses.mjs) next to index.html.
 */
function thirdPartyNotices(): Plugin {
  return {
    name: "medini-atlas:third-party-notices",
    apply: "build",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "THIRD_PARTY_NOTICES.txt",
        source: readFileSync(
          new URL("./THIRD_PARTY_NOTICES.md", import.meta.url),
          "utf8",
        ),
      });
    },
  };
}

export default defineConfig({
  // GitHub Pages serves a project site under /<repository>/.
  base: process.env.BASE_PATH ?? "/",
  plugins: [react(), tailwindcss(), contentSecurityPolicy(), thirdPartyNotices()],
  // Port 4747 is reserved for this app. A service worker of another local
  // app on a shared port would otherwise answer for it.
  server: { port: 4747, strictPort: true },
  preview: { port: 4748, strictPort: true },
  build: {
    // The scene chunk holds all of three.js (React Three Fiber imports the
    // whole library). It loads after the page, so it does not delay the
    // first view. Other chunks stay far below this limit.
    chunkSizeWarningLimit: 1000,
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.ts"],
    environment: "node",
  },
});

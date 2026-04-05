import { defineConfig } from "vitest/config";

export default defineConfig({
  // Disable CSS processing — backend tests are pure TypeScript; no CSS involved.
  // Without this, Vite walks up to the monorepo root and finds the frontend's
  // postcss.config.mjs which requires tailwindcss (not installed in this workspace).
  css: false,
  test: {
    include: ["src/__tests__/**/*.test.ts"],
  },
});

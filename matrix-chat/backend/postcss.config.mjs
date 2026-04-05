// Empty PostCSS config — shadows the root-level frontend config so Vite/vitest
// does not try to load tailwindcss (a frontend-only dependency) when running
// backend tests.
export default { plugins: [] };

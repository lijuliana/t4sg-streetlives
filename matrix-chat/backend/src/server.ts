import "dotenv/config";
import path from "node:path";
import express from "express";
import cors from "cors";
import { initMatrixAuth } from "./services/matrixAuth.js";
import sessionRoutes from "./routes/sessions.js";
import navigatorRoutes from "./routes/navigators.js";
import routingRoutes from "./routes/routing.js";
import supervisorRoutes from "./routes/supervisor.js";

// ── Env validation ────────────────────────────────────────────────────────────
const REQUIRED_ENV = [
  "MATRIX_BASE_URL",
  "MATRIX_SERVICE_ACCOUNT_USER_ID",
  "MATRIX_SERVICE_ACCOUNT_PASSWORD",
] as const;

const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(`[backend] Missing required environment variables: ${missing.join(", ")}`);
  console.error("[backend] Copy backend/.env.example to backend/.env and fill in the values.");
  process.exit(1);
}

// ── Matrix auth — init before accepting requests ──────────────────────────────
const sessionFile =
  process.env.MATRIX_SESSION_FILE ??
  path.resolve(process.cwd(), ".matrix-session.json");

const authManager = initMatrixAuth(
  process.env.MATRIX_BASE_URL!,
  process.env.MATRIX_SERVICE_ACCOUNT_USER_ID!,
  process.env.MATRIX_SERVICE_ACCOUNT_PASSWORD!,
  sessionFile,
);

await authManager.init();
authManager
  .getToken()
  .then(() => console.log("[backend] Matrix service account authenticated"))
  .catch((err: unknown) =>
    console.error("[backend] Matrix service account auth failed at startup:", err),
  );

// ── Optional dev seeding ──────────────────────────────────────────────────────
if (process.env.SEED_NAVIGATORS === "true" || process.env.NODE_ENV === "development") {
  const { seedNavigators } = await import("./seeds/navigators.js");
  seedNavigators();
  console.log("[backend] Dev navigator profiles seeded");
}

// ── App ───────────────────────────────────────────────────────────────────────
const app = express();
const PORT = Number(process.env.PORT ?? 3000);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "http://localhost:5173";

app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/sessions", sessionRoutes);
app.use("/api/navigators", navigatorRoutes);
app.use("/api/routing", routingRoutes);
app.use("/api/supervisor", supervisorRoutes);

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[backend] Listening on http://localhost:${PORT}`);
  console.log(`[backend] CORS origin:   ${CORS_ORIGIN}`);
  console.log(`[backend] Matrix server: ${process.env.MATRIX_BASE_URL}`);
  console.log(`[backend] Session file:  ${sessionFile}`);
});

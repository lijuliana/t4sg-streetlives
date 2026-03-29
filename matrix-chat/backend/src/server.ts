import "dotenv/config";
import path from "node:path";
import express from "express";
import cors from "cors";
import { initMatrixAuth } from "./services/matrixAuth.js";
import sessionRoutes from "./routes/sessions.js";

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

// Load any persisted credentials from disk, then eagerly validate them.
// A login failure here is logged but does not abort startup — the first
// session-creation request will surface the error with a clear message.
await authManager.init();
authManager
  .getToken()
  .then(() => console.log("[backend] Matrix service account authenticated"))
  .catch((err: unknown) =>
    console.error("[backend] Matrix service account auth failed at startup:", err),
  );

// ── App ───────────────────────────────────────────────────────────────────────
const app = express();
const PORT = Number(process.env.PORT ?? 3000);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "http://localhost:5173";

app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/sessions", sessionRoutes);

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[backend] Listening on http://localhost:${PORT}`);
  console.log(`[backend] CORS origin:   ${CORS_ORIGIN}`);
  console.log(`[backend] Matrix server: ${process.env.MATRIX_BASE_URL}`);
  console.log(`[backend] Session file:  ${sessionFile}`);
});

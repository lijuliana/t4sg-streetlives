import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import {
  createGuestSession,
  loadCachedGuestSession,
  saveCachedGuestSession,
  clearCachedGuestSession,
  validateGuestSession,
} from "./lib/guestSession";
import type { GuestSession, NeedCategory, SessionStartOptions } from "./lib/guestSession";
import GuestChatPage from "./pages/GuestChatPage";
import NavigatorDashboard from "./pages/NavigatorDashboard";
import SupervisorPage from "./pages/SupervisorPage";

// ── App state ─────────────────────────────────────────────────────────────────
type AppState =
  | { status: "loading" }
  | { status: "landing"; cachedSession?: GuestSession }  // cachedSession = resumable tab session
  | { status: "form" }                                    // pre-chat routing form
  | { status: "starting"; opts: SessionStartOptions }
  | { status: "chat"; session: GuestSession }
  | { status: "error"; message: string };

// ── Styles ────────────────────────────────────────────────────────────────────
const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;600&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #1a1a1a; }
  @keyframes spin { to { transform: rotate(360deg); } }
`;

const FullScreenShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <>
    <style>{globalStyles}</style>
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {children}
    </div>
  </>
);

// ── Card shell ────────────────────────────────────────────────────────────────
const Card: React.FC<{ children: React.ReactNode; maxWidth?: number }> = ({
  children,
  maxWidth = 400,
}) => (
  <div
    style={{
      background: "#fff",
      borderRadius: "16px",
      padding: "36px 32px",
      maxWidth,
      width: "100%",
      boxShadow: "0 8px 48px rgba(0,0,0,0.5)",
    }}
  >
    {children}
  </div>
);

// ── Landing screen ────────────────────────────────────────────────────────────
const LandingScreen: React.FC<{
  onContinue: () => void;
  onResumeSession?: () => void;
  cachedSession?: GuestSession;
}> = ({ onContinue, onResumeSession, cachedSession }) => (
  <FullScreenShell>
    <Card>
      <div
        style={{
          textAlign: "center",
          marginBottom: "28px",
        }}
      >
        <div
          style={{
            width: "52px",
            height: "52px",
            borderRadius: "14px",
            background: "#f5c800",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
            fontSize: "26px",
          }}
        >
          💬
        </div>
        <h2
          style={{
            fontSize: "20px",
            fontWeight: 700,
            color: "#111",
            marginBottom: "10px",
            letterSpacing: "-0.02em",
          }}
        >
          Chat with a Navigator
        </h2>
        <p
          style={{
            fontSize: "14px",
            color: "#6b7280",
            lineHeight: "1.6",
          }}
        >
          Get free, confidential help connecting to social services in New York City.
          A Navigator will join your chat shortly.
        </p>
      </div>

      {cachedSession && onResumeSession ? (
        <>
          <button
            onClick={onResumeSession}
            style={{
              width: "100%",
              padding: "13px",
              borderRadius: "10px",
              border: "none",
              background: "#f5c800",
              color: "#111",
              fontSize: "15px",
              fontWeight: 600,
              fontFamily: "'DM Sans', sans-serif",
              cursor: "pointer",
            }}
          >
            Continue your session
          </button>
          <p
            style={{
              marginTop: "8px",
              fontSize: "12px",
              color: "#9ca3af",
              textAlign: "center",
            }}
          >
            #{cachedSession.sessionId.slice(0, 8)} · {cachedSession.status}
          </p>
          <button
            onClick={onContinue}
            style={{
              width: "100%",
              marginTop: "10px",
              padding: "10px",
              borderRadius: "10px",
              border: "1px solid #e5e7eb",
              background: "#fff",
              color: "#374151",
              fontSize: "14px",
              fontWeight: 500,
              fontFamily: "'DM Sans', sans-serif",
              cursor: "pointer",
            }}
          >
            Start a new chat
          </button>
        </>
      ) : (
        <button
          onClick={onContinue}
          style={{
            width: "100%",
            padding: "13px",
            borderRadius: "10px",
            border: "none",
            background: "#f5c800",
            color: "#111",
            fontSize: "15px",
            fontWeight: 600,
            fontFamily: "'DM Sans', sans-serif",
            cursor: "pointer",
          }}
        >
          Start chat
        </button>
      )}

      <p style={{ marginTop: "14px", fontSize: "12px", color: "#9ca3af", textAlign: "center" }}>
        No account required. Your chat is private.
      </p>
    </Card>
  </FullScreenShell>
);

// ── Pre-chat routing form ─────────────────────────────────────────────────────

const NEED_CATEGORIES: { value: NeedCategory; label: string }[] = [
  { value: "housing", label: "Housing" },
  { value: "employment", label: "Employment" },
  { value: "health", label: "Health" },
  { value: "benefits", label: "Benefits" },
  { value: "youth_services", label: "Youth services" },
  { value: "education", label: "Education" },
  { value: "other", label: "Other / not sure" },
];

const LANGUAGES: { value: string; label: string }[] = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish (Español)" },
  { value: "zh", label: "Mandarin (中文)" },
  { value: "fr", label: "French (Français)" },
  { value: "ar", label: "Arabic (العربية)" },
  { value: "ht", label: "Haitian Creole (Kreyòl ayisyen)" },
];

const PreChatForm: React.FC<{
  onSubmit: (opts: SessionStartOptions) => void;
  onBack: () => void;
  starting: boolean;
}> = ({ onSubmit, onBack, starting }) => {
  const [language, setLanguage] = useState("en");
  const [needCategory, setNeedCategory] = useState<NeedCategory>("other");

  const selectStyle: React.CSSProperties = {
    width: "100%",
    padding: "9px 12px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    fontSize: "14px",
    fontFamily: "'DM Sans', sans-serif",
    background: "#fff",
    color: "#111",
    cursor: "pointer",
    appearance: "none",
    WebkitAppearance: "none",
    backgroundImage:
      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%236b7280' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 12px center",
    paddingRight: "36px",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "12px",
    fontWeight: 600,
    color: "#374151",
    marginBottom: "6px",
    letterSpacing: "0.02em",
  };

  return (
    <FullScreenShell>
      <Card>
        <button
          onClick={onBack}
          style={{
            background: "none",
            border: "none",
            color: "#9ca3af",
            fontSize: "13px",
            cursor: "pointer",
            padding: 0,
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            gap: "4px",
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          ← Back
        </button>

        <h2
          style={{
            fontSize: "18px",
            fontWeight: 700,
            color: "#111",
            marginBottom: "6px",
            letterSpacing: "-0.02em",
          }}
        >
          A few quick questions
        </h2>
        <p
          style={{
            fontSize: "13px",
            color: "#6b7280",
            marginBottom: "24px",
            lineHeight: "1.5",
          }}
        >
          This helps us connect you to the right navigator.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <div>
            <label style={labelStyle}>What language do you prefer?</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              style={selectStyle}
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>What do you need help with?</label>
            <select
              value={needCategory}
              onChange={(e) => setNeedCategory(e.target.value as NeedCategory)}
              style={selectStyle}
            >
              {NEED_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={() => onSubmit({ language, needCategory })}
          disabled={starting}
          style={{
            width: "100%",
            padding: "13px",
            borderRadius: "10px",
            border: "none",
            background: starting ? "#e5b800" : "#f5c800",
            color: "#111",
            fontSize: "15px",
            fontWeight: 600,
            fontFamily: "'DM Sans', sans-serif",
            cursor: starting ? "not-allowed" : "pointer",
            marginTop: "28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          {starting && (
            <span
              style={{
                display: "inline-block",
                width: "14px",
                height: "14px",
                border: "2px solid rgba(0,0,0,0.2)",
                borderTopColor: "#111",
                borderRadius: "50%",
                animation: "spin 0.7s linear infinite",
              }}
            />
          )}
          {starting ? "Starting…" : "Connect me with a navigator"}
        </button>
      </Card>
    </FullScreenShell>
  );
};

// ── Loading / error screens ───────────────────────────────────────────────────
const AppLoadingScreen: React.FC = () => (
  <FullScreenShell>
    <span
      style={{
        display: "inline-block",
        width: "20px",
        height: "20px",
        border: "2px solid #374151",
        borderTopColor: "#f5c800",
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }}
    />
  </FullScreenShell>
);

const AppErrorScreen: React.FC<{ message: string; onRetry: () => void }> = ({
  message,
  onRetry,
}) => (
  <FullScreenShell>
    <Card>
      <h2 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "8px", color: "#111" }}>
        Connection failed
      </h2>
      <p
        style={{
          fontSize: "13px",
          color: "#b91c1c",
          background: "#fef2f2",
          border: "1px solid #fecaca",
          borderRadius: "8px",
          padding: "10px 14px",
          marginBottom: "20px",
        }}
      >
        {message}
      </p>
      <button
        onClick={onRetry}
        style={{
          width: "100%",
          padding: "10px",
          borderRadius: "10px",
          border: "none",
          background: "#f5c800",
          color: "#111",
          fontSize: "14px",
          fontWeight: 600,
          fontFamily: "'DM Sans', sans-serif",
          cursor: "pointer",
        }}
      >
        Try again
      </button>
    </Card>
  </FullScreenShell>
);

// ── Root app ──────────────────────────────────────────────────────────────────
const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function checkCache() {
      const cached = loadCachedGuestSession();
      if (cached) {
        const validated = await validateGuestSession(cached);
        if (!cancelled) {
          if (validated) {
            // Show landing with a "Continue" option rather than jumping straight to chat,
            // so the user can choose to start fresh in this tab instead.
            setAppState({ status: "landing", cachedSession: validated });
            return;
          }
          clearCachedGuestSession();
        }
      }
      if (!cancelled) setAppState({ status: "landing" });
    }

    checkCache().catch(() => {
      if (!cancelled) setAppState({ status: "landing" });
    });

    return () => { cancelled = true; };
  }, []);

  const handleStartChat = async (opts: SessionStartOptions) => {
    clearCachedGuestSession();
    setAppState({ status: "starting", opts });
    try {
      const session = await createGuestSession(opts);
      saveCachedGuestSession(session);
      setAppState({ status: "chat", session });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[App] Session creation error:", err);
      setAppState({ status: "error", message });
    }
  };

  const handleChatError = (message: string) => {
    clearCachedGuestSession();
    setAppState({ status: "error", message });
  };

  const handleRetry = () => setAppState({ status: "landing" });

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/navigator/*" element={<NavigatorDashboard />} />
        <Route path="/supervisor" element={<SupervisorPage />} />

        <Route
          path="/chat"
          element={
            appState.status === "chat" ? (
              <GuestChatPage session={appState.session} onError={handleChatError} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />

        <Route
          path="*"
          element={
            appState.status === "loading" ? (
              <AppLoadingScreen />
            ) : appState.status === "landing" ? (
              <LandingScreen
                cachedSession={appState.cachedSession}
                onResumeSession={
                  appState.cachedSession
                    ? () => setAppState({ status: "chat", session: appState.cachedSession! })
                    : undefined
                }
                onContinue={() => {
                  clearCachedGuestSession();
                  setAppState({ status: "form" });
                }}
              />
            ) : appState.status === "form" ? (
              <PreChatForm
                onSubmit={handleStartChat}
                onBack={() => setAppState({ status: "landing" })}
                starting={false}
              />
            ) : appState.status === "starting" ? (
              <PreChatForm
                onSubmit={handleStartChat}
                onBack={() => setAppState({ status: "landing" })}
                starting={true}
              />
            ) : appState.status === "error" ? (
              <AppErrorScreen message={appState.message} onRetry={handleRetry} />
            ) : (
              <Navigate to="/chat" replace />
            )
          }
        />
      </Routes>
    </BrowserRouter>
  );
};

export default App;

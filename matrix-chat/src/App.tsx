import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import {
  createGuestSession,
  loadCachedGuestSession,
  saveCachedGuestSession,
  clearCachedGuestSession,
  validateGuestSession,
} from "./lib/guestSession";
import type { GuestSession } from "./lib/guestSession";
import GuestChatPage from "./pages/GuestChatPage";
import NavigatorDashboard from "./pages/NavigatorDashboard";

// ── App state (guest chat flow) ───────────────────────────────────────────────
type AppState =
  | { status: "loading" }                      // checking cache on mount
  | { status: "landing" }                      // no session yet; show Start Chat
  | { status: "starting" }                     // button clicked, creating session
  | { status: "chat"; session: GuestSession }
  | { status: "error"; message: string };

// ── Shared screen shell ───────────────────────────────────────────────────────
const FullScreenShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;600&display=swap');
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { background: #1a1a1a; }
      @keyframes spin { to { transform: rotate(360deg); } }
    `}</style>
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

// ── Landing screen ────────────────────────────────────────────────────────────
const LandingScreen: React.FC<{
  onStart: () => void;
  starting: boolean;
}> = ({ onStart, starting }) => (
  <FullScreenShell>
    <div
      style={{
        background: "#fff",
        borderRadius: "16px",
        padding: "40px 32px",
        maxWidth: "380px",
        width: "100%",
        boxShadow: "0 8px 48px rgba(0,0,0,0.5)",
        textAlign: "center",
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
          marginBottom: "28px",
        }}
      >
        Get free, confidential help connecting to social services in New York City.
        A Navigator will join your chat shortly.
      </p>

      <button
        onClick={onStart}
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
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          transition: "background 0.15s",
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
        {starting ? "Starting…" : "Start chat"}
      </button>

      <p
        style={{
          marginTop: "16px",
          fontSize: "12px",
          color: "#9ca3af",
        }}
      >
        No account required. Your chat is private.
      </p>
    </div>
  </FullScreenShell>
);

// ── Spinner screen (cache check on mount) ─────────────────────────────────────
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

// ── Error screen ──────────────────────────────────────────────────────────────
const AppErrorScreen: React.FC<{ message: string; onRetry: () => void }> = ({
  message,
  onRetry,
}) => (
  <FullScreenShell>
    <div
      style={{
        background: "#fff",
        borderRadius: "14px",
        padding: "32px",
        maxWidth: "400px",
        width: "100%",
        boxShadow: "0 8px 48px rgba(0,0,0,0.5)",
      }}
    >
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
    </div>
  </FullScreenShell>
);

// ── Root app ──────────────────────────────────────────────────────────────────
const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>({ status: "loading" });

  // On mount: check for a valid cached session.
  // If found, restore it. If not, show the landing screen.
  // Session creation only happens after the user clicks "Start chat".
  useEffect(() => {
    let cancelled = false;

    async function checkCache() {
      const cached = loadCachedGuestSession();
      if (cached) {
        const validated = await validateGuestSession(cached);
        if (!cancelled) {
          if (validated) {
            setAppState({ status: "chat", session: validated });
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

  // Called when the guest clicks "Start chat".
  const handleStartChat = async () => {
    setAppState({ status: "starting" });
    try {
      const session = await createGuestSession();
      saveCachedGuestSession(session);
      setAppState({ status: "chat", session });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[App] Session creation error:", err);
      setAppState({ status: "error", message });
    }
  };

  // Called when a mid-chat error occurs (e.g. session expired).
  // Clears state and returns to landing so the user can start a fresh session.
  const handleChatError = (message: string) => {
    clearCachedGuestSession();
    setAppState({ status: "error", message });
  };

  const handleRetry = () => setAppState({ status: "landing" });

  return (
    <BrowserRouter>
      <Routes>
        {/* ── Navigator dashboard ── */}
        <Route path="/navigator/*" element={<NavigatorDashboard />} />

        {/* ── Guest user chat ── */}
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
            ) : appState.status === "landing" || appState.status === "starting" ? (
              <LandingScreen
                onStart={handleStartChat}
                starting={appState.status === "starting"}
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

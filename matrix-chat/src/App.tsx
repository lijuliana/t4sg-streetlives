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
import styles from "./styles/App.module.css";

// ── App state ─────────────────────────────────────────────────────────────────
type AppState =
  | { status: "loading" }
  | { status: "landing"; cachedSession?: GuestSession }
  | { status: "form" }
  | { status: "starting"; opts: SessionStartOptions }
  | { status: "chat"; session: GuestSession }
  | { status: "error"; message: string };

const FullScreenShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className={styles.fullScreenShell}>{children}</div>
);

// ── Card shell ────────────────────────────────────────────────────────────────
const Card: React.FC<{ children: React.ReactNode; maxWidth?: number }> = ({
  children,
  maxWidth = 400,
}) => (
  <div className={styles.card} style={{ "--card-max-width": `${maxWidth}px` } as React.CSSProperties}>
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
      <div className={styles.landingHeader}>
        <div className={styles.landingIcon}>💬</div>
        <h2 className={styles.landingTitle}>Chat with a Navigator</h2>
        <p className={styles.landingSubtitle}>
          Get free, confidential help connecting to social services in New York City.
          A Navigator will join your chat shortly.
        </p>
      </div>

      {cachedSession && onResumeSession ? (
        <>
          <button type="button" onClick={onResumeSession} className={styles.primaryButton}>
            Continue your session
          </button>
          <p className={styles.sessionIdHint}>
            #{cachedSession.sessionId.slice(0, 8)} · {cachedSession.status}
          </p>
          <button type="button" onClick={onContinue} className={styles.secondaryButton}>
            Start a new chat
          </button>
        </>
      ) : (
        <button type="button" onClick={onContinue} className={styles.primaryButton}>
          Start chat
        </button>
      )}

      <p className={styles.privacyNote}>
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

  return (
    <FullScreenShell>
      <Card>
        <button type="button" onClick={onBack} className={styles.backButton}>
          ← Back
        </button>

        <h2 className={styles.formTitle}>A few quick questions</h2>
        <p className={styles.formSubtitle}>
          This helps us connect you to the right navigator.
        </p>

        <div className={styles.fieldStack}>
          <div>
            <label htmlFor="language-select" className={styles.selectLabel}>
              What language do you prefer?
            </label>
            <select
              id="language-select"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className={styles.selectControl}
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="need-category-select" className={styles.selectLabel}>
              What do you need help with?
            </label>
            <select
              id="need-category-select"
              value={needCategory}
              onChange={(e) => setNeedCategory(e.target.value as NeedCategory)}
              className={styles.selectControl}
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
          type="button"
          onClick={() => onSubmit({ language, needCategory })}
          disabled={starting}
          className={styles.submitButton}
          data-starting={String(starting)}
        >
          {starting && <span className={styles.spinner} />}
          {starting ? "Starting…" : "Connect me with a navigator"}
        </button>
      </Card>
    </FullScreenShell>
  );
};

// ── Loading / error screens ───────────────────────────────────────────────────
const AppLoadingScreen: React.FC = () => (
  <FullScreenShell>
    <span className={styles.appSpinner} />
  </FullScreenShell>
);

const AppErrorScreen: React.FC<{ message: string; onRetry: () => void }> = ({
  message,
  onRetry,
}) => (
  <FullScreenShell>
    <Card>
      <h2 className={styles.errorTitle}>Connection failed</h2>
      <p className={styles.errorMessage}>{message}</p>
      <button type="button" onClick={onRetry} className={styles.retryButton}>
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

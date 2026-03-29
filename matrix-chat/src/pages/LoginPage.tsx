import React, { useState } from "react";
import { loginWithPassword } from "../lib/auth";
import type { StoredSession } from "../lib/auth";
import { DEFAULT_BASE_URL } from "../lib/matrixClient";

interface LoginPageProps {
  onSuccess: (session: StoredSession) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onSuccess }) => {
  const [homeserver, setHomeserver] = useState(
    DEFAULT_BASE_URL || "https://matrix.org",
  );
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true);
    setError(null);
    try {
      const session = await loginWithPassword(
        homeserver.trim(),
        username.trim(),
        password,
      );
      onSuccess(session);
    } catch (err) {
      // Matrix SDK throws objects with an `errcode` field for protocol errors.
      const errcode =
        err !== null &&
        typeof err === "object" &&
        "errcode" in err &&
        typeof (err as { errcode: unknown }).errcode === "string"
          ? (err as { errcode: string }).errcode
          : null;

      if (errcode === "M_FORBIDDEN" || errcode === "M_USER_DEACTIVATED") {
        setError("Invalid username or password.");
      } else if (errcode === "M_LIMIT_EXCEEDED") {
        setError("Too many login attempts. Please wait and try again.");
      } else {
        setError(
          err instanceof Error ? err.message : "Login failed. Please try again.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    borderRadius: "10px",
    border: "1.5px solid #2a2a2a",
    background: "#1e1e1e",
    color: "#fff",
    fontSize: "14px",
    fontFamily: "'DM Sans', sans-serif",
    outline: "none",
    boxSizing: "border-box",
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; }
        body {
          background: #1a1a1a;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
        }
        .login-input:focus { border-color: #f5c800 !important; }
      `}</style>

      <div
        style={{
          width: "min(420px, 92vw)",
          background: "#fff",
          borderRadius: "14px",
          overflow: "hidden",
          boxShadow: "0 8px 48px rgba(0,0,0,0.5)",
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "24px",
            background: "#111",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              background: "#f5c800",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: "18px" }}>💬</span>
          </div>
          <div>
            <h1
              style={{
                fontSize: "16px",
                fontWeight: 700,
                color: "#fff",
                letterSpacing: "-0.01em",
              }}
            >
              Sign in to Streetlives Chat
            </h1>
            <p
              style={{
                fontSize: "12px",
                color: "#9ca3af",
                marginTop: "2px",
                fontFamily: "'DM Mono', monospace",
              }}
            >
              Powered by Matrix
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Homeserver */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label
              htmlFor="homeserver"
              style={{ fontSize: "12px", fontWeight: 600, color: "#374151", letterSpacing: "0.04em", textTransform: "uppercase", fontFamily: "'DM Mono', monospace" }}
            >
              Homeserver
            </label>
            <input
              id="homeserver"
              className="login-input"
              type="url"
              value={homeserver}
              onChange={(e) => setHomeserver(e.target.value)}
              disabled={loading}
              required
              style={inputStyle}
            />
          </div>

          {/* Username */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label
              htmlFor="username"
              style={{ fontSize: "12px", fontWeight: 600, color: "#374151", letterSpacing: "0.04em", textTransform: "uppercase", fontFamily: "'DM Mono', monospace" }}
            >
              Username
            </label>
            <input
              id="username"
              className="login-input"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="@user:matrix.org or just user"
              disabled={loading}
              required
              autoComplete="username"
              style={inputStyle}
            />
          </div>

          {/* Password */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label
              htmlFor="password"
              style={{ fontSize: "12px", fontWeight: 600, color: "#374151", letterSpacing: "0.04em", textTransform: "uppercase", fontFamily: "'DM Mono', monospace" }}
            >
              Password
            </label>
            <input
              id="password"
              className="login-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
              autoComplete="current-password"
              style={inputStyle}
            />
          </div>

          {/* Error */}
          {error && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "8px",
                padding: "10px 14px",
                color: "#b91c1c",
                fontSize: "13px",
              }}
            >
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !username.trim() || !password}
            style={{
              padding: "12px",
              borderRadius: "10px",
              border: "none",
              background: loading || !username.trim() || !password ? "#e5e7eb" : "#f5c800",
              color: loading || !username.trim() || !password ? "#9ca3af" : "#111",
              fontSize: "14px",
              fontWeight: 600,
              fontFamily: "'DM Sans', sans-serif",
              cursor: loading || !username.trim() || !password ? "not-allowed" : "pointer",
              transition: "background 0.15s, color 0.15s",
            }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </>
  );
};

export default LoginPage;

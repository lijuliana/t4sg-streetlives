import React from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import NavigatorChatPage from "./pages/NavigatorChatPage";

// ── Placeholder home so you can verify routing works ────────────────────────
const Home: React.FC = () => (
  <div style={{ padding: "40px", fontFamily: "sans-serif" }}>
    <h1>YourPeer / Streetlives</h1>
    <p style={{ marginTop: "12px" }}>
      <Link to="/navigator-chat">→ Open Navigator Chat Room</Link>
    </p>
  </div>
);

// ── If you already have a router, add this route to your existing <Routes>: ──
//
//   <Route path="/navigator-chat" element={<NavigatorChatPage />} />
//
// ─────────────────────────────────────────────────────────────────────────────

const App: React.FC = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/navigator-chat" element={<NavigatorChatPage />} />
    </Routes>
  </BrowserRouter>
);

export default App;
# Streetlives Matrix Chat

A prototype chat app for [Streetlives](https://www.streetlives.nyc/) that lets guests (people seeking social services) start an anonymous chat session and message a Navigator (social services coordinator) in real time. Messages are mirrored to a Matrix room so Navigators can also reply from any Matrix client (e.g. Element).

---

## Architecture

```
Browser (guest / navigator)
    ↕  REST API  (/api/...)
Express backend  (port 3000)
    ↕  Matrix Client-Server API
Matrix homeserver  (matrix.org)
```

- **Frontend** — React + Vite + TypeScript, served on port 5173 during development
- **Backend** — Express + TypeScript (ESM), served on port 3000
- **Matrix** — A single service-account bot is the sole Matrix actor; guests never receive Matrix credentials

---

## Prerequisites

- Node.js ≥ 18
- A Matrix account to use as the service bot (can be a free matrix.org account)

---

## Setup

### 1. Install dependencies

```bash
# Frontend (run from matrix-chat/)
npm install

# Backend
npm install --prefix backend
```

### 2. Configure the backend

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```env
MATRIX_BASE_URL=https://matrix.org
MATRIX_SERVICE_ACCOUNT_USER_ID=@your-bot:matrix.org
MATRIX_SERVICE_ACCOUNT_PASSWORD=yourpassword
PORT=3000
CORS_ORIGIN=http://localhost:5173
```

The backend will log in to Matrix automatically on startup and persist the session token to `.matrix-session.json` (gitignored). You do not need to copy tokens manually.

### 3. (Optional) Configure the frontend

The frontend proxies all `/api` requests to `http://localhost:3000` via Vite. No `.env` changes are needed for local development.

---

## Running

Open two terminals from the `matrix-chat/` directory:

```bash
# Terminal 1 — backend
npm run dev:backend

# Terminal 2 — frontend
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173).

---

## Features

### Guest chat flow (`/`)

1. Guest lands on a **Start Chat** screen — no session is created until they click the button.
2. Clicking **Start chat** creates a backend session and a Matrix room, then opens the chat UI.
3. Guest messages are sent via `POST /api/sessions/:id/messages` and mirrored to the Matrix room.
4. The UI polls `GET /api/sessions/:id/messages` every 3 seconds to display Navigator replies.
5. Sessions survive page refresh (cached in `localStorage`); the cache is validated against the backend on load.

### Navigator dashboard (`/navigator`)

A lightweight, no-auth dashboard for internal use:

- **Session list** — all sessions sorted newest-first, with status badges; auto-refreshes every 10 seconds
- **Session detail** — full message thread, Matrix room ID, and timestamps
- **Notes** — free-text notes attached to a session (stored in backend, not Matrix)
- **Referrals** — structured referrals with title and description
- **Close session** — marks a session `closed` so the guest can no longer send messages

### Matrix integration

- All Matrix I/O goes through the backend service account — guests have no Matrix credentials
- Navigator replies sent from Element (or any Matrix client) appear in the guest chat UI within ~5 seconds
- Token lifecycle is fully automated: login → persist → proactive refresh → reactive refresh on 401

---

## API reference

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/sessions` | Create a new guest session + Matrix room |
| `GET` | `/api/sessions` | List all sessions (newest first) |
| `GET` | `/api/sessions/:id` | Get session metadata |
| `PATCH` | `/api/sessions/:id/status` | Update status (`active` \| `closed`) |
| `POST` | `/api/sessions/:id/messages` | Send a guest message |
| `GET` | `/api/sessions/:id/messages` | Get messages (syncs from Matrix, throttled 5 s) |
| `GET` | `/api/sessions/:id/notes` | List notes |
| `POST` | `/api/sessions/:id/notes` | Add a note |
| `GET` | `/api/sessions/:id/referrals` | List referrals |
| `POST` | `/api/sessions/:id/referrals` | Add a referral |

---

## Current limitations

- **In-memory storage** — sessions, messages, notes, and referrals are lost when the backend restarts. Swap the in-memory stores in `backend/src/services/` for a database to persist data.
- **No authentication** — the Navigator dashboard at `/navigator` is open to anyone with the URL. Add auth before deploying.
- **No end-to-end encryption** — messages are visible to the Matrix homeserver.
- **Polling only** — the guest UI polls every 3 seconds instead of using Matrix sync or WebSockets.

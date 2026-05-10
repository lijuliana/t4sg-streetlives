# StreetLives — Developer Handoff Documentation

> **Last updated:** May 2026  
> **Project:** Tech for Social Good (T4SG) — StreetLives  
> **Branch at handoff:** `frontend-init`

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [File Structure](#3-file-structure)
4. [Setup & Local Development](#4-setup--local-development)
5. [Usage Guide](#5-usage-guide)
6. [Known Bugs & Issues](#7-known-bugs--issues)
9. [Performance & Limitations](#9-performance--limitations)
10. [Next Steps / Roadmap](#10-next-steps--roadmap)
11. [Developer Tips & Gotchas](#11-developer-tips--gotchas)

---

## 1. Project Overview

StreetLives is a web platform that connects unhoused individuals with human navigators who can help them access social services (housing, food, legal aid, healthcare, etc.).

### Problem it solves

Unhoused individuals often struggle to identify and access services. StreetLives provides a chat-based intake flow where a user describes their need, gets matched to a trained navigator, and receives real-time help. Supervisors oversee navigators, review closed sessions, and manage quality.

### Key features

- Anonymous chat for users (no login required) — starts a session, matched to a navigator automatically
- Navigator dashboard — view active/unassigned/closed sessions, chat with users, transfer sessions, submit for review
- Supervisor dashboard — review submissions, approve or return sessions with coaching notes, monitor navigator capacity
- Role-based access — Auth0 roles (`navigator`, `supervisor`) control which dashboard is accessible
- Session timeline — every state change (assigned, transferred, closed) is logged as an event
- Overdue detection — flags sessions where a navigator hasn't responded in 24+ hours

### Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| UI | React 19 + Tailwind CSS |
| State | Zustand (localStorage persistence) |
| Auth | Auth0 (`@auth0/nextjs-auth0` v4) |
| Backend | AWS Lambda (REST API, accessed via proxy) |
| Chat | Matrix (hosted externally, accessed via Lambda) |
| Icons | Lucide React |
| Toasts | Sonner |
| Date formatting | Moment.js |
| Animations | Framer Motion |

---

## 2. Architecture

### High-level overview

```
Browser
  │
  ├── Next.js (App Router)
  │     ├── Server components → fetch from Lambda via lambdaFetch()
  │     ├── Client components → fetch from /api/* routes
  │     └── /api/* routes → proxy to Lambda with Auth0 token injected
  │
  └── Auth0 (authentication + roles)

Lambda (AWS)
  ├── /sessions          → session CRUD
  ├── /navigators        → navigator CRUD
  └── /sessions/{id}/... → messages (Matrix), events, close, transfer, approve
```

### API proxy pattern

The frontend **never calls Lambda directly** from client components. All calls go through Next.js API routes in `src/app/api/`. Those routes use `lambdaFetch()` (server-only) which:

1. Gets the Auth0 access token for the current user
2. Injects `Authorization: Bearer {token}` into the request
3. Forwards the request to `NEXT_PUBLIC_API_URL` (Lambda)

This keeps credentials server-side and gives a single point to add logging, retries, or caching.

### Auth & role enforcement

Auth0 stores roles in a custom claim: `https://streetlives.app/roles`. The Next.js middleware (`src/middleware.ts`) reads this claim on every request to `/dashboard/*` and returns 403 if the role doesn't match the route.

Roles:
- `navigator` → can access `/dashboard/navigator`
- `supervisor` → can access `/dashboard/supervisor`
- No special role → `/dashboard/user` (end-users, includes logged-out anonymous sessions)

### Real-time updates

There is no WebSocket. Two polling mechanisms keep data fresh:

1. **`DashboardPoller`** — calls `router.refresh()` every 30 seconds to re-run server components and pull fresh session lists.
2. **Message polling** — when a navigator or supervisor opens a session detail page, the browser calls `/api/sessions/{id}/messages` every 7 seconds to check for new chat messages. This is how the chat feels "live" — there is no WebSocket. The interval is cleared automatically once the session is closed or the user navigates away, so only the currently open session page polls. 
3. **Note:** sent messages appear instantly for the sender via optimistic UI, but the other person only sees them when their next poll fires — meaning up to 7 seconds of lag before a new message appears on the recipient's screen.

### Chat (Matrix)

User ↔ Navigator messages are stored in a Matrix room managed by the Lambda backend. The frontend never talks to Matrix directly — it calls `/api/sessions/{id}/messages` which proxies to Lambda which talks to Matrix.

Message bodies from Matrix are formatted as `"Role: message text"` (e.g., `"User: Hello"`, `"Navigator: Hi there"`). The frontend parses this with `parseMessage()`.

### Navigator matching

When a user starts a chat, the Lambda backend runs a matching algorithm to assign a navigator. The algorithm considers navigator availability, capacity, language, and expertise. **Known issue:** the algorithm can assign sessions beyond a navigator's declared capacity.

---

## 3. File Structure

```
t4sg-streetlives/
├── src/
│   ├── app/
│   │   ├── api/                          # Next.js API routes (Lambda proxy)
│   │   │   ├── navigators/
│   │   │   │   ├── route.ts              # GET/POST /navigators
│   │   │   │   ├── [id]/route.ts         # GET/PUT /navigators/{id}
│   │   │   │   └── me/route.ts           # GET/PUT current user's profile
│   │   │   └── sessions/
│   │   │       ├── route.ts              # GET /sessions
│   │   │       └── [sessionId]/
│   │   │           ├── route.ts          # GET/PATCH/DELETE session
│   │   │           ├── messages/         # GET Matrix messages
│   │   │           ├── events/           # GET/POST session timeline events
│   │   │           ├── approve/          # POST approve (supervisor)
│   │   │           ├── close/            # POST close (navigator)
│   │   │           ├── transfer/         # POST transfer to another navigator
│   │   │           ├── navigator-messages/ # POST send navigator chat message
│   │   │           └── user-close/       # POST close session as user (M2M auth)
│   │   │
│   │   ├── auth/
│   │   │   ├── signin/page.tsx
│   │   │   └── signup/page.tsx
│   │   │
│   │   ├── dashboard/
│   │   │   ├── navigator/
│   │   │   │   ├── page.tsx              # Navigator: session list dashboard
│   │   │   │   ├── profile/page.tsx      # Navigator: profile setup/edit
│   │   │   │   └── [sessionId]/
│   │   │   │       ├── page.tsx          # Navigator: split-panel session detail + chat
│   │   │   │       └── chat/page.tsx     # Navigator: standalone chat view
│   │   │   ├── supervisor/
│   │   │   │   ├── page.tsx              # Supervisor: oversight dashboard
│   │   │   │   └── [sessionId]/
│   │   │   │       ├── page.tsx          # Supervisor: session detail + actions
│   │   │   │       └── chat/page.tsx     # Supervisor: chat transcript
│   │   │   └── user/
│   │   │       ├── page.tsx              # User: active session view
│   │   │       └── [sessionId]/page.tsx  # User: session transcript
│   │   │
│   │   ├── chat/page.tsx                 # Anonymous user chat interface
│   │   ├── layout.tsx                    # Root layout (Sonner + StoreSync)
│   │   └── page.tsx                      # Public landing page
│   │
│   ├── components/
│   │   ├── DashboardPoller.tsx           # Polls router.refresh() every 30s
│   │   ├── ShowMoreList.tsx              # Expand/collapse list (default: show 3)
│   │   ├── OverdueFlair.tsx              # Red "Response overdue" badge (24h+)
│   │   ├── DeleteSessionButton.tsx       # Trash icon → DELETE /api/sessions/{id}
│   │   ├── StoreSync.tsx                 # Hydrates Zustand store on mount
│   │   ├── NavigatorProfileForm.tsx      # Navigator profile form
│   │   ├── ReferralCard.tsx              # Referral display card
│   │   ├── ReferralForm.tsx              # Referral creation form
│   │   └── ...                           # Other UI components
│   │
│   ├── lib/
│   │   ├── auth0.ts                      # Auth0Client init + ROLES_CLAIM constant
│   │   ├── lambda.ts                     # lambdaFetch() server-only helper
│   │   ├── utils.ts                      # cn(), hasUnresponded24h()
│   │   ├── store.ts                      # Zustand store + types
│   │   └── chatApi.ts                    # Client-side anonymous chat API wrapper
│   │
│   └── middleware.ts                     # Auth0 middleware + role-based routing
│
├── public/
│   └── new-icons/                        # SVG icons for session categories
│
├── .env.local                            # Secrets (not committed)
├── next.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

### Key files explained

| File | Purpose |
|---|---|
| `src/middleware.ts` | Enforces auth + role gating on every request. Read this first to understand access control. |
| `src/lib/lambda.ts` | Single place where Auth0 token injection happens. All server→Lambda calls go through here. |
| `src/lib/auth0.ts` | Auth0 client config. The `ROLES_CLAIM` constant (`https://streetlives.app/roles`) is used everywhere roles are read. |
| `src/lib/store.ts` | Zustand store. Contains all shared types. Persists to localStorage under key `streetlives-store-v10`. |
| `src/lib/chatApi.ts` | Used by the anonymous `/chat` page. Unlike other API calls, this hits Lambda directly (no auth token). |
| `src/app/dashboard/navigator/[sessionId]/page.tsx` | Most complex page. Split-panel layout, message polling, session close flow, transfer, timeline. |
| `src/app/dashboard/supervisor/[sessionId]/page.tsx` | Supervisor review page. Approve, return with notes, transfer, view timeline. |

---

## 4. Setup & Local Development

### Prerequisites

- Node.js 18+
- npm or yarn
- Access to the project's Auth0 tenant (ask the project lead)
- Access to the Lambda API URL (ask the project lead)

### Installation

```bash
git clone https://github.com/lijuliana/T4SG-Streetlives
cd t4sg-streetlives
npm install
```

### Environment variables

Create `.env.local` in the project root:

```env
# Auth0 — get from Auth0 dashboard (Application settings)
AUTH0_DOMAIN=dev-i2wpbc2253ciduoj.us.auth0.com
AUTH0_CLIENT_ID=<your-client-id>
AUTH0_CLIENT_SECRET=<your-client-secret>

# Auth0 API audience — must match the Auth0 API identifier
AUTH0_AUDIENCE=https://streetlives.app/api

# Lambda backend base URL
NEXT_PUBLIC_API_URL=https://oni18c6q64.execute-api.us-east-1.amazonaws.com

# Your local URL (used for Auth0 callback URLs)
APP_BASE_URL=http://localhost:3000
```

> **Note:** `NEXT_PUBLIC_API_URL` is prefixed with `NEXT_PUBLIC_` so it's accessible client-side (used by `chatApi.ts` for anonymous chat). All other variables are server-only.

### Running locally

```bash
npm run dev
```

Visit `http://localhost:3000`.

To verify it's working:
- Landing page loads at `/`
- Anonymous chat accessible at `/chat`
- Login at `/auth/login` — Auth0 redirects back to home, then role-based redirect to dashboard

### Creating test accounts

1. Log in via Auth0
2. In the Auth0 dashboard, assign the `navigator` or `supervisor` role to the user manually
3. Log out and back in (roles are read from the session token, which refreshes on login)

---

## 5. Usage Guide

### User flow (anonymous)

1. User visits `/chat`
2. Selects need category + language
3. Chat window opens — Lambda creates a session and runs the matching algorithm
4. Navigator is assigned; user can chat in real time
5. Navigator closes session when help is complete

### Navigator flow

1. Log in → routed to `/dashboard/navigator`
2. **First visit:** redirected to `/dashboard/navigator/profile` to complete profile (name, languages, expertise, nav group, capacity)
3. Dashboard shows: **Active** (my open sessions), **Unassigned** (available to pick up), **Closed** (my past sessions)
4. Click a session → split-panel view:
   - **Left:** session info, session notes, timeline, transfer/close controls
   - **Right:** live chat
5. To close: select outcome(s), optionally add notes, click "Close & Submit for Review"
6. Closed sessions appear in the supervisor's "Needs Review" queue

### Supervisor flow

1. Log in → routed to `/dashboard/supervisor`
2. Dashboard shows:
   - **Needs Review** (left) — closed sessions awaiting approval
   - **By Navigator** (right) — all navigators with capacity bars
   - **Unassigned** — sessions not yet picked up
   - **Approved Archive** — sessions marked approved
3. Click a session → detail view with:
   - Session metadata, notes, outcome, follow-up date
   - Timeline of events
   - Chat transcript
   - **Approve** button — marks `approved: true`
   - **Return** button — sends session back to navigator with coaching notes (partially implemented — see known issues)
   - **Transfer** — reassign to a different navigator

### Navigator profile fields

| Field | Description |
|---|---|
| `first_name`, `last_name` | Display name shown to supervisors |
| `nav_group` | Organization (e.g., CUNY_PIN, Housing Works). Used as fallback display name if no real name set. |
| `languages` | Languages spoken (used in matching) |
| `expertise_tags` | Areas of expertise (used in matching) |
| `capacity` | Max concurrent active sessions |
| `status` | `available`, `away`, `offline` |
| `availability_schedule` | Day → `{start, end}` hours when they're active |
| `is_general_intake` | Whether they accept general (non-specialized) intake |

### Session status values

| `status` | Meaning |
|---|---|
| `active` | Open, being worked on |
| `closed` | Closed by navigator or user |

Additional flags on closed sessions:
- `submitted_for_review: true` — navigator submitted for supervisor review
- `approved: true` — supervisor approved
- `coaching_notes` — supervisor feedback if session was returned

---

## 6. Known Bugs & Issues

### 6.1 Return-to-navigator not fully implemented

**Description:** The supervisor can click "Return to Navigator" with coaching notes, but the backend DB logic to actually revert the session status and notify the navigator is not wired up.

**Expected:** Session returned to `active`, navigator sees it in their dashboard with supervisor's coaching notes.

**Actual:** The POST may succeed but the session state in the DB may not update correctly.

**Fix needed:** Backend — ensure the `/sessions/{id}/return` endpoint sets `status: "active"`, `submitted_for_review: false`, and saves `coaching_notes`.

---

### 6.2 Delete button does not work

**Description:** The trash icon on "Needs Review" sessions in the supervisor dashboard sends `DELETE /api/sessions/{id}` but the Lambda endpoint does not actually delete the record.

**Steps to reproduce:** Supervisor dashboard → Needs Review → click trash icon → confirm → session remains.

**Fix needed:** Backend — implement the DELETE handler in Lambda. Frontend code is correct.

---

### 6.3 Sessions not flagged by who closed them

**Description:** There is no `closed_by` or `close_source` field in the session data. This means the frontend cannot distinguish between "user closed the chat" vs "navigator closed the chat." All closed sessions show a generic "Closed" status rather than "User Ended" or "Navigator Closed."

**Impact:** Supervisors cannot filter or sort by close reason. All closed sessions appear in "Needs Review" regardless of why they were closed.

**Fix needed:** Backend — add a `close_source: "user" | "navigator"` field, set it when `/close` or `/user-close` is called. Frontend can then display appropriately and supervisors can filter out user-closed sessions if desired.

---

### 6.4 Initial message load is slow (~3-10 seconds)

**Description:** When a navigator or supervisor opens a session for the first time in a browser session, messages take ~10 seconds to appear.

**Root cause:** The Lambda → Matrix message fetch is slow on cold start or for large rooms.

**Frontend mitigation (implemented):** Messages are cached in `localStorage` under `sl_messages_{sessionId}`. On subsequent opens of the same session, cached messages render instantly while the poll runs in the background to fetch any new ones. Only affects the very first open on a fresh browser — after that, the cache makes it feel instant.

**Remaining fix needed:** Backend — cache recent messages in the DB so the Lambda fetch doesn't need to hit Matrix cold every time.

---

### 6.5 Matching algorithm exceeds navigator capacity

**Description:** The Lambda matching algorithm can assign a new session to a navigator who is already at their declared max capacity.

**Impact:** Navigators get overloaded. The supervisor dashboard shows capacity bars turning orange/red to indicate overload, but sessions are still assigned.

**Fix needed:** Backend — add a capacity check before assigning. Reject or queue the session if all navigators are at capacity.

---

### 6.6 Referral functionality not implemented

**Description:** The `ReferralCard` and `ReferralForm` components exist in the codebase, and the Zustand store has referral types (`Referral`, `ReferralStatus`, `ReferralCategory`), but referrals are not wired to the backend or displayed in the session detail views.

**Fix needed:** Design the referral data model in the DB, add Lambda endpoints, and integrate into the navigator session close flow.

---

### What to add

- Unit tests for utility functions (`cn`, `hasUnresponded24h`, language mapping, `navFullName` fallback)
- Integration tests for API routes (mock Lambda, test auth token injection)
- E2E tests (Playwright) for critical user journeys: user chat → navigator response → supervisor approval

### Fragile areas

- `OverdueFlair` depends on `localStorage` key `sl_nav_responded_{sessionId}`. If the key is absent (e.g., navigator used a different browser), the session will incorrectly show as overdue.
- Message deduplication uses a `seenEventIds` ref. On page load this is seeded from the localStorage cache, so previously-seen messages won't re-appear. However if the cache is cleared, all messages will re-fetch and deduplicate correctly on the first poll.

---

## 9. Performance & Limitations

### Message polling

Every open session detail page polls `/api/sessions/{id}/messages` every 7 seconds. With multiple navigators logged in across multiple tabs, this generates high Lambda request volume. If the team scales to 20+ navigators each with a tab open, this could become expensive.

**Mitigation:** Polling stops when a session is closed (`session?.status === "closed"`). But navigators with many concurrent active sessions multiply the polling.

**Future fix:** Replace polling with WebSocket or Server-Sent Events at the Lambda/Matrix layer.

### Dashboard refresh

`DashboardPoller` calls `router.refresh()` every 30 seconds. This re-runs all server components for the dashboard page — i.e., re-fetches all sessions and navigators from Lambda. At low scale this is fine; at high scale it could be expensive.

### Lambda cold starts

The Lambda backend has cold start latency. First requests after idle periods are noticeably slow (5–10+ seconds). This particularly affects the initial load of chat messages.

### No pagination

Session lists (closed sessions, approved archive) are fetched in full on every load. If a supervisor has thousands of sessions, this will become slow. Currently mitigated by `ShowMoreList` limiting display, but the data is still all fetched upfront.

---

## 10. Next Steps / Roadmap

### Immediate (bugs to fix)

- [ ] Implement return-to-navigator backend logic
- [ ] Implement session delete in Lambda
- [ ] Add `close_source` field to session model

### Short-term features

- [ ] **Referral flow** — complete the referral UI and wire it to backend. Show referrals in session detail and close flow.
- [ ] **Navigator availability toggle** — button to set status to `away`/`offline` on the navigator dashboard

### Medium-term

- [ ] **Replace polling with real-time** — WebSocket or SSE for messages and session updates
- [ ] **Pagination** for session lists (backend support needed)
- [ ] **Supervisor analytics** — aggregate views: sessions per day, avg response time, category breakdown
- [ ] **Email/SMS notifications** — notify navigators when a new session is assigned

### Technical debt

- The Zustand store (`store.ts`) is large and contains many types and actions that are partially unused or duplicated with the backend data models. Consider consolidating once the backend models are stable.
- `chatApi.ts` (anonymous chat) uses a different auth pattern (no token) than all other API calls. It would be cleaner to unify under the same proxy pattern with a guest/anonymous token.
- `mockData.ts` still exists and should be removed once confirmed unused.
- Multiple components define the same `Session` and `NavProfile` interfaces locally (in page files) instead of importing from a shared types file. Consolidate into `src/lib/types.ts`.

---

## 11. Developer Tips & Gotchas

### Auth0 roles don't update in the session until re-login

If you assign the `navigator` or `supervisor` role to a user in the Auth0 dashboard, they must **log out and log back in** before the role is reflected. The role is stored in the session token which is only re-issued at login.

### `lambdaFetch` is server-only

`src/lib/lambda.ts` uses `auth0.getAccessToken()` which only works in server context (API routes, server components). Do not import it into client components — it will throw at runtime.

### `NEXT_PUBLIC_API_URL` is exposed to the browser

Any env variable prefixed with `NEXT_PUBLIC_` is embedded in the client bundle. This is intentional for `chatApi.ts` (anonymous chat hits Lambda directly). Do not put secrets in `NEXT_PUBLIC_` variables.

### Multiple browser tabs during testing

If you're testing with multiple tabs (e.g., logged in as navigator in one tab and supervisor in another), each tab runs its own polling intervals. This is expected behavior but can generate noisy server logs.

### `nav_group` vs navigator name

`nav_group` is the **organization** a navigator belongs to (e.g., `CUNY_PIN`, `Housing_Works`). It is not a person's name. Always use `navFullName()` / `navDisplayName()` helpers (defined in each page file) to get a display name — these check `first_name`/`last_name` first and fall back to `nav_group` with a short ID suffix only if no name is set.

### Session close vs submit for review

Navigators have a single "Close & Submit for Review" action. There is no way to close a session without submitting it (from the navigator's perspective). If a session appears in "Needs Review" without `submitted_for_review: true`, it was likely closed via a different path (e.g., user-close endpoint).

### Optimistic messages

When a navigator sends a message, an optimistic entry is immediately added to the message list with `pending: true` and 50% opacity. On the next poll, if a matching confirmed message arrives from Matrix (same role + content), the optimistic entry is removed and replaced. If the send fails, the optimistic entry is removed and an error is shown. Pending messages are never written to the localStorage cache.

### Message ordering

Messages are sorted by timestamp on every poll merge. This prevents out-of-order display when messages sent in rapid succession are confirmed by Matrix in a different order than they were sent.

### Message cache (localStorage)

Chat messages are cached in `localStorage` under the key `sl_messages_{sessionId}`. On page load, the cache is read synchronously and used to populate the message list before any network request fires — eliminating the blank-screen delay on re-opening a session. The `seenEventIds` set is also seeded from the cache so already-seen messages aren't re-appended on the first poll.

### `OverdueFlair` depends on localStorage

The "Response overdue" badge checks `localStorage.getItem('sl_nav_responded_{sessionId}')`. This key is set when a navigator successfully sends a message. If a navigator responds from a different device/browser, the flair will still appear on their first device. This is a known limitation.

### Tailwind brand colors

Custom colors are defined in `tailwind.config.ts`:
- `bg-brand-yellow` / `text-brand-yellow` → `#FFDC00` (primary accent)
- `bg-brand-exit` / `text-brand-exit` → `#E83E5C` (Quick Exit button — always present for safety)
- `bg-brand-dark` → `#323232`


### `suppressHydrationWarning`

Many timestamp elements have `suppressHydrationWarning` on them. This suppresses React's hydration mismatch warning that occurs because `moment()` formats dates differently on server (UTC) vs client (local timezone). The timestamps are correct client-side; the warning is benign but annoying without the suppression.

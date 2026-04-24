# Deliverable 8 — Session Management & Dashboard 

## Backend — `backend/lambda/index.mjs`

### New endpoints
- **`PATCH /sessions/:id`** — updates `notes`, `outcome`, `follow_up_date`, `submitted_for_review`. Only the assigned navigator or a supervisor can update. Returns the full updated session row.
- **`POST /sessions/:id/approve`** — supervisor only. Saves `coaching_notes` and sets `approved = true`. Returns the full updated session row.

### Updated endpoints
- **`GET /sessions`** — now role-aware. Reads the `https://streetlives.app/roles` claim from the Auth0 access token (set by the existing Auth0 Action on both ID and access tokens).
  - `supervisor` → returns all sessions
  - `navigator` → looks up their navigator profile by `auth0_user_id`, returns only sessions where `navigator_id` matches
  - anything else → 403

### New columns added to RDS sessions table
`notes TEXT`, `outcome TEXT[]`, `follow_up_date DATE`, `submitted_for_review BOOLEAN`, `approved BOOLEAN`, `coaching_notes TEXT`

---

## Next.js API Proxies — `src/app/api/`

New proxy routes added (all forward to Lambda with the Auth0 Bearer token):

| File | Method | Forwards to |
|---|---|---|
| `sessions/[sessionId]/route.ts` | `PATCH` | `PATCH /sessions/:id` |
| `sessions/[sessionId]/approve/route.ts` | `POST` | `POST /sessions/:id/approve` |
| `sessions/[sessionId]/transfer/route.ts` | `POST` | `POST /sessions/:id/transfer` |
| `sessions/[sessionId]/events/route.ts` | `GET` | `GET /sessions/:id/events` |

---

## Navigator Dashboard

### Page 1 — `src/app/dashboard/navigator/page.tsx`
- Sections renamed: **Active / Unassigned / Closed**
- Session rows link to the detail page (`/dashboard/navigator/:id`)

### Page 2 — `src/app/dashboard/navigator/[sessionId]/page.tsx`
It was previously mock-data (Zustand). Now:
- Fetches real session, navigators, and events from the API on mount
- **Split layout**: left panel = session details, right panel = live chat. Panels are resizable via a drag handle.
- **Session notes**: editable textarea, saves via `PATCH /sessions/:id` on blur
- **Timeline**: real session events from `GET /sessions/:id/events`
- **Transfer**: dropdown of available navigators (excluding current), requires explicit Transfer button press — no accidental transfers
- **Close session**: outcome checkboxes (Referrals shared / Information Only / Follow-Up Needed), follow-up date picker. On confirm: calls `POST /sessions/:id/close` then `PATCH /sessions/:id` with outcome, follow_up_date, and `submitted_for_review: true`
- No referrals functionality

---

## Supervisor Dashboard

### Page 1 — `src/app/dashboard/supervisor/page.tsx`
It was previously mock-data (Zustand). Now:
- Fetches real sessions and navigators from the API (server component)
- Three sections: **Needs Review** (`submitted_for_review=true`, `approved=false`), **Active** (status not closed), **Approved Archive** (`approved=true`)
- Each row links to `/dashboard/supervisor/:id`

### Page 2 — `src/app/dashboard/supervisor/[sessionId]/page.tsx` *(new file)*
- Fetches real session, navigators, and events on mount
- **Split layout** with resizable drag handle (same as navigator detail)
- Left panel: session info, read-only notes, timeline, coaching notes field + Approve button (only shown for Needs Review sessions). Approved sessions show coaching notes read-only.
- Right panel: read-only chat transcript (polls Matrix for active sessions, single fetch for closed)
- Approve calls `POST /sessions/:id/approve` with coaching notes, then redirects to supervisor dashboard

---

## User Dashboard

### Page 1 — `src/app/dashboard/user/page.tsx`
It was also previously mock-data (Zustand). It now reads entirely from **localStorage** — no user account, full anonymity preserved.

- **Active Session**: reads `sl_session_id` + `sl_session_state` from localStorage. On mount, verifies real status via `GET /sessions/:id?token=...` — if the navigator has already closed the session, localStorage is corrected immediately and the session moves to Past Sessions.
- **Past Sessions**: reads `sl_past_sessions` array from localStorage. Each entry links to the read-only transcript.

### Transcript Page — `src/app/dashboard/user/[sessionId]/page.tsx`
This was also previously mock-data. Now:
- Looks up the session token from `sl_past_sessions` in localStorage
- Fetches the full Matrix message history using `fetchMessages(id, token)`
- Renders a read-only chat transcript (same bubble layout as the live chat)
- If the session isn't found in localStorage (for instance if a user uses a different device, or cleared  their browser), shows a plain "no longer available on this device" message — consistent with the log-nothing architecture

### Chat page — `src/app/chat/page.tsx`
Two additions:
- Stores `sl_session_need_category` and `sl_session_created_at` in localStorage when a session is created
- When the status poll detects a closed session, writes `{ id, token, need_category, created_at }` to the `sl_past_sessions` array (deduped by ID) so the dashboard can display it

---

## localStorage keys (user-side, device-only)

| Key | Value | Cleared when |
|---|---|---|
| `sl_session_id` | UUID | User starts new chat |
| `sl_session_token` | UUID | User starts new chat |
| `sl_session_state` | `picker/waiting/live/closed` | User starts new chat |
| `sl_session_need_category` | e.g. `housing` | User starts new chat |
| `sl_session_created_at` | ISO timestamp | User starts new chat |
| `sl_past_sessions` | JSON array of closed sessions | Never (accumulates) |

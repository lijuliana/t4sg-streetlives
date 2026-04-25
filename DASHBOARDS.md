# Navigator & Supervisor Dashboards

This document covers implementation details, data flow, and functionality for the navigator and supervisor dashboards in the StreetLives application.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Navigator Dashboard](#navigator-dashboard)
- [Supervisor Dashboard](#supervisor-dashboard)
- [Shared Components](#shared-components)
- [Session Lifecycle](#session-lifecycle)
- [Permission Matrix](#permission-matrix)

---

## Architecture Overview

Both dashboards are built on a shared Zustand store with localStorage persistence (`"streetlives-store-v10"`). Only `sessions` and `chatMessages` are persisted — `activeRole` is kept in memory only. All session state mutations go through store actions; components never mutate state directly.

**Key types:**

```ts
type SessionStatus = "queued" | "active" | "closed";
type ReferralStatus = "shared" | "called_together" | "appointment_scheduled" | "contacted" | "visited" | "waitlisted";
type AppRole = "user" | "navigator" | "supervisor";
type SessionEventType = "created" | "assigned" | "transferred" | "closed" | "returned";
```

**Routing algorithm** (`routeSession`): when a session needs assignment, available navigators are filtered, specialists for the session's category are preferred, and the navigator with the lowest load ratio (`active_count / capacity`) is selected.

---

## Navigator Dashboard

### Files

| File | Purpose |
|------|---------|
| `src/app/dashboard/navigator/page.tsx` | List view — active sessions, new requests, past sessions |
| `src/app/dashboard/navigator/[sessionId]/page.tsx` | Session detail — role-aware; editable for navigator, read-only for supervisor |
| `src/app/dashboard/navigator/[sessionId]/chat/page.tsx` | Live chat interface |

### List View

The navigator home (`/dashboard/navigator`) is scoped to `DEMO_NAVIGATOR_ID = "nav-1"` (Jenna Rivera) and splits sessions into three sections:

- **Active** — sessions with status `!== "closed"` assigned to this navigator
- **New Requests** — unassigned sessions (`navigatorId === null`)
- **Past** — closed sessions

A summary strip at the top shows counts for each section, with the "New Requests" count highlighted amber when non-zero.

Sessions in the **New Requests** section show an orange **"New Request"** badge instead of the standard green "Active" badge. This is handled in `SessionCard` by checking `isUnassigned && viewerRole === "navigator"`.

### Session Detail

The detail page (`/dashboard/navigator/[sessionId]`) is role-aware — it serves both navigators and supervisors, with sections conditionally shown or hidden based on `activeRole`. Supervisors primarily access sessions through their own detail page (`/dashboard/supervisor/[sessionId]`), but this page adjusts if a supervisor reaches it directly.

The title is always `#[last 5 chars of session ID]`. The header action contains an **"Open Chat"** button (navigators) or **"Transcript"** button (supervisors), with a count badge showing the number of messages if any exist.

**Sections (in order):**

1. **Header panel** — topics, routing badge ("Routed" in blue when `assignedByRouting === true`), status badge, navigator name or "Unassigned", start/close timestamps

2. **Accept Session** — navigator role + unassigned session only; calls `assignSession(sessionId, DEMO_NAVIGATOR_ID)` and shows a success toast

3. **Assign to Navigator** — supervisor role + unassigned session only; a select dropdown of all navigators; `assignSession()` fires immediately on selection

4. **Routing** — supervisor role + active + assigned only; two controls side by side:
   - Transfer dropdown (lists all navigators except the current one); `transferSession()` fires on selection
   - "Re-run Routing" button; calls `rerouteSession()`

5. **Close Session button** — navigator role + active + own session only; opens the wrap-up form inline

6. **Wrap-up form** — shown when close button is clicked; requires completion before closing:
   - **Outcome** (required, multi-select checkboxes): "Referrals shared", "Information only", "Follow-up needed"
   - **Notes** (optional textarea)
   - **Schedule follow-up** checkbox + date picker (date picker appears when checked or when "Follow-up needed" is selected)
   - **"Close & Submit for Review"** button — disabled until at least one outcome is selected; fires `endSession()` → `logSession()` → `submitForReview()` in sequence

7. **Outcome Log** — read-only; shown after session is closed and logged (`isClosed && session.logged`); displays outcome tags, session notes, follow-up date if set, and a list of referral names captured at close

8. **Session Notes** — free-text textarea when active (saves on blur via `updateSessionStatus()`); static read-only text when closed or viewed by supervisor

9. **Referrals** — always visible; `ReferralCard` list with editable status dropdowns when active + navigator + own session, read-only otherwise; "Add Referral" button only shown when active + navigator + own session

10. **Timeline** — immutable event log using `TimelineEvent` component (see below)

11. **Review Status** — navigator role + closed + logged only; shows one of three states:
    - Awaiting review: gray card "Awaiting supervisor review"
    - Approved: green card with approval timestamp and supervisor's coaching note
    - Returned: red card with return note (`supervisorReturnNote`)

12. **Supervisor Review panel** — supervisor role + closed + logged + not yet decided; coaching note textarea (optional to approve, required to return); "Return to Navigator" and "Approve" buttons both navigate back to `/dashboard/supervisor` on action

### Timeline

The timeline uses the `TimelineEvent` component. Each event shows a color-coded icon, the event label, and a `▼`/`▲` toggle button if a note is attached. Timestamp and actor name appear below. Expanding the toggle shows a gray box with a "NOTES" label above the note text.

**Event types and icons:**

| Type | Icon | Color | Label |
| ---- | ---- | ----- | ----- |
| `created` | Circle | Gray | Session created |
| `assigned` | UserPlus | Blue | Assigned |
| `transferred` | ArrowRight | Amber | Transferred |
| `closed` | CheckCircle | Green | Session closed |
| `returned` | RotateCcw | Orange | Returned to navigator |

### Chat

The chat page (`/dashboard/navigator/[sessionId]/chat`) is write-enabled for navigators on active sessions, and read-only otherwise. A session returned by a supervisor (`reviewStatus === "returned"`) resets `status` to `"active"`, so the chat input is re-enabled for the navigator.

**Message types and rendering:**

| Role | Alignment | Style |
|------|-----------|-------|
| `navigator` | Right | Yellow bubble |
| `bot` | Right | Gray bubble |
| `user` | Left | White card + avatar |
| `system` | Center | Divider with text |
| Referral (`serviceId` present) | Right | Yellow card with "Click here for details →" link |

The referral link navigates to `/services/[serviceId]?back=/dashboard/navigator/[sessionId]/chat`, so the back arrow on the service detail page returns to this chat. The input bar shows "Reply as [Navigator Name]…" and is hidden in read-only mode. An END button in the header opens an inline confirmation banner before closing the session.

---

## Supervisor Dashboard

### Files

| File | Purpose |
|------|---------|
| `src/app/dashboard/supervisor/page.tsx` | Overview — metrics grid + per-navigator load breakdown |
| `src/app/dashboard/supervisor/[sessionId]/page.tsx` | Session detail — always read-only with routing controls and review panel |
| `src/app/dashboard/supervisor/[sessionId]/chat/page.tsx` | Transcript view — read-only, no input |

### List View

The supervisor home (`/dashboard/supervisor`) has visibility into all sessions across all navigators.

**Metrics grid** (2 columns on mobile, 5 on desktop):

| Metric | Highlight color |
|--------|----------------|
| Total Sessions | Gray |
| Active | Green |
| New Requests | Amber (when > 0) |
| Total Referrals | Blue |
| Awaiting Review | Amber (when > 0) |

**By Navigator section** — each navigator is rendered as an expandable `NavigatorRow`:

- Avatar with availability indicator dot
- Amber dot on name if any of their sessions have `reviewStatus === "submitted"`
- Status summary: active count, closed count, load ratio (`active / capacity`)
- Load bar (green below 75% capacity, amber at or above 75%)
- Click to expand — reveals a list of the navigator's sessions via `SessionCard` with `viewerRole="supervisor"`

**Load bar width mapping:**

| Load ratio | Bar width |
|-----------|-----------|
| ≥ 100% | Full |
| ≥ 75% | 3/4 |
| ≥ 50% | 1/2 |
| ≥ 25% | 1/4 |
| < 25% | Minimal |

### Session Detail

The supervisor session detail is always read-only for session content. The header action is a **"Transcript"** button with a message count badge linking to the supervisor chat view.

**Sections (in order):**

1. **Header panel** — topics (no routing badge), status badge, navigator name or "Unassigned", start/close timestamps

2. **Assign to Navigator** — unassigned sessions only; same select dropdown as navigator page

3. **Routing** — active + assigned sessions only; transfer dropdown and "Re-run Routing" button

4. **Session Notes** — always read-only; shows summary text or "No summary recorded."

5. **Referrals** — always read-only; `ReferralCard` list with `editable={false}`

6. **Timeline** — uses `SupervisorTimelineEvent` component; identical behavior to the navigator timeline (notes toggle with "NOTES" label) but uses a plain gray dot instead of color-coded icons

7. **Supervisor Review** — closed + logged + not yet approved or returned:
   - Coaching note textarea (optional to approve, required to return)
   - "Return to Navigator" — disabled until coaching note is entered; calls `returnSession()`, appends a `"returned"` event with the note, reopens the session (`status: "active"`), navigates to `/dashboard/supervisor`
   - "Approve" — always enabled; calls `approveSession()`, navigates to `/dashboard/supervisor`

8. **Review Decision** — closed + already decided (approved or returned); read-only card showing:
   - Approved: green "Approved · [timestamp]" with coaching note below if present
   - Returned: red "Returned to navigator" label (no note shown here — the return note is visible to the navigator on their detail page)

### Chat Transcript

The supervisor chat view is identical in rendering to the navigator chat but with no input bar and no END button. The header reads "Transcript · [User Display Name]" with "Read-only" as the subtitle. `isReadOnly` is always `true` for supervisors.

---

## Shared Components

### `DashboardShell`

Layout wrapper used by all detail and list pages.

```ts
interface Props {
  title: string;
  role?: AppRole;           // When omitted, no role badge is shown
  backHref?: string;        // When provided, renders a back arrow
  action?: React.ReactNode; // Right-side slot (e.g. "Transcript" button)
  children: React.ReactNode;
}
```

The header is sticky and capped at `max-w-lg`. The role badge uses `bg-brand-yellow text-gray-900` for all roles (user, navigator, supervisor). Omitting `role` hides the badge entirely — used by the service detail page since it is accessed from multiple roles.

### `SessionCard`

Renders a session summary row used in list views. Accepts `viewerRole` to adjust display:
- Navigator/supervisor view: shows `#[last 5 digits of ID]` instead of navigator name
- User view: shows navigator name with yellow avatar and initials
- Navigator/supervisor view: shows gray silhouette avatar (sessions are anonymous)
- Supervisor view only: shows "Needs Review" amber badge when `reviewStatus === "submitted"`
- Navigator view only: shows "Returned" red badge when `reviewStatus === "returned"`
- Unassigned sessions in navigator view: shows an orange **"New Request"** badge instead of the status badge

### `ReferralCard`

Displays a single referral. When `editable={true}`, the status field is a dropdown that calls `updateReferralStatus()` on change. When `editable={false}`, status is a static badge. Notes are shown below in italic gray if present.

### `ReferralForm`

Modal dialog (Radix UI) for adding referrals, used only by navigators on active sessions.

- Search input filters `MOCK_SERVICES` by name
- Neighborhood and category filter dropdowns
- Clicking a result selects it (highlighted with yellow border)
- Status defaults to `"shared"`; optional notes textarea
- Submit is disabled until a service is selected

On submit:
```
addReferral(sessionId, { serviceName, category, status, notes })
addChatMessage(sessionId, { role: "navigator", content: serviceName, serviceId })
```

This ensures every referral added through the form also appears as a message in the chat transcript.

### `SessionStatusBadge`

Simple badge mapping `SessionStatus` to a color. `queued` and `closed` are both gray; `active` is green. Not used for unassigned sessions in the navigator list view — those render the orange "New Request" badge directly in `SessionCard`.

---

## Session Lifecycle

```
User initiates chat
  └─ createSession() → status: "queued", navigatorId: null or assigned

Unassigned session
  ├─ Navigator accepts → assignSession() → "assigned" event
  ├─ Supervisor assigns manually → assignSession() → "assigned" event
  └─ Supervisor re-routes → rerouteSession() → routing algorithm picks navigator

Active session (navigator)
  ├─ addReferral() → Referral created + chat message linked by serviceId
  ├─ updateSessionStatus() → session.summary updated
  ├─ addChatMessage() → live chat
  └─ transferSession() → "transferred" event, new navigator assigned

Navigator closes session
  ├─ endSession() → status: "closed", "closed" event appended
  ├─ logSession() → outcome + notes + follow-up + referral names stored on session
  └─ submitForReview() → reviewStatus: "submitted"

Supervisor reviews
  ├─ approveSession(note) → reviewStatus: "approved", reviewedAt set → back to /dashboard/supervisor
  └─ returnSession(note) → reviewStatus: "returned", status: "active", "returned" event appended
                         → navigates back to /dashboard/supervisor

Navigator sees "Returned" badge, session is re-opened (chat re-enabled), may re-submit after further review
```

---

## Permission Matrix

| Action | Navigator | Supervisor |
|--------|-----------|------------|
| View own sessions | Yes | — |
| View all sessions | No | Yes |
| Accept unassigned session | Yes | No |
| Assign unassigned session | No | Yes |
| Transfer active session | No | Yes |
| Re-run routing | No | Yes |
| Edit session notes | Yes (own, active) | No |
| Add / edit referrals | Yes (own, active) | No |
| Send chat messages | Yes (own, active) | No |
| Close session + wrap-up | Yes (own, active) | No |
| Submit for review | Yes (own, at close) | No |
| Approve session | No | Yes (closed + logged) |
| Return session (re-opens chat) | No | Yes (closed + logged) |

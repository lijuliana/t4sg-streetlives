# Streetlives / YourPeer Backend API

Base URL: `http://localhost:3000` (configurable via `PORT` env var)

All request and response bodies are JSON. All timestamps are ISO 8601 strings.

---

## Navigator Profiles

Navigator profiles represent navigators who can be assigned to guest sessions.
Each profile maps to a Matrix user on the homeserver.

> **nav_group** is stored for future routing use but does not constrain assignment
> right now. All navigators are treated as cross-trained across all need categories.
> **isGeneralIntake** is what controls initial assignment eligibility.

### POST /api/navigators

Creates a navigator profile from onboarding form data.

**Request body**

| Field            | Type     | Required | Default       | Description                                                   |
|------------------|----------|----------|---------------|---------------------------------------------------------------|
| `userId`         | string   | yes      | —             | Matrix user ID, e.g. `@alice:homeserver.org`                  |
| `navGroup`       | string   | yes      | —             | `"CUNY_PIN"` \| `"HOUSING_WORKS"` \| `"DYCD"` — stored only  |
| `expertiseTags`  | string[] | no       | `[]`          | Free-form domain tags (reserved for future scoring)           |
| `languages`      | string[] | no       | `["en"]`      | ISO 639-1 codes — lowercased automatically                    |
| `capacity`       | number   | no       | `5`           | Max concurrent active sessions                                |
| `status`         | string   | no       | `"available"` | `"available"` \| `"away"` \| `"offline"`                     |
| `isGeneralIntake`| boolean  | no       | `false`       | If `true`, eligible for initial (first-touch) assignment      |

**Response** `201 Created`

```json
{
  "id": "a1b2c3d4-...",
  "userId": "@alice:homeserver.org",
  "navGroup": "HOUSING_WORKS",
  "expertiseTags": ["intake", "housing"],
  "languages": ["en", "es"],
  "capacity": 5,
  "status": "available",
  "isGeneralIntake": true,
  "createdAt": "2026-04-04T12:00:00.000Z",
  "updatedAt": "2026-04-04T12:00:00.000Z"
}
```

**Errors**

| Status | Condition                              |
|--------|----------------------------------------|
| 400    | Missing/invalid fields                 |
| 409    | `userId` already has a profile         |

---

### GET /api/navigators

Returns all navigator profiles as an array.

**Response** `200 OK` — array of profile objects (same shape as above).

---

### GET /api/navigators/:id

Returns a single navigator profile by internal ID.

**Errors** `404` if not found.

---

### PATCH /api/navigators/:id

Partial update — all fields optional. Use this to flip a navigator's status, update
their language list, or toggle `isGeneralIntake`.

**Request body** (all optional)

| Field            | Type     | Description                                    |
|------------------|----------|------------------------------------------------|
| `navGroup`       | string   | `"CUNY_PIN"` \| `"HOUSING_WORKS"` \| `"DYCD"` |
| `expertiseTags`  | string[] | Replaces existing tags (not merged)            |
| `languages`      | string[] | Replaces existing languages                    |
| `capacity`       | number   | Must be >= 1                                   |
| `status`         | string   | `"available"` \| `"away"` \| `"offline"`       |
| `isGeneralIntake`| boolean  | Toggle general-intake eligibility              |

**Response** `200 OK` — updated profile object.

**Errors** `400` invalid value · `404` not found.

---

## Routing

### POST /api/routing/assign

Dry-run routing: returns the best available navigator without creating a session.
Use this to preview assignment before session creation or to test the routing config.

**Request body**

| Field         | Type                     | Required | Description                                              |
|---------------|--------------------------|----------|----------------------------------------------------------|
| `needCategory`| string                   | yes      | See categories below — stored for audit; does not filter |
| `language`    | string                   | no       | ISO 639-1 code — primary routing filter                  |
| `tags`        | string[]                 | no       | Reserved for future scoring; ignored in v2               |
| `mode`        | `"initial"\|"transfer"`  | no       | Default `"initial"`. Controls which pool is eligible.    |

**Need categories:** `housing`, `employment`, `health`, `benefits`, `youth_services`, `education`, `other`

**Mode semantics:**
- `initial` — only `isGeneralIntake = true` navigators are eligible
- `transfer` — all available navigators are eligible

**Response (navigator found)** `200 OK`

```json
{
  "assigned": true,
  "navigator": { "id": "...", "userId": "@alice:homeserver.org", ... },
  "routingReason": {
    "generalIntakeOnly": true,
    "languageRequested": "es",
    "languageMatch": true,
    "loadRatio": 0.2,
    "score": -0.2
  },
  "routingVersion": "v2_language_first_general_intake"
}
```

**Response (no match)** `200 OK`

```json
{
  "assigned": false,
  "reason": "No available general-intake navigator speaks \"fr\"",
  "routingVersion": "v2_language_first_general_intake"
}
```

**Errors** `400` missing/invalid `needCategory`.

---

## Sessions

Sessions are the system of record. Matrix rooms are the transport layer and are
kept in sync with session state (navigator invite/kick on assignment and transfer).

### POST /api/sessions

Creates a new guest session. Automatically:
1. Creates a private Matrix room via the service account.
2. Runs routing (`mode: "initial"`) to find the best available general-intake navigator.
3. If a navigator is found: status = `"active"`, navigator invited to the room.
4. If no navigator matches: status = `"unassigned"`, `routingFailReason` set.
5. Writes `created` and (if assigned) `assigned` audit events.

**Request body** (all optional — backward-compatible with no-body requests)

| Field         | Type     | Description                                               |
|---------------|----------|-----------------------------------------------------------|
| `needCategory`| string   | Stored for audit/analytics; does not constrain routing    |
| `language`    | string   | ISO 639-1 code — primary routing filter                   |
| `tags`        | string[] | Reserved for future use                                   |

**Response** `201 Created`

```json
{
  "sessionId": "uuid",
  "status": "active",
  "createdAt": "2026-04-04T12:00:00.000Z",
  "assignedNavigatorId": "nav-uuid",
  "routingVersion": "v2_language_first_general_intake",
  "routingReason": {
    "generalIntakeOnly": true,
    "languageRequested": "es",
    "languageMatch": true,
    "loadRatio": 0.0,
    "score": 0.0
  },
  "routingFailReason": null
}
```

When no navigator is available:

```json
{
  "sessionId": "uuid",
  "status": "unassigned",
  "createdAt": "2026-04-04T12:00:00.000Z",
  "assignedNavigatorId": null,
  "routingVersion": "v2_language_first_general_intake",
  "routingReason": null,
  "routingFailReason": "No available general-intake navigator speaks \"fr\""
}
```

**Errors** `500` Matrix room creation failed.

---

### GET /api/sessions

Returns all sessions in reverse-chronological order (newest first).

**Response** `200 OK` — array of session objects.

---

### GET /api/sessions/:sessionId

Returns a single session by ID.

**Response** `200 OK`

```json
{
  "sessionId": "uuid",
  "matrixRoomId": "!abc:homeserver.org",
  "status": "active",
  "createdAt": "2026-04-04T12:00:00.000Z",
  "closedAt": null,
  "needCategory": "housing",
  "assignedNavigatorId": "nav-uuid",
  "routingVersion": "v2_language_first_general_intake",
  "routingReason": { ... },
  "routingFailReason": null,
  "referralId": null
}
```

**Errors** `404` session not found.

---

### PATCH /api/sessions/:sessionId/status

Manual status override. Prefer `/close` and `/transfer` for standard lifecycle transitions.

**Request body**

| Field    | Type   | Required | Values                                                          |
|----------|--------|----------|-----------------------------------------------------------------|
| `status` | string | yes      | `"unassigned"` \| `"active"` \| `"closed"` \| `"transferred"`  |

**Response** `200 OK` — `{ "ok": true }`

---

### POST /api/sessions/:sessionId/close

Closes a session. Returns `409` if already closed.

**Request body** (optional)

| Field   | Type   | Description                       |
|---------|--------|-----------------------------------|
| `actor` | string | Who closed it (written to audit)  |

**Response** `200 OK`

```json
{ "ok": true, "closedAt": "2026-04-04T13:00:00.000Z" }
```

**Errors** `404` not found · `409` already closed.

---

### POST /api/sessions/:sessionId/transfer

Transfers a session to a different navigator. Supports:
- **Manual** — provide `targetNavigatorId` to transfer to a specific navigator.
- **Auto** — omit `targetNavigatorId`; routing runs in `"transfer"` mode (any available
  navigator eligible, not just general-intake ones).

On success, the previous navigator is kicked from the Matrix room and the new navigator is
invited, both best-effort. Session status is set to `"active"`.

**Request body**

| Field               | Type     | Description                                                          |
|---------------------|----------|----------------------------------------------------------------------|
| `targetNavigatorId` | string   | Optional. Skip routing, transfer directly to this navigator.         |
| `language`          | string   | Optional. Language override for auto re-routing.                     |
| `needCategory`      | string   | Optional. Category override for auto re-routing (audit only in v2).  |
| `tags`              | string[] | Optional. Tag override for auto re-routing.                          |
| `reason`            | string   | Human-readable reason (also sent as kick reason to Matrix).          |
| `actor`             | string   | Who initiated (written to audit log).                                |

**Response** `200 OK`

```json
{ "ok": true, "assignedNavigatorId": "new-nav-uuid" }
```

**Errors**

| Status | Condition                                                |
|--------|----------------------------------------------------------|
| 400    | `targetNavigatorId` not found or navigator unavailable   |
| 400    | Target is already assigned to this session               |
| 404    | Session not found                                        |
| 409    | Session is closed                                        |
| 422    | No eligible navigator available (auto re-route path)     |

---

### GET /api/sessions/:sessionId/events

Returns the full audit log for a session in chronological order.

**Response** `200 OK`

```json
[
  {
    "id": "uuid",
    "sessionId": "session-uuid",
    "eventType": "created",
    "actor": "system",
    "timestamp": "2026-04-04T12:00:00.000Z",
    "metadata": {
      "needCategory": "housing",
      "language": "es",
      "routingVersion": "v2_language_first_general_intake",
      "routingOutcome": "assigned",
      "navigatorId": "nav-uuid"
    }
  },
  {
    "id": "uuid",
    "sessionId": "session-uuid",
    "eventType": "assigned",
    "actor": "system",
    "timestamp": "2026-04-04T12:00:00.001Z",
    "metadata": {
      "navigatorId": "nav-uuid",
      "navigatorUserId": "@alice:homeserver.org",
      "routingVersion": "v2_language_first_general_intake",
      "routingReason": { ... }
    }
  }
]
```

**Event types:** `created` · `assigned` · `transferred` · `closed`

**Errors** `404` session not found.

---

## Session Messages

### POST /api/sessions/:sessionId/messages

Sends a guest message. Stored locally and mirrored to Matrix best-effort.

**Request body**

| Field  | Type   | Required | Description        |
|--------|--------|----------|--------------------|
| `body` | string | yes      | Non-empty text     |

**Response** `201 Created` — message object.

**Errors** `400` empty body · `404` not found · `409` session closed.

---

### GET /api/sessions/:sessionId/messages

Returns all messages in chronological order. Syncs new messages from Matrix before
responding (throttled to once per 5 seconds per session to avoid hammering the homeserver).

**Response** `200 OK` — `{ "messages": [ ... ] }`

---

## Session Notes

### GET /api/sessions/:sessionId/notes

Returns all notes for the session. Notes are backend-only (not sent to Matrix).

**Response** `200 OK` — array of note objects.

### POST /api/sessions/:sessionId/notes

**Request body**

| Field       | Type   | Required | Description                       |
|-------------|--------|----------|-----------------------------------|
| `body`      | string | yes      | Note text                         |
| `createdBy` | string | no       | Navigator user ID or display name |

**Response** `201 Created` — note object.

---

## Session Referrals

### GET /api/sessions/:sessionId/referrals

**Response** `200 OK` — array of referral objects.

### POST /api/sessions/:sessionId/referrals

**Request body**

| Field         | Type   | Required | Description                       |
|---------------|--------|----------|-----------------------------------|
| `title`       | string | yes      | Referral title / service name     |
| `description` | string | no       | Additional detail                 |
| `createdBy`   | string | no       | Navigator user ID or display name |

**Response** `201 Created` — referral object.

---

## Routing Rules — v2 (`v2_language_first_general_intake`)

The current routing algorithm is intentionally simple and rules-based so policy
changes are easy to review and test. The logic lives entirely in
`src/services/routingService.ts`.

### Initial assignment vs. transfer

| Mode        | Eligible pool                                   |
|-------------|--------------------------------------------------|
| `initial`   | `status = "available"` AND `isGeneralIntake = true` |
| `transfer`  | `status = "available"` (any navigator)          |

The intended product flow:
1. Guest starts a session → routed to a **general-intake** navigator for first touch.
2. The general navigator assesses the guest's needs.
3. If a specialist or second-touch navigator is needed, a **transfer** is initiated
   (which can go to any available navigator, general-intake or not).

### Step 1 — Availability

Navigators with `status = "away"` or `"offline"` are excluded.

### Step 2 — Pool filter

- `initial` mode: further restrict to `isGeneralIntake = true`.
- `transfer` mode: no further restriction.

If no candidates remain, routing returns `unassigned` with an explanation.

### Step 3 — Language filter (hard rejection)

If a `language` is provided:
- Candidates who do not speak that language are removed.
- If no candidates remain, routing returns `unassigned` with a clear reason:
  `"No available [general-intake] navigator speaks "<lang>"`.
- Language values are normalised to lowercase before comparison.

If no language is provided, all remaining candidates are eligible.

### Step 4 — Load-based ranking

Among eligible candidates:

```
loadRatio = activeSessions / capacity
```

Candidates are ranked by ascending `loadRatio` (idle navigators first).
Equal load ratios are broken by navigator `id` ascending for determinism.

### What need_category does (and doesn't do)

`needCategory` is **stored** on the session and included in audit events for analytics
and future routing iterations. It does **not** constrain which navigators are eligible
in v2. All navigators are assumed cross-trained across all need categories.

### Routing reason object

Included in session records and API responses for observability:

```json
{
  "generalIntakeOnly": true,
  "languageRequested": "es",
  "languageMatch": true,
  "loadRatio": 0.25,
  "score": -0.25
}
```

`score` equals `−loadRatio` so higher is better (idle navigator scores 0, fully loaded
navigator scores −1).

### Encryption (out of scope for now)

Matrix rooms are created **unencrypted**. Encryption is explicitly deferred.

Upgrade path when ready:
- Add `m.room.encryption` state event to `createRoom`'s `initial_state` in
  `matrixService.ts`.
- Call `initRustCrypto()` on any Matrix client that needs to read encrypted events.
- The session–room mapping and lifecycle endpoints do not need to change.

---

## How to Test Routing Locally

### Setup

1. Start the backend with seed data:
   ```bash
   cd matrix-chat
   SEED_NAVIGATORS=true npm run dev:backend
   ```
   This loads 6 test navigators: 3 general-intake (English/Spanish/Mandarin) + 3 specialists.

2. Start the frontend:
   ```bash
   npm run dev
   ```
   Open [http://localhost:5173](http://localhost:5173).

---

### Testing from the frontend

#### Create a session with language + need category

1. Go to [http://localhost:5173](http://localhost:5173)
2. Click **Start chat** — a two-field form appears
3. Pick a **language** (English, Spanish, Mandarin, etc.) and a **need category**
4. Click **Connect me with a navigator**

The session is created using the real routing algorithm. The backend will:
- Find the best available general-intake navigator who speaks the chosen language
- Create the Matrix room
- Invite the navigator to the room

If no matching navigator exists (e.g. French), the session is created as `unassigned`.

---

#### Inspect assignment and routing reason

Open the Navigator Dashboard at [http://localhost:5173/navigator](http://localhost:5173/navigator):

- **Sessions tab** → select the session
- **Session info** shows: session ID, Matrix room ID, status, need category
- **Routing section** shows:
  - which navigator was assigned (ID + Matrix userId)
  - routing version
  - routing reason chips: intake-only, language requested, language match, load ratio, score
  - `routingFailReason` if no match was found (shown in red)

---

#### View the navigator pool

Switch to the **Navigators tab** in the dashboard:
- Shows all seeded navigators with status dot (green/amber/grey)
- `INTAKE` badge = eligible for initial assignment
- `SPECIALIST` badge = transfer targets only
- Languages, capacity, active load (count / capacity with %)
- Navigators are sorted: available first, then away, then offline

---

#### Transfer a session to another navigator

1. Select a session in the Sessions tab
2. Scroll to the **Transfer** section
3. Choose a mode:
   - **Pick navigator** — manual: choose from the dropdown of available navigators
   - **Re-run routing** — auto: routing runs in transfer mode (any available navigator)
4. Optionally set a language override or reason
5. Click **Transfer**

After transfer:
- The old navigator is kicked from the Matrix room
- The new navigator is invited
- The session event log updates with a `transferred` event
- The Routing section refreshes with the new assignment

---

#### Close a session

Click **Close session** in the top bar of any active session.
After closing:
- Status badge updates to `CLOSED`
- The close button disappears
- A `closed` event appears in the audit log
- The Transfer section shows "Session is closed"

---

#### Inspect the audit log

Each session has an **Events** section showing all lifecycle events in order:
- `created` — session and Matrix room created
- `assigned` — navigator assignment with routing details
- `transferred` — from/to navigator, manual or auto
- `closed` — who closed it and previous status

Events include full metadata JSON for debugging.

---

### Testing via API (curl / Postman)

```bash
# Preview routing for Spanish guest
curl -s -X POST http://localhost:3000/api/routing/assign \
  -H "Content-Type: application/json" \
  -d '{"needCategory":"housing","language":"es"}' | jq

# Create a session
curl -s -X POST http://localhost:3000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"needCategory":"housing","language":"es"}' | jq

# Create session with unmatched language (returns unassigned + failReason)
curl -s -X POST http://localhost:3000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"needCategory":"health","language":"fr"}' | jq

# Transfer to auto-routed navigator (transfer mode, any available)
SESSION_ID="<your-session-id>"
curl -s -X POST http://localhost:3000/api/sessions/$SESSION_ID/transfer \
  -H "Content-Type: application/json" \
  -d '{"language":"es","reason":"specialist needed"}' | jq

# Transfer to a specific navigator
curl -s -X POST http://localhost:3000/api/sessions/$SESSION_ID/transfer \
  -H "Content-Type: application/json" \
  -d '{"targetNavigatorId":"<nav-id>"}' | jq

# Close a session
curl -s -X POST http://localhost:3000/api/sessions/$SESSION_ID/close \
  -H "Content-Type: application/json" \
  -d '{"actor":"test"}' | jq

# View the audit log
curl -s http://localhost:3000/api/sessions/$SESSION_ID/events | jq
```

---

### Seed navigator pool reference

| Navigator | Group | Languages | Intake | Status |
|---|---|---|---|---|
| `@intake-alice` | HOUSING_WORKS | en, es | Yes | available |
| `@intake-bob` | DYCD | en | Yes | available |
| `@intake-carol` | CUNY_PIN | en, zh | Yes | available |
| `@specialist-diana` | HOUSING_WORKS | en, es | No | available |
| `@specialist-eve` | DYCD | en, zh | No | away |
| `@specialist-frank` | CUNY_PIN | en | No | offline |

- Language `"es"` → matches Alice (intake) or Diana (specialist/transfer)
- Language `"zh"` → matches Carol (intake) or Eve (specialist, but away)
- Language `"fr"` → no match → session created as `unassigned`
- Initial assignment can only reach Alice, Bob, or Carol (intake + available)
- Transfer can reach Alice, Bob, Carol, or Diana (available, regardless of intake flag)

---

### Current limitations

- **Encryption:** Rooms are unencrypted. E2E encryption is out of scope for now.
  See routing rules section above for the documented upgrade path.
- **Authentication:** The Navigator Dashboard at `/navigator` is open — no auth yet.
- **In-memory storage:** All data is lost on backend restart. Swap the stores for
  a database-backed implementation when persistence is needed (see `migrations/`).
- **Navigator Matrix access:** Invite/kick calls to the real Matrix homeserver are
  best-effort. If the navigator userId is not registered on the homeserver, the
  invite will fail silently (session assignment still records correctly in the backend).

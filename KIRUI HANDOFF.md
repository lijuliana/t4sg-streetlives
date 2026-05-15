# StreetLives / YourPeer — Kirui Handoff Documentation

**Role:** AWS Infrastructure, Auth, and Backend Integration    

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [AWS Infrastructure](#2-aws-infrastructure)
3. [Database](#3-database)
4. [Auth0 + RBAC](#4-auth0--rbac)
5. [Backend Lambdas](#5-backend-lambdas)
6. [Next.js API Layer](#6-nextjs-api-layer)
7. [Navigator Onboarding & Profile](#7-navigator-onboarding--profile)
8. [Chat & Transfer Workflow](#8-chat--transfer-workflow)
9. [How to Deploy / Run](#9-how-to-deploy--run)
10. [Possible Bugs & Known Issues](#10-possible-bugs--known-issues)
11. [Next Steps](#11-next-steps)

---

## 1. System Architecture

```
Browser (anonymous user)
  └─ Next.js App (Vercel / local)
       ├─ /api/guest/*         ← no auth, session token-based
       └─ /api/*               ← Auth0 JWT required
            └─ API Gateway (HTTP API)
                 └─ streetlives-vpc Lambda (private subnet, VPC)
                      ├─ RDS PostgreSQL (private subnet)
                      └─ streetlives-matrix Lambda (outside VPC)
                           └─ Matrix Homeserver (external)
```

All browser traffic hits Next.js API routes. These are the only components that hold Auth0 credentials. The Lambda functions never see the browser directly.

---

## 2. AWS Infrastructure

Everything was provisioned in the client's AWS account. All resources are in `us-east-1`.

### VPC & Networking

- Custom VPC with **public and private subnets** across two AZs (for RDS multi-AZ requirement).
- **Public subnet:** EC2 bastion host (for terminal access to the private RDS instance during migrations).
- **Private subnets:** RDS PostgreSQL, `streetlives-vpc` Lambda.
- **VPC Endpoint** (Lambda ↔ Lambda): allows the VPC Lambda to invoke `streetlives-matrix` without going to the public internet. Without this, Lambda-to-Lambda calls from inside a private subnet silently fail.
- **Security groups:** RDS allows inbound 5432 only from the VPC Lambda's SG and the EC2 bastion's SG.

### Lambda Functions

| Function | Location | Purpose |
|---|---|---|
| `streetlives-vpc` | Inside VPC (private subnet) | Main API — reads/writes RDS, invokes Matrix Lambda |
| `streetlives-matrix` | Outside VPC | All Matrix homeserver operations (create room, send, fetch, delete) |

The VPC Lambda cannot reach the public internet since we don't have NAT gateway, so **the Auth0 JWKS is stored as a Lambda environment variable** (`AUTH0_JWKS`) rather than fetched at runtime.

### API Gateway

HTTP API fronts `streetlives-vpc`. All routes are `/{proxy+}`. CORS is handled in the Lambda response headers, not in API Gateway itself.

### EC2 Bastion

A small EC2 instance in the public subnet. Used only for:
- Running `psql` against RDS to apply migrations
- Debugging RDS directly

**If this instance is stopped/terminated, you lose the only direct path into RDS.**

---

## 3. Database

**Engine:** PostgreSQL on RDS (private subnet, SSL required)  
**Source of truth for schema:** [`migration.sql`](migration.sql)

### Tables

#### `navigator_profiles`

Stores one row per navigator. The `auth0_user_id` column is the link between Auth0 identity and the database row.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `auth0_user_id` | VARCHAR UNIQUE | Auth0 `sub` claim |
| `first_name` / `last_name` | VARCHAR | Set during onboarding |
| `nav_group` | VARCHAR | Organization affiliation |
| `capacity` | INT | Max concurrent sessions |
| `status` | VARCHAR | `available`, `away`, `offline` |
| `languages` | TEXT[] | e.g. `{english, spanish}` |
| `expertise_tags` | TEXT[] | Matches `need_category` values |
| `availability_schedule` | JSONB | `{ "Mon": { "start": "09:00", "end": "17:00" }, ... }` |
| `is_general_intake` | BOOLEAN | Whether to include in general routing |

#### `sessions`

One row per chat session. Anonymous users are identified only by `session_user_token` (stored in their browser localStorage), never by a user ID.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `matrix_room_id` | VARCHAR | Matrix room created at session start |
| `session_user_token` | VARCHAR | Random UUID given to the user; required for all guest API calls |
| `navigator_id` | UUID | FK → `navigator_profiles.id`; NULL if unassigned |
| `need_category` | VARCHAR | `housing`, `employment`, `health`, `benefits`, `youth_services`, `education`, `other` |
| `language` | VARCHAR | ISO 639-1 code (e.g. `es`) |
| `status` | VARCHAR | `unassigned`, `active`, `transferred`, `closed` |
| `routing_reason` | JSONB | Algorithm output at time of routing |
| `notes` / `outcome` | — | Filled by navigator at close |
| `submitted_for_review` | BOOLEAN | Navigator marks session ready for supervisor |
| `approved` | BOOLEAN | Supervisor approval |
| `coaching_notes` | TEXT | Supervisor feedback |

#### `session_events`

Immutable audit log. Every state change writes a new row — never updates.

| `event_type` | Triggered by |
|---|---|
| `created` | Session starts |
| `assigned` | Routing algorithm or supervisor assigns navigator |
| `transferred` | Navigator or supervisor transfers session |
| `closed` | Navigator closes session |


### Running Migrations

There is no direct public access to RDS — you must go through the EC2 bastion first.

**Step 1 — SSH into the bastion:**
```bash
ssh -i "/path/to/streetlives-bastion-key.pem" ec2-user@<BASTION_PUBLIC_IP>
```

**Step 2 — Connect to RDS from inside the bastion:**
```bash
psql -h <RDS_ENDPOINT> -U postgres -d streetlives
# Enter the DB password when prompted
# RDS endpoint and DB password will be shared separately
```

**Step 3 — Make schema changes as needed:**
```sql
-- The schema is already live in RDS. Run incremental ALTER TABLE statements for any future changes.
-- Do NOT re-run migration.sql — it will fail on already-existing tables.
```

> `migration.sql` in the repo is for reference only — it documents the full schema as it currently stands.

**What needs to be transferred to the StreetLives team:**
All these will be shared securely.
- `streetlives-bastion-key.pem` 
- DB password
- Bastion public IP — an Elastic IP has been assigned, so the IP is static and will not change on restart.

---

## 4. Auth0 + RBAC

### Current State — Tenant Transfer Required

The Auth0 tenant is **fully configured and working** but is currently owned by the T4SG SWE's personal account. Before go-live, ownership must be transferred to a StreetLives/YourPeer account.

**To transfer tenant ownership:**
1. Have the StreetLives team create (or provide) an Auth0 account under their org email.
2. In the Auth0 dashboard → Tenant Settings → Tenant Members, add that account as an **Admin**.
3. Log in as the new admin and go to Tenant Settings → Danger Zone → Transfer Ownership.
4. The original owner can then be removed or kept as a member.

Everything below is already in place — no recreation needed, just the ownership transfer.

---

### What Is Already Configured

1. **Regular Web Application** — callback and logout URLs are set for the current deployment domain.

2. **Roles** under User Management → Roles:
   - `navigator` → Dashboard link points to `/dashboard/navigator`
   - `supervisor` → Dashboard link points to `/dashboard/supervisor`
   - Logged in but no role assigned → Dashboard link points to `/dashboard/user`
   - **Completely unauthenticated visitors** → No Dashboard link shown; they access the app via the home page and `/chat` directly. This can be changed to show a dashboard link for all visitors if needed.

3. **Post-Login Action** (deployed to the Login flow — do not remove):

```js
exports.onExecutePostLogin = async (event, api) => {
  const roles = event.authorization?.roles ?? [];
  api.idToken.setCustomClaim("https://streetlives.app/roles", roles);
  api.accessToken.setCustomClaim("https://streetlives.app/roles", roles);
};
```

This injects roles into both the ID token (for the Next.js session) and the access token (for the Lambda to read). Removing or disabling this Action will break all role-based routing.

4. **Auth0 API** — already created with audience `https://api.streetlives.app`. This value is set in both the Next.js `.env` (`AUTH0_AUDIENCE`) and the Lambda environment (`AUTH0_AUDIENCE`). Do not change the audience string without updating both.

### How RBAC is Enforced

| Layer | Mechanism |
|---|---|
| Next.js middleware (`src/middleware.ts`) | Reads roles from Auth0 session cookie; returns 403 if role doesn't match route |
| Lambda (`backend/lambda/index.mjs`) | Reads `https://streetlives.app/roles` from the JWT access token; `GET /sessions` returns all for supervisor, own for navigator |

### Key Files

| File | What it does |
|---|---|
| [`src/lib/auth0.ts`](src/lib/auth0.ts) | Auth0 client config; `beforeSessionSaved` hook preserves the roles claim in the session cookie |
| [`src/middleware.ts`](src/middleware.ts) | Route guard for `/dashboard/navigator/*` and `/dashboard/supervisor/*` |
| [`src/app/auth/`](src/app/auth/) | Sign-in and sign-up pages (both redirect to Auth0 hosted login) |
| [`src/components/Navbar.tsx`](src/components/Navbar.tsx) | Shows correct dashboard link based on role |

---

## 5. Backend Lambdas

### `streetlives-vpc` — [`backend/lambda/index.mjs`](backend/lambda/index.mjs)

The main API handler. Lives in the private subnet with access to RDS.

#### Endpoints

**Guest (no auth — validated by `session_user_token`):**

| Method | Path | What it does |
|---|---|---|
| `POST` | `/sessions` | Create session + Matrix room, run routing algorithm, insert to RDS |
| `GET` | `/sessions/:id` | Get session status (token required as query param) |
| `POST` | `/sessions/:id/messages` | User sends a message to Matrix room |
| `GET` | `/sessions/:id/messages` | Poll Matrix room messages |

**Navigator / Supervisor (Auth0 JWT required in `Authorization: Bearer` header):**

| Method | Path | What it does |
|---|---|---|
| `GET` | `/sessions` | List sessions (supervisor = all; navigator = their own) |
| `PATCH` | `/sessions/:id` | Update notes, outcome, submitted_for_review |
| `POST` | `/sessions/:id/close` | Close session, set closed_at |
| `POST` | `/sessions/:id/transfer` | Transfer session to another navigator |
| `POST` | `/sessions/:id/approve` | Supervisor only; save coaching_notes, set approved=true |
| `GET` | `/sessions/:id/events` | Fetch session audit log |
| `POST` | `/sessions/:id/navigator-messages` | Navigator sends a message |
| `GET` | `/navigators` | List all navigator profiles |
| `POST` | `/navigators` | Create a navigator profile |
| `GET` | `/navigators/:id` | Get a single navigator profile |
| `PATCH` | `/navigators/:id` | Update a navigator profile |

#### JWT Validation

The VPC Lambda has **no internet access**, so it cannot fetch Auth0's JWKS endpoint at runtime. The JWKS is already fetched and stored as the `AUTH0_JWKS` Lambda environment variable. The Lambda parses it at cold-start and caches it for the lifetime of the container.

**If Auth0 rotates its signing keys, the Lambda will reject all tokens until `AUTH0_JWKS` is updated.** To refresh it, fetch `https://<AUTH0_DOMAIN>/.well-known/jwks.json`, paste the full JSON into the `AUTH0_JWKS` env var in the Lambda console, and deploy.

#### Routing Algorithm (Lambda side)

When a session is created, `assignNavigator()` runs:

1. Filter to navigators with `status = available` and `capacity > 0`.
2. If a language was requested, filter to navigators who speak it. If none do, return `assigned: false`.
3. Prefer navigators under their capacity limit. If everyone is over capacity, route anyway.
4. Rank remaining candidates by load ratio (`active_sessions / capacity`), break ties randomly.
5. Pick the lowest-ratio navigator.

---

### `streetlives-matrix` — [`backend/matrix-lambda/index.mjs`](backend/matrix-lambda/index.mjs)

Handles all Matrix homeserver calls. Invoked by the VPC Lambda via `InvokeCommand` (not via HTTP).

| Operation | What it does |
|---|---|
| `createRoom` | Creates a private Matrix room for the session; returns `{ roomId }` |
| `sendMessage` | Sends a message to a room on behalf of the bot |
| `fetchMessages` | Fetches up to 200 messages from a room |
| `deleteRoom` | Purges the room via Synapse Admin API; falls back to bot leaving the room |

The Matrix bot token is cached in module-level memory. On `M_UNKNOWN_TOKEN`, it re-authenticates automatically and retries once.

---

## 6. Next.js API Layer

The Next.js API routes act as a proxy between the browser and the Lambda. They handle three concerns:
- Attaching the Auth0 access token (authenticated routes)
- Hiding Lambda credentials from the client
- Providing guest routes that use session tokens instead of auth

### Authenticated Proxy Routes (`src/app/api/`)

These all forward to Lambda with `Authorization: Bearer <Auth0 access token>`.

| File | Forwards to |
|---|---|
| [`api/navigators/me/route.ts`](src/app/api/navigators/me/route.ts) | `GET /navigators` + filter by `auth0_user_id`; `PATCH /navigators/:id` |
| [`api/navigators/route.ts`](src/app/api/navigators/route.ts) | `GET /navigators` |
| [`api/sessions/[sessionId]/route.ts`](src/app/api/sessions/[sessionId]/route.ts) | `GET`, `PATCH /sessions/:id` |
| [`api/sessions/[sessionId]/transfer/route.ts`](src/app/api/sessions/[sessionId]/transfer/route.ts) | `POST /sessions/:id/transfer` |

### Guest API Routes (`src/app/api/guest/`)

No auth. The session token from localStorage is passed as a query param or in the request body. The Lambda validates it against the `session_user_token` column.

| File | Forwards to |
|---|---|
| [`api/guest/sessions/route.ts`](src/app/api/guest/sessions/route.ts) | `POST /sessions` (create) |
| [`api/guest/sessions/[sessionId]/route.ts`](src/app/api/guest/sessions/[sessionId]/route.ts) | `GET /sessions/:id` |
| [`api/guest/sessions/[sessionId]/messages/route.ts`](src/app/api/guest/sessions/[sessionId]/messages/route.ts) | `GET` / `POST /sessions/:id/messages` |
| [`api/guest/sessions/[sessionId]/request-transfer/route.ts`](src/app/api/guest/sessions/[sessionId]/request-transfer/route.ts) | Records transfer request in-process |
| [`api/guest/navigators/[id]/route.ts`](src/app/api/guest/navigators/[id]/route.ts) | `GET /navigators/:id` (returns navigator name only) |

### Client-Side Routing Mirror

[`src/lib/routing.ts`](src/lib/routing.ts) is a TypeScript port of the Lambda routing logic. It is used by the guest `POST /sessions` API route to run routing before calling the Lambda, and by the Matrix chat integration for scheduling decisions. Keep it in sync with the Lambda's `assignNavigator()` function — they can drift.

---

## 7. Navigator Onboarding & Profile

**Entry point:** `/dashboard/navigator/profile`  
**Key files:** [`src/components/NavigatorProfileForm.tsx`](src/components/NavigatorProfileForm.tsx), [`src/app/dashboard/navigator/profile/page.tsx`](src/app/dashboard/navigator/profile/page.tsx), [`src/app/api/navigators/me/route.ts`](src/app/api/navigators/me/route.ts)

### Flow

1. Navigator logs in with Auth0 (must have `navigator` role assigned).
2. Middleware lets them through to `/dashboard/navigator`.
3. Dashboard server component fetches `/api/navigators` and looks for a row matching their `auth0_user_id`.
4. If no row exists → redirect to `/dashboard/navigator/profile`.
5. Navigator fills in: first name, last name, nav group, capacity, languages (with free-text "other" option), expertise tags, and a **per-day availability schedule** (each selected day gets its own start/end time).
6. On save: `PUT /api/navigators/me` → finds the row in RDS by `auth0_user_id` and PATCHes it, or POSTs to create if it doesn't exist yet.
7. After a complete profile is saved, the navigator is redirected to their dashboard.

### Profile Completeness Gate

The navigator dashboard redirects to profile setup if `myProfile` is null. There is no additional `isProfileComplete()` check — the redirect fires whenever the DB has no row for the logged-in `auth0_user_id`. If a navigator has a partial row (e.g. missing `availability_schedule`), they will pass through to the dashboard even with an incomplete profile. You may want to add a completeness check here.

---

## 8. Chat & Transfer Workflow

### User Side (anonymous)

- User visits `/chat`, picks a need category and optionally a language.
- `POST /api/guest/sessions` creates a session in RDS and a Matrix room. The Lambda runs routing and assigns a navigator (or leaves it unassigned if none are available).
- The browser receives `{ sessionId, sessionUserToken, status }` and stores them in `localStorage`.
- The chat page polls `GET /api/guest/sessions/:id/messages` every few seconds.
- When the user sends a message: `POST /api/guest/sessions/:id/messages` → Lambda → Matrix.
- When the navigator closes the session: the next poll returns `status: closed`, the browser clears the active session from localStorage and writes it to `sl_past_sessions`.

### Navigator Side (authenticated)

- Navigator dashboard (`/dashboard/navigator`) lists sessions with status Active / Unassigned / Closed.
- Session detail page (`/dashboard/navigator/[sessionId]`) fetches real session data, events, and navigators from the Lambda.
- Chat panel: navigator messages go via `POST /sessions/:id/navigator-messages` (Lambda → Matrix).
- To close: navigator fills out outcome and notes → `PATCH /sessions/:id` + `POST /sessions/:id/close` → session goes to "Needs Review" on the supervisor dashboard.

### Supervisor Side (authenticated)

- Supervisor dashboard (`/dashboard/supervisor`) shows Needs Review / Active / Approved / Transfer Requested / Unassigned sections.
- Session detail: read-only chat transcript, coaching notes field, Approve or Return actions.
- **Return:** supervisor fills coaching notes (required) and selects a navigator to re-assign to. The session goes back to the navigator with an amber coaching notes banner visible on their detail page.
- **Transfer:** available navigators only (filtered by `status = available`). After a successful transfer, the in-process `transferRequestStore` flag for that session is cleared.

### Transfer State Store

[`src/lib/transferRequestStore.ts`](src/lib/transferRequestStore.ts) is an **in-process, in-memory** store (`globalThis`) that tracks which sessions have a pending transfer request from the user side. It exists because Lambda has no persistent websocket — the user's "request transfer" is a signal that the navigator sees as a UI badge, not a DB state.

**This state is lost on server restart and not shared across multiple Next.js instances.** It is purely cosmetic (the navigator sees a badge), not functionally blocking.

---

## 9. How to Deploy / Run

### Local Development

```bash
npm install
npm run dev        # Next.js on http://localhost:3000
```

### Environment Variables (`.env.local`)

These are already configured for the current deployment. They will be shared securely as they are not committed to the repo.

```env
# Auth0 — Next.js app
AUTH0_DOMAIN=
AUTH0_CLIENT_ID=
AUTH0_CLIENT_SECRET=
AUTH0_SECRET=           # 32-byte hex string — generate with: openssl rand -hex 32
AUTH0_AUDIENCE=         # must match AUTH0_AUDIENCE in the Lambda env vars
APP_BASE_URL=           # e.g. http://localhost:3000 for local, or your Vercel URL for prod

# API Gateway URL → VPC Lambda
NEXT_PUBLIC_API_URL=    # your API Gateway invoke URL
```

### Lambda Environment Variables

All Lambda env vars are already set in the AWS console. They will be shared directly with the StreetLives team.

**`streetlives-vpc` — required keys:**

```env
DB_HOST=
DB_NAME=
DB_USER=
DB_PASSWORD=
DB_PORT=
AUTH0_DOMAIN=
AUTH0_AUDIENCE=
AUTH0_JWKS=       # full JWKS JSON — see JWT Validation section above for how to refresh
MATRIX_LAMBDA_NAME=streetlives-matrix
```

> `AWS_REGION` is set automatically by the Lambda runtime — no need to configure it.

**`streetlives-matrix` — required keys:**

```env
MATRIX_BASE_URL=
MATRIX_BOT_USER_ID=
MATRIX_BOT_PASSWORD=
```

### Deploying Lambda

Each Lambda is deployed as a `.zip` from its directory:

```bash
# VPC Lambda
cd backend/lambda
zip -r function.zip .

# Matrix Lambda
cd backend/matrix-lambda
zip -r function.zip .
```

---

## 10. Possible Bugs & Known Issues

### JWKS Rotation Breaks JWT Validation
**Impact: High.** Auth0 rotates signing keys periodically. The JWKS is baked into the Lambda as `AUTH0_JWKS`. If it rotates, every authenticated Lambda call returns 401 until the env var is updated.  
**Fix:** Fetch the JWKS from Auth0, update the `AUTH0_JWKS` env var in the Lambda console, and re-deploy (or just update env and force a cold start).

### Navigator Status Not Auto-Updated
**Impact: Medium.** A navigator's `status` in `navigator_profiles` is only updated when they explicitly set it (via profile form). If a navigator goes offline without updating their status, the routing algorithm may still route sessions to them, which then get no response.  
**Fix:** Add a heartbeat mechanism or auto-set status to `offline` on Auth0 logout / session expiry.

### `transferRequestStore` Not Shared Across Instances
**Impact: Low.** The `globalThis.__slTransferRequested` store is in-process memory. On Vercel (serverless), each request can hit a different function instance. A "Transfer Requested" badge on the navigator side may not appear.  
**Fix:** Persist this flag to RDS as a column on `sessions` (e.g. `user_requested_transfer BOOLEAN`).

### Profile Completeness Gate Is Incomplete
**Impact: Low.** The dashboard redirects to profile setup only when no DB row exists. A navigator who has a row but is missing `availability_schedule` or `languages` will pass through and appear to the routing algorithm as ineligible (filtered out silently). They'll never get assigned sessions and won't know why.  
**Fix:** Add an `isProfileComplete()` check in the dashboard server component and redirect to profile if incomplete.

### Routing Algorithm Duplication (Lambda vs. Client)
**Impact: Low.** `backend/lambda/index.mjs` (`assignNavigator`) and `src/lib/routing.ts` (`pickNavigator`) implement the same logic independently. They can drift.  
**Fix:** Consolidate — either call the Lambda for routing decisions or move both to a shared module.

### EC2 Bastion as Single Point of DB Access
**Impact: Operational.** If the bastion EC2 instance is stopped, there is no way to run migrations or debug the database.  
**Mitigation:** Keep the bastion's instance ID and key pair documented. Alternatively, set up AWS Systems Manager Session Manager as a keyless alternative.

---

## 11. Next Steps

### Recommended Enhancements
- **Navigator status management:** Auto-set to `offline` on logout or session expiry; add a manual status toggle to the navigator dashboard
- **Referrals to RDS:** Currently referral data is not persisted to the database; it lives only in the frontend session. Add a `referrals` table if the client needs reporting
- **JWKS auto-refresh:** Schedule a Lambda layer or cron that fetches the JWKS periodically and updates the env var, or use a NAT gateway to allow the Lambda to fetch it at runtime
- **Monitoring:** Set up CloudWatch alarms on Lambda error rate and RDS CPU; there is currently no alerting


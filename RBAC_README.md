# RBAC Implementation — StreetLives

## Overview

Role-Based Access Control (RBAC) is implemented using Auth0 as the identity provider and Next.js middleware for route enforcement. Roles are attached to users in Auth0 and passed through the session as a custom claim.

---

## Roles

| Role | Dashboard URL | Access |
|---|---|---|
| `user` | `/dashboard/user` | Open — no auth required |
| `navigator` | `/dashboard/navigator` | Auth required + `navigator` role |
| `supervisor` | `/dashboard/supervisor` | Auth required + `supervisor` role |

---

## How It Works

### 1. Auth0 Role Claim (`src/lib/auth0.ts`)

Roles are stored in Auth0 and surfaced via a custom namespace claim:

```
https://streetlives.app/roles
```

The `beforeSessionSaved` hook reads this claim from the Auth0 token and persists it into the Next.js session, making it available to both server components and middleware without an extra API call.

After login, all users are redirected to the home page (`/`) regardless of role. Role-based navigation is handled from there.

### 2. Middleware Route Enforcement (`src/middleware.ts`)

The following routes are protected:

- `/dashboard/navigator` — requires `navigator` role
- `/dashboard/supervisor` — requires `supervisor` role

**Enforcement logic:**
- Unauthenticated users hitting a protected route are redirected to `/auth/login` with a `returnTo` parameter so they land on the correct page after signing in.
- Authenticated users without the required role receive a `403 Forbidden` response.
- `/chat` and `/dashboard/user` are explicitly left public — no auth required.

### 3. Post-Login Redirect (`src/lib/auth0.ts`)

All users land on `/` after login. The home page and navbar detect the user's role from the session and display the appropriate dashboard link.

### 4. Navbar (`src/components/Navbar.tsx`)

| State | Shown |
|---|---|
| Not logged in | Dashboard (user), Sign In, Sign Up |
| Logged in as user | Dashboard → `/dashboard/user`, Log out |
| Logged in as navigator | Dashboard → `/dashboard/navigator`, Log out |
| Logged in as supervisor | Dashboard → `/dashboard/supervisor`, Log out |



### 5. Home Page Hero (`src/app/page.tsx`)

When a navigator or supervisor is logged in, the hero button changes from "Get started below" to a direct link to their dashboard. Regular users see "Go to My Dashboard".

---

## What Was Removed and Why

The `RoleSwitcher` component (previously rendered globally in `layout.tsx`) allowed anyone — including unauthenticated users — to switch between User, Navigator, and Supervisor views via a footer bar. This completely bypassed RBAC.

---

## Assigning Roles in Auth0

Roles must be assigned to users in the Auth0 dashboard under **User Management → Users → Roles**. The role names must match exactly:

- `navigator`
- `supervisor`

Users with no assigned role are treated as regular users and routed to `/dashboard/user`.

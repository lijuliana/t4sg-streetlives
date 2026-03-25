# StreetLives — Auth0 Authentication

## What Was Done

Added Auth0-based authentication and role-based access control using `@auth0/nextjs-auth0` v4.

Three roles are supported: `navigator` → `/navigator/dashboard`, `supervisor` → `/supervisor/dashboard`, all others → `/chat`.

## How It Works

1. **Auth0 Action** — A post-login Action (`Add Roles to Token`) reads the user's assigned roles from `event.authorization.roles` and injects them into the ID token under the custom claim `https://streetlives.app/roles`.

2. **`src/lib/auth0.ts`** — Configures the Auth0 client with two hooks:
   - `beforeSessionSaved`: explicitly preserves the roles claim in the session cookie (the SDK strips non-standard claims by default).
   - `onCallback`: reads roles from the session and redirects to the appropriate dashboard.

3. **`src/middleware.ts`** — Runs on every request to `/navigator/*` and `/supervisor/*`. Reads roles from the session cookie and returns 403 if the role doesn't match.

4. **`src/app/auth/`** — Sign-in and sign-up pages both redirect to `/auth/login` (Auth0's hosted login page).

5. **`src/components/Navbar.tsx`** — Shows Sign In / Sign Up when logged out, Log Out when logged in.

## Setup

1. Create a Regular Web Application in Auth0. Set callback URL to `http://localhost:3000/auth/callback` and logout URL to `http://localhost:3000`.

2. Create roles `navigator` and `supervisor` under User Management → Roles and assign them to users.

3. Create a post-login Action with this code and add it to the Login flow:

```js
exports.onExecutePostLogin = async (event, api) => {
  const roles = event.authorization?.roles ?? [];
  api.idToken.setCustomClaim("https://streetlives.app/roles", roles);
  api.accessToken.setCustomClaim("https://streetlives.app/roles", roles);
};
```

4. Add to `.env.local`:

```env
AUTH0_DOMAIN='your-tenant.us.auth0.com'
AUTH0_CLIENT_ID='your-client-id'
AUTH0_CLIENT_SECRET='your-client-secret'
AUTH0_SECRET='your-32-byte-hex-secret'   # openssl rand -hex 32
APP_BASE_URL='http://localhost:3000'
```

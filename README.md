# nuxt-contact-hub

A small **lead-management app for Nuxt 4** that extends the
[nuxt-contact-form](https://github.com/CrescenzoSorrentino/nuxt-contact-form)
component: every submission is **saved to a database**, and a
**password-protected admin area** lists the collected leads.

Where `nuxt-contact-form` is a reusable component you drop into any project,
`nuxt-contact-hub` is a complete example app showing one way to build on top of
it: form → persistence (Supabase) → protected admin.

## Features

- **Contact form** — reuses the `nuxt-contact-form` component (client + server
  validation, honeypot, rate limiting, accessible UI).
- **Persistence** — each submission is stored in a Supabase (Postgres) `leads`
  table, with an auto-generated `id` and `created_at` timestamp.
- **Protected admin area** at `/admin` — single-password login, lists every
  lead (most recent first), with a one-click `mailto:` reply.
- **Optional email** — if Resend is configured the endpoint also emails you the
  message; if not, it simply saves the lead and skips email.
- **Secrets via environment variables** — nothing sensitive is committed.

## Tech stack

Nuxt 4 · Vue 3 `<script setup>` · TypeScript · Supabase (Postgres) ·
[nuxt-auth-utils](https://github.com/atinux/nuxt-auth-utils) · Resend · Upstash Redis.

## How it works

```
Public flow (anyone)
  app/pages/index.vue              Renders the contact form.
  app/components/ContactForm.vue   The form (UI + UX + validation).
  shared/contact-form.ts           Validation rules, shared client/server.
  server/api/contact.post.ts       Validate -> save to DB -> (optional) email.
  server/utils/supabase.ts         The single Supabase connection helper.

Admin flow (protected)
  app/pages/admin.vue              Login form + leads list + logout.
  server/api/admin/login.post.ts   Checks the admin password, opens a session.
  server/api/leads.get.ts          requireUserSession -> read leads from DB.
```

## Installation

This is a standalone app: **clone it and run it.**

1. **Clone and install dependencies:**

   ```bash
   git clone https://github.com/CrescenzoSorrentino/nuxt-contact-hub.git
   cd nuxt-contact-hub
   npm install
   ```

2. **Create a Supabase project** at [supabase.com](https://supabase.com), then
   open the **SQL Editor** and run:

   ```sql
   create table public.leads (
     id bigint generated always as identity primary key,
     created_at timestamptz not null default now(),
     name text not null,
     email text not null,
     message text not null
   );

   alter table public.leads enable row level security;
   ```

   Row Level Security is enabled with no policies: the table is reachable only
   with the `service_role` key (used server-side), never from the browser.

3. **Create your `.env`** (copy the template) and fill in the values:

   ```bash
   cp .env.example .env
   ```

   See [Environment variables](#environment-variables) below.

4. **Run the dev server:**

   ```bash
   npm run dev
   ```

   - `http://localhost:3000/` — the contact form.
   - `http://localhost:3000/admin` — the admin area (log in with your
     `NUXT_ADMIN_PASSWORD`).

## Environment variables

Set these in `.env` (local) or your hosting provider (production). The `NUXT_`
prefix lets Nuxt map them onto `runtimeConfig` automatically.

| Variable                         | Required | Description                                                        |
| -------------------------------- | -------- | ------------------------------------------------------------------ |
| `NUXT_SUPABASE_URL`              | Yes      | Supabase project URL.                                              |
| `NUXT_SUPABASE_SERVICE_ROLE_KEY` | Yes      | Supabase `service_role` key. **Secret, server-only.**             |
| `NUXT_SESSION_PASSWORD`          | Yes      | Secret used to seal the admin session cookie (min 32 characters).  |
| `NUXT_ADMIN_PASSWORD`            | Yes      | Password to log into `/admin`.                                     |
| `NUXT_RESEND_API_KEY`            | No       | Resend API key. If empty, submissions are saved but no email sent. |
| `NUXT_CONTACT_RECIPIENT_EMAIL`   | No       | Address that receives the messages (your inbox).                   |
| `NUXT_CONTACT_FROM_EMAIL`        | No       | Sender address (e.g. `onboarding@resend.dev` for tests).           |
| `NUXT_UPSTASH_REDIS_REST_URL`    | No       | Upstash Redis REST URL (rate limiting).                            |
| `NUXT_UPSTASH_REDIS_REST_TOKEN`  | No       | Upstash Redis REST token (rate limiting).                          |
| `NUXT_CONTACT_SEND_CONFIRMATION` | No       | Set to `true` to also email a confirmation to the visitor.         |

Generate a session password with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> **Email is optional.** When `NUXT_RESEND_API_KEY` is empty, the contact
> endpoint saves the lead to the database and returns successfully without
> sending any email.

> **Rate limiting is optional and fails open.** If the Upstash variables are
> missing or unreachable, submissions still go through.

## Notes

- On Node.js 20, `supabase-js` needs a WebSocket polyfill (provided via the
  `ws` package in `server/utils/supabase.ts`). Node.js 22+ does not need it.

## License

MIT

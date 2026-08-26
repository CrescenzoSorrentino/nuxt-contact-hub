# nuxt-contact-hub

A **lead-management layer for Nuxt 4** that extends the
[nuxt-contact-form](https://github.com/CrescenzoSorrentino/nuxt-contact-form)
component: every submission is **saved to a database**, and a
**password-protected admin area** lists the leads and lets you mark them as
handled.

Like `nuxt-contact-form`, it is meant to be **copied into your own Nuxt app**:
copy a few files, install the dependencies, set your environment variables, and
you get a working form + persistence + admin. This repository is also runnable
on its own as a demo.

## Features

- **Contact form** — reuses the `nuxt-contact-form` component (client + server
  validation, honeypot, rate limiting, accessible UI).
- **Persistence** — each submission is stored in a Supabase (Postgres) `leads`
  table, with an auto-generated `id` and `created_at` timestamp.
- **Protected admin area** at `/admin` — single-password login, lists every
  lead (most recent first), with a one-click `mailto:` reply.
- **Mark as handled** — toggle each lead's `handled` state from the admin.
- **New / Archived tabs, with category and priority filters** — the admin list
  shows unhandled leads by default; a tab switches to the handled ones, and two
  dropdowns narrow either view further by category and priority.
- **AI-powered triage (optional)** — if an Anthropic API key is configured,
  every new lead is automatically classified (`commercial` / `support` /
  `spam` / `collaboration` / `other`, plus a `low`/`medium`/`high` priority)
  using Claude, and the notification email is skipped for messages classified
  as spam. Only the message text is sent to the API — never the name or
  email. Off by default; see [Privacy note](#environment-variables) below.
- **Optional email** — if Resend is configured the endpoint also emails you the
  message; if not, it simply saves the lead and skips email.
- **Secrets via environment variables** — nothing sensitive is committed.

## Tech stack

Nuxt 4 · Vue 3 `<script setup>` · TypeScript · Supabase (Postgres) ·
[nuxt-auth-utils](https://github.com/atinux/nuxt-auth-utils) ·
[@nuxt/icon](https://github.com/nuxt/icon) · Resend · Upstash Redis ·
[Anthropic API](https://docs.anthropic.com) · [Zod](https://zod.dev).

## How it works

```
Public flow (anyone)
  app/components/ContactForm.vue     The form (UI + UX + validation).
  shared/contact-form.ts             Validation rules, shared client/server.
  server/api/contact.post.ts         Validate -> triage (optional) -> save to DB -> email (optional, skipped for spam).
  server/utils/supabase.ts           The single Supabase connection helper.
  server/utils/anthropic.ts          Optional Anthropic client (null if no API key configured).
  server/utils/triage.ts             Classifies a lead's message into category + priority.

Admin flow (protected)
  app/pages/admin.vue                Login, filterable leads list, mark-as-handled, logout.
  server/api/admin/login.post.ts     Checks the admin password, opens a session.
  server/api/leads.get.ts            requireUserSession -> read the leads.
  server/api/leads/[id].patch.ts     requireUserSession -> update a lead's handled flag.
```

## Installation

Copy this into your own Nuxt 4 app (it is not a published npm package).

1. **Copy the files**, keeping the same paths:

   - `shared/contact-form.ts`
   - `app/components/ContactForm.vue`
   - `app/pages/admin.vue`
   - `server/utils/supabase.ts`
   - `server/utils/anthropic.ts`
   - `server/utils/triage.ts`
   - `server/api/contact.post.ts`
   - `server/api/leads.get.ts`
   - `server/api/leads/[id].patch.ts`
   - `server/api/admin/login.post.ts`

2. **Install the dependencies:**

   ```bash
   npm install @supabase/supabase-js nuxt-auth-utils @nuxt/icon resend @upstash/ratelimit @upstash/redis ws @anthropic-ai/sdk zod
   npm install -D @iconify-json/lucide @types/ws
   ```

3. **Enable the modules** in `nuxt.config.ts`:

   ```ts
   export default defineNuxtConfig({
     modules: ["nuxt-auth-utils", "@nuxt/icon"],
   });
   ```

4. **Add the runtime config** in `nuxt.config.ts` (values are filled from the
   matching `NUXT_*` environment variables):

   ```ts
   runtimeConfig: {
     supabaseUrl: "",
     supabaseServiceRoleKey: "",
     adminPassword: "",
     resendApiKey: "",
     contactRecipientEmail: "",
     contactFromEmail: "",
     upstashRedisRestUrl: "",
     upstashRedisRestToken: "",
     contactSendConfirmation: false,
     anthropicApiKey: "",
   },
   ```

5. **Create the Supabase table.** In your Supabase project, open the **SQL
   Editor** and run:

   ```sql
   create table public.leads (
     id bigint generated always as identity primary key,
     created_at timestamptz not null default now(),
     name text not null,
     email text not null,
     message text not null,
     handled boolean not null default false,
     category text,
     priority text,
     constraint leads_category_check
       check (category is null or category in ('commercial', 'support', 'spam', 'collaboration', 'other')),
     constraint leads_priority_check
       check (priority is null or priority in ('low', 'medium', 'high'))
   );

   alter table public.leads enable row level security;
   ```

   `category`/`priority` are nullable: they stay empty until the optional AI
   triage feature is configured (see below), and empty forever if you don't
   use it. If you already created the table before adding this feature, run
   instead:

   ```sql
   alter table public.leads
     add column category text,
     add column priority text,
     add constraint leads_category_check
       check (category is null or category in ('commercial', 'support', 'spam', 'collaboration', 'other')),
     add constraint leads_priority_check
       check (priority is null or priority in ('low', 'medium', 'high'));
   ```

   Row Level Security is enabled with no policies: the table is reachable only
   with the `service_role` key (used server-side), never from the browser.

6. **Set the environment variables** (see below). Copy `.env.example` to `.env`
   and fill in your values.

7. **Render the form** wherever you want it:

   ```vue
   <template>
     <ContactForm />
   </template>
   ```

   The admin area is served at `/admin` by `app/pages/admin.vue`.

### Run this repository as a demo

```bash
git clone https://github.com/CrescenzoSorrentino/nuxt-contact-hub.git
cd nuxt-contact-hub
npm install
cp .env.example .env   # then fill in the values
npm run dev
```

- `http://localhost:3000/` — the contact form (demo page).
- `http://localhost:3000/admin` — the admin area (log in with `NUXT_ADMIN_PASSWORD`).

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
| `NUXT_ANTHROPIC_API_KEY`         | No       | Anthropic API key. If empty, AI triage is skipped (`category`/`priority` stay `null`). |

Generate a session password with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> **Email is optional.** When `NUXT_RESEND_API_KEY` is empty, the contact
> endpoint saves the lead to the database and returns successfully without
> sending any email.

> **Rate limiting is optional and fails open.** If the Upstash variables are
> missing or unreachable, submissions still go through.

> **AI triage is optional and privacy-conscious.** When `NUXT_ANTHROPIC_API_KEY`
> is empty, no request is ever made to Anthropic. When configured, only the
> `message` field of the lead is sent for classification — never the name or
> email. Sending a message's content to a third-party API is a data
> processing activity: if you enable this on a site with real visitors,
> update its privacy policy to disclose it, and use your own Anthropic API
> key per deployment/client rather than sharing one across projects.

## Notes

- On Node.js 20, `supabase-js` needs a WebSocket polyfill (provided via the
  `ws` package in `server/utils/supabase.ts`). Node.js 22+ does not need it.
- `@anthropic-ai/sdk` prints an `EBADENGINE` warning on Node.js 20 (it
  officially wants Node 22.11+/24.11+/26+) but has run correctly in testing
  on Node 20 regardless.

## License

MIT

# ProductHub

B2B SaaS **product-management platform**: one shared backlog (customer requests → developer board → PM backlog / roadmap / sprints → releases) surfaced through five role-based UIs — **Customer, Developer, PM, Manager, Stakeholder** — plus Asana/Slack integrations, an AI research & prioritization layer, and an embedded product-analytics module ("Lens", on PostHog).

Recreated from the **FlowDesk** design package ("Pilot" visual direction, 58 desktop screens).

## Stack
- **Frontend:** Vite + React 18 + TypeScript (strict) + Tailwind CSS v3 + React Router v6 + TanStack Query + Recharts
- **Backend:** Supabase (Postgres + RLS, Auth, Storage, Realtime, Edge Functions)
- **Analytics:** PostHog Cloud (Lens module)
- **AI:** Anthropic Claude API (server-side only)
- Icons: Material Symbols Rounded · Fonts: Hanken Grotesk / Geist Mono / Source Serif 4

## Getting started
```bash
npm install
cp .env.example .env      # fill in Supabase (and later PostHog) keys
npm run dev               # http://localhost:5173
```
Without Supabase keys the app runs in **mock mode**: a floating role-switcher (bottom-right) lets you walk every role's surface against seed data.

## Architecture (multi-vendor SaaS)
```
org ─┬─ workspace ─┬─ profiles (role: customer|developer|pm|manager|stakeholder)
     │             ├─ requests ──► backlog_items ──► sprints / releases
     │             └─ roadmap_items, notifications, invites
```
Every table has `workspace_id` and RLS policies scoping rows to the caller's workspace + role. See `supabase/migrations/0001_init.sql`.

## Milestones
| # | Scope | Status |
|---|---|---|
| **M0** | Foundations: scaffold, design system, app shell, role routing, auth (email/pw + Google), base schema + RLS | ✅ in progress |
| **M1** | Customer support flow (screens 1–8) | ⬜ |
| **M2** | Developer workspace (screens 9–14, 41) | ⬜ |
| **M3** | PM core (screens 15–25, 57) | ⬜ |
| M4 | Prioritization suite (50–56) · M5 Manager (29–33) · M6 Analytics/Lens (26–28,34) · M7 Research (44–49) · M8 Integrations (35–43) · M9 Marketing + hardening | ⬜ |

**v1 target:** M0–M3 (the request → dev → PM spine).

## Access model
Invite-only (admins issue workspace invites) with an email-verification step. No open self-serve signup in v1.

## Project layout
```
src/
  app/          router + per-role nav config
  components/   layout (Sidebar, TopNav, AppShell) + ui primitives + charts
  features/     auth (provider, guards) and other cross-screen features
  screens/      one file per screen, grouped by role
  lib/          supabase client, query client
  types/        domain + generated database types
supabase/migrations/   SQL schema + RLS
```

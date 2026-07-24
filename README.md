# Teaching Schedule Manager

Class scheduling and tuition-tracking app for an English language centre — built on the **T3 stack** (Next.js, tRPC, Prisma, NextAuth, Tailwind).

A single-teacher tool to plan monthly lessons, assign students to sessions, take attendance, compute revenue from real attendance, and export schedules as PNG/Excel to send to parents. End-to-end type-safe from the database to the UI.

![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=nextdotjs)
![tRPC](https://img.shields.io/badge/tRPC-v11-2596BE?logo=trpc&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/Neon-PostgreSQL-336791?logo=postgresql&logoColor=white)
![Tests](https://img.shields.io/badge/tests-Vitest%20%2B%20Playwright-6E9F18?logo=vitest&logoColor=white)

---

## Screenshots

> _Add images to `docs/screenshots/` and reference them here — the monthly calendar and dashboard make the strongest first impression._

<!--
![Monthly calendar](docs/screenshots/calendar.png)
![Dashboard](docs/screenshots/dashboard.png)
-->

---

## Features

- **Student management** — grades 1–9, parent phone, per-session tuition rate.
- **Monthly calendar** — create teaching sessions (date + start/end time) on a 7-column week grid; bulk-create and makeup/cancelled-session handling.
- **Session assignment** — pick which students attend each session.
- **Attendance** — mark present / absent / late per student per session.
- **Attendance-based revenue** — present & late count toward tuition, absent does not; monthly totals per student, per grade, and per month.
- **Payment tracking** — mark monthly tuition as paid and follow outstanding balances.
- **Filtering** — by grade (1–9) or student name to view a single student's schedule.
- **Export** — schedules to PNG (to send parents) and Excel.
- **Auth** — credential login with bcrypt hashing, per-username and per-IP rate limiting, and login audit logging.
- **i18n & theming** — Vietnamese / English, light / dark mode.

## Tech stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 14 (App Router) — fullstack |
| Language | TypeScript (strict) |
| API | tRPC v11 — type-safe, no hand-written REST |
| ORM / DB | Prisma + Neon serverless PostgreSQL |
| Auth | NextAuth.js v5 — Credentials provider, JWT sessions |
| UI | shadcn/ui + Radix UI, TailwindCSS |
| Data fetching | TanStack Query (via tRPC) |
| Forms / validation | React Hook Form + Zod |
| Export | html2canvas (PNG), ExcelJS (Excel) |
| Testing | Vitest (unit + integration), Playwright (E2E) |
| Deploy | Vercel |

## Running locally

### Prerequisites

- Node.js **20.x**
- [pnpm](https://pnpm.io/) (`corepack enable` then `corepack prepare pnpm@latest --activate`)
- A PostgreSQL database — a free [Neon](https://neon.tech) project works well

### 1. Install

```bash
git clone https://github.com/hienngo1712/teaching-schedule.git
cd teaching-schedule
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Then fill in `.env`:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Pooled connection string (used by the app at runtime) |
| `DIRECT_URL` | Direct connection string (used by Prisma migrations) |
| `NEXTAUTH_SECRET` | Random 32-byte secret — generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `http://localhost:3000` in development |

### 3. Set up the database

```bash
pnpm prisma migrate deploy   # apply migrations
pnpm db:seed                 # optional: seed sample data
```

### 4. Create a login account

Register through the app at `/register` (rate-limited per IP), or create a user from the CLI:

```bash
pnpm user:create
```

### 5. Start the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Testing

Integration tests hit a **real database**, so they require a `.env.test` pointing at a **separate** branch/database from production — the suite refuses to run if the test endpoint matches the production endpoint.

```bash
cp .env.test.example .env.test   # then point DATABASE_URL at a dedicated test DB
pnpm test                        # unit + integration
pnpm test:unit                   # unit only
pnpm test:integration            # integration only
```

## Project structure

```
src/
├── app/                # Next.js App Router (calendar, students, reports, tuition, dashboard)
├── server/
│   ├── trpc/routers/   # auth, student, session, attendance, tuition, report, subject
│   └── services/       # business logic
├── lib/                # Zod schemas, shared types, tRPC client, utils
├── components/         # UI (calendar, sessions, students, tuition, reports)
└── language/           # vi.json / en.json
prisma/                 # schema, migrations, seed
tests/                  # unit, integration, e2e
docs/                   # architecture & feature notes
```

## License

Personal project — no license granted for reuse.
```

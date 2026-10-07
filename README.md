# VJC OPS Portal — Quality Audit & Case Filing Operations

This is the **Quality Audit** and **Case Filing Ops** module built to match your
flow diagram (Counselor → Quality Audit → Ops → Case Officer → 9-stage Kanban →
Visa Outcome), styled to match your existing VJC Invoice login page (same blue
gradient / orange accents / navy sidebar).

It's a complete, runnable full-stack app:
- **Backend:** Node.js + Express + PostgreSQL (plain SQL, no ORM — easy to read/modify)
- **Frontend:** Plain HTML/CSS/JS (no build step — just open in a browser)
- **Auth:** JWT stored in an HttpOnly cookie, role-based (MD, OPS_MANAGER, AUDITOR, CASE_OFFICER, COUNSELOR)

---

## 1. What's inside

```
vjc-ops-portal/
├── server.js              → Express app entrypoint
├── db/
│   ├── schema.sql          → Run this in pgAdmin to create all tables
│   ├── seed.js             → Creates demo users + sample leads at every stage
│   └── pool.js             → DB connection
├── routes/                 → auth, dashboard, leads, audits, cases
├── middleware/auth.js       → JWT auth + role guard
├── uploads/audits/          → Uploaded verification-call audio files land here
└── public/                  → Frontend (login, dashboard, leads, audit, cases)
```

## 2. Prerequisites

- **Node.js 18+** — check with `node -v`
- **PostgreSQL** (local install, or a cloud one like Supabase/Neon/Railway) + **pgAdmin** to manage it

## 3. Install & configure

```bash
cd vjc-ops-portal
npm install
cp .env.example .env
```

Open `.env` and set `DATABASE_URL` to your actual Postgres connection string, e.g.:

```
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/vjc_ops
```

## 4. Create the database in pgAdmin

1. Open **pgAdmin** → right-click **Databases** → **Create → Database**.
2. Name it `vjc_ops` → Save.
3. Click on the new `vjc_ops` database → open the **Query Tool** (icon in the toolbar, or right-click → Query Tool).
4. Open the file `db/schema.sql` from this project, paste its full contents into the Query Tool, and click **Execute (▶ / F5)**.
   - This creates all tables: `branches`, `employees`, `leads`, `agreements`, `quality_audits`, `case_assignments`, `case_activity`.
5. That's it — no more manual steps needed in pgAdmin. Everything else (demo users, sample leads) is inserted by the seed script below.

> If you're using a cloud Postgres (Supabase/Neon/Railway), just point pgAdmin's
> "Register Server" at that host/port/credentials and do the same Query Tool step.

## 5. Create your login accounts

```bash
npm run seed
```

This creates **only the login accounts** (one per role) — **no demo leads, no
demo audits, no demo cases**. The dashboard will show all zeros until you add
real leads yourself from the "Leads / Agreements" page. This is the clean,
fresh starting point.

The password for **every** account is: **`Vjc@2026`**

| Role | Email |
|---|---|
| Managing Director | md@vjcoverseas.com |
| Ops Manager | ops.manager@vjcoverseas.com |
| Auditor | auditor@vjcoverseas.com |
| Case Officer (UK) | case.uk@vjcoverseas.com |
| Case Officer (USA) | case.usa@vjcoverseas.com |
| Counselor | counselor@vjcoverseas.com |

**Want to see the app working with sample data first (optional)?**
```bash
npm run seed:demo
```
This adds the same login accounts **plus** a handful of sample leads spread
across every stage (pending audit, failed audit, approved, in different
Kanban stages, one fully completed case) — useful only for exploring the UI.
Run `npm run reset` afterwards to clear it back out once you're done exploring.

## 6. Run the app

```bash
npm start
```

Open **http://localhost:4000** in your browser. Log in with any account above.

## 7. How the flow works (matches your diagram)

1. **Counselor** (`Leads` page) adds a lead + a signed agreement → lead status becomes `AGREEMENT_SIGNED`.
2. **Auditor** (`Quality Audit` page) sees it in the **Pending Verification Calls** queue, clicks **Start Audit**, ticks the 3 verification checks, sets a **1–10 score**, optionally uploads the call recording, and submits.
   - Score **≥ 7 → Approved** → lead moves to `AUDIT_APPROVED`.
   - Score **< 7 → Rejected** → lead goes back to `AUDIT_FAILED` (shows up again in the counselor's queue conceptually — visible on the Leads page).
3. **Ops Manager / MD** (`Case Filing Ops` page) sees audit-approved leads in **"Waiting for Case Officer Assignment"**, picks a **Case Officer** (filtered by specialty, e.g. UK/USA Specialist).
4. **Case Officer** drags the card across the **9-stage Kanban board**: Checklist Sent → Document Collection → SOP/LOR Review → University Application Submitted → Offer Received → Financial Documentation → Embassy Slot Booked → Biometrics Done → Visa Outcome.
5. Dropping a card on **Visa Outcome** prompts for **Approved/Rejected** — this closes out the case (`CASE_FILED`).

## 8. Dashboard

The `Dashboard` page shows, live from PostgreSQL:
- Pending audit count, total leads
- **Audit Approved vs Rejected** counts (exactly what you asked for — "top stacks enni approve ayyindhi enni reject ayyindhi")
- **Case Filing** totals: total cases, completed, rejected, in progress
- Recent audit activity log

## 9. Resetting all data (fresh start)

Whenever you want to wipe everything and start clean (e.g. after testing), you
have two options — no need to drop/recreate tables:

**Option A — from the terminal (easiest):**
```bash
npm run reset          # clears all data, tables stay empty (no login accounts either)
npm run reset:seed     # clears all data AND recreates fresh login accounts (no demo leads)
npm run reset:demo     # clears all data AND recreates accounts + sample demo leads
```

**Option B — from pgAdmin:**
Open the Query Tool on your `vjc_ops` database, paste the contents of
`db/reset.sql`, and execute it. Then run `npm run seed` from the terminal to
repopulate demo data (or leave it empty and add real leads from the app).

This only empties the tables (`TRUNCATE ... RESTART IDENTITY`) — it does **not**
touch your table structure, so you never need to re-run `schema.sql` again.

## 10. Roles & permissions

- Only `AUDITOR` / `OPS_MANAGER` / `MD` can submit an audit scorecard.
- Only `OPS_MANAGER` / `MD` can assign a case officer.
- Only `CASE_OFFICER` / `OPS_MANAGER` / `MD` can move a case's Kanban stage.
- Everyone logged in can view the dashboard and boards (read-only for their own scope in a production build — this MVP keeps viewing open for demo simplicity).

## 10. Extending this to the rest of the platform (HRMS / CRM / Billing)

This module was scoped intentionally to what you said was missing ("audit calls,
case filing"). The `db/schema.sql` file already matches the column names used
in your original architecture PDF (branches, employees, leads, invoices, etc.)
so it can be merged into the same database later — the `employees` and `leads`
tables here are compatible with the HRMS/CRM tables described in your platform
blueprint (Section 4 of the PDF), meaning this module can plug straight into
`portal.vjcoverseas.com` as `ops.vjcoverseas.com` once the other modules exist.

## 11. Troubleshooting

- **"Could not connect to database"** → check `DATABASE_URL` in `.env`, and that Postgres is actually running.
- **Login says "Invalid email or password"** → make sure you ran `npm run seed` after creating the schema.
- **Audio upload fails** → only `.mp3 .wav .m4a .ogg` under 25MB are accepted; the `uploads/audits` folder must be writable.
- **Port already in use** → change `PORT` in `.env`.

# Role-Based Data Visibility — Changes Made

**Problem before:** every logged-in user (any role) could see every section
(Leads, Quality Audit, Case Filing) and every other employee's data — no
separation.

**Fix:** each role now sees only the sections and records relevant to their
job. **MD (Chairman)** and **OPS_MANAGER** are the two "management" roles —
they still see everything, every section, every employee's data.

| Role | Sidebar sections visible | Data visible |
|---|---|---|
| MD (Chairman) | Dashboard, Leads, Audit, Cases (all) | Everything — every counselor's leads, every auditor's history, every case officer's board |
| OPS_MANAGER | Dashboard, Leads, Audit, Cases (all) | Everything (same as MD) |
| COUNSELOR | Dashboard, Leads | Only the leads **they personally created** |
| AUDITOR | Dashboard, Audit | Pending queue is shared (unclaimed work); Audit **history** shows only calls **they personally conducted** |
| CASE_OFFICER | Dashboard, Cases | Only the case cards **assigned to them**; cannot see or use the "assign officer" queue (that's Ops/MD only) |

No database schema changes were needed — `employees.id`, `leads.counselor_id`,
`quality_audits.auditor_id`, and `case_assignments.case_officer_id` already
existed and were simply not being used as filters. `req.user` (decoded from
the login JWT) already carries `id` and `role` on every request.

---

## File-by-file changes

### 1. `middleware/auth.js`
**What was there before:** only `requireAuth` (checks login) and `requireRole`
(checks role is in an allowed list). No shared helper to identify the two
"management" roles.

**What changed:** added one new exported helper function at the end of the
file, right before `module.exports`.

```js
// ADDED — new function
function isManagement(role) {
  return role === 'MD' || role === 'OPS_MANAGER';
}
```

The `module.exports` line changed from
`module.exports = { requireAuth, requireRole, JWT_SECRET };`
to
`module.exports = { requireAuth, requireRole, isManagement, JWT_SECRET };`

(In the end this helper wasn't needed by the other files — they check
`req.user.role === 'X'` directly, which is simpler for a small app — so it's
there for future use if you add more "management sees everything" pages
later. Safe to keep or delete.)

---

### 2. `routes/leads.js`
**Endpoint:** `GET /api/leads` (loaded by `public/leads.html` → `leads.js`)

**Before:** any logged-in user could call this and get every lead from every
counselor.

**After:**
- Added `requireRole('COUNSELOR', 'OPS_MANAGER', 'MD')` to the route — so an
  Auditor or Case Officer calling this URL directly now gets a clean
  `403 You do not have permission to do this` instead of data.
- If the caller's role is `COUNSELOR`, the SQL query now adds
  `AND l.counselor_id = <their own id>` — so they only ever get their own
  leads back, no matter what `?status=` filter they pass.
- Ops Manager / MD: no filter added → they still get every lead (unchanged
  behaviour).

Exact line changed — the route signature line:
```
BEFORE: router.get('/', requireAuth, async (req, res) => {
AFTER:  router.get('/', requireAuth, requireRole('COUNSELOR', 'OPS_MANAGER', 'MD'), async (req, res) => {
```
And inside the function body, the `WHERE` clause building logic now has an
extra condition block for `req.user.role === 'COUNSELOR'` right after the
existing `status` filter block.

---

### 3. `routes/audits.js`
**Endpoints:** `GET /api/audits/pending` and `GET /api/audits/history`
(both loaded by `public/audit.html` → `audit.js`)

**`/pending` — before:** open to any logged-in user.
**`/pending` — after:** added `requireRole('AUDITOR', 'OPS_MANAGER', 'MD')`.
No row-level filter here on purpose — this is a **shared work queue** (leads
not yet claimed by any specific auditor), so every auditor needs to see the
same list to pick up work.
```
BEFORE: router.get('/pending', requireAuth, async (req, res) => {
AFTER:  router.get('/pending', requireAuth, requireRole('AUDITOR', 'OPS_MANAGER', 'MD'), async (req, res) => {
```

**`/history` — before:** open to any logged-in user, returned every audit
ever submitted by every auditor.
**`/history` — after:** added the same `requireRole`, plus: if the caller is
an `AUDITOR`, the query now adds `WHERE qa.auditor_id = <their own id>` so
they only see calls they personally conducted. Ops Manager / MD see all
(unchanged).
```
BEFORE: router.get('/history', requireAuth, async (req, res) => {
AFTER:  router.get('/history', requireAuth, requireRole('AUDITOR', 'OPS_MANAGER', 'MD'), async (req, res) => {
```

---

### 4. `routes/cases.js`
**Endpoints touched:** `GET /unassigned`, `GET /board`, `GET /officers`,
`PATCH /:caseId/stage` (all loaded by `public/cases.html` → `cases.js`)

1. **`/unassigned`** (the "waiting for case officer assignment" list) —
   before: open to anyone. After: `requireRole('OPS_MANAGER', 'MD')` added —
   only the roles that can actually assign a case officer can see this queue.
   ```
   BEFORE: router.get('/unassigned', requireAuth, async (req, res) => {
   AFTER:  router.get('/unassigned', requireAuth, requireRole('OPS_MANAGER', 'MD'), async (req, res) => {
   ```

2. **`/board`** (the Kanban board) — before: open to anyone, returned every
   case from every officer. After: `requireRole('CASE_OFFICER', 'OPS_MANAGER', 'MD')`
   added, and if the caller is a `CASE_OFFICER`, the query adds
   `WHERE ca.case_officer_id = <their own id>` — so a Case Officer's board
   only ever shows cards assigned to them. Ops Manager / MD see every card
   (unchanged).
   ```
   BEFORE: router.get('/board', requireAuth, async (req, res) => {
   AFTER:  router.get('/board', requireAuth, requireRole('CASE_OFFICER', 'OPS_MANAGER', 'MD'), async (req, res) => {
   ```

3. **`/officers`** (dropdown list used only when assigning) — before: open
   to anyone. After: `requireRole('OPS_MANAGER', 'MD')` added, since only
   they use this dropdown.
   ```
   BEFORE: router.get('/officers', requireAuth, async (req, res) => {
   AFTER:  router.get('/officers', requireAuth, requireRole('OPS_MANAGER', 'MD'), async (req, res) => {
   ```

4. **`PATCH /:caseId/stage`** (drag-and-drop stage move) — before: any
   `CASE_OFFICER` could move the stage of *any* case, even one not assigned
   to them, just by knowing its ID. After: a new ownership check block was
   inserted right after `await client.query('BEGIN');` and before the
   existing `const updates = [...]` line — it looks up the case's
   `case_officer_id` and, if the caller is a `CASE_OFFICER` and it doesn't
   match their own ID, rolls back and returns
   `403 This case is not assigned to you`. Ops Manager / MD are unaffected
   and can still move any case.

---

### 5. `routes/dashboard.js`
**Endpoint:** `GET /api/dashboard/stats` (loaded by every role's Dashboard
page)

**Before:** every number on the dashboard (pending audits, approved/rejected
counts, total leads, case totals, recent audits table) was a company-wide
count — same numbers shown to everyone regardless of role.

**After:** the whole handler body was rewritten (same file, same route line
— only the body changed, response JSON shape is **identical**, so the
dashboard frontend needed zero changes). Three flags are computed at the top
from `req.user.role`:
```js
const ownLeadsOnly = role === 'COUNSELOR';
const ownAuditsOnly = role === 'AUDITOR';
const ownCasesOnly = role === 'CASE_OFFICER';
```
Every one of the 10 queries in this file now has a ternary: if the matching
flag is true, it adds `AND <table>.<owner_column> = $1` with the user's own
ID as the parameter; otherwise it runs the original company-wide query
unchanged. MD and Ops Manager trigger none of the three flags, so their
dashboard is 100% unchanged (full company numbers).

---

### 6. `public/js/api.js`
**Function:** `renderSidebar()` — runs on every page, builds the left
sidebar menu, and is called with the current page's name (e.g. `'leads'`).

**Before:** the sidebar always listed all 4 links (Dashboard, Leads, Audit,
Cases) for every role, and there was no check preventing someone from typing
`/leads.html` directly into the browser even if their role shouldn't see it.

**After:**
- A new constant `ROLE_SECTIONS` was added just above the function,
  mapping each role to the array of sidebar keys it's allowed to see (see
  the table at the top of this document).
- Inside `renderSidebar()`, right after the user is loaded, a guard was
  added: if the current page (`activeKey`) isn't in that role's allowed
  list, the browser is redirected to `/dashboard.html` immediately — so a
  Case Officer can no longer view `leads.html` etc. just by typing the URL.
- The `items` array (the 4 possible sidebar links) now has
  `.filter((it) => allowedSections.includes(it.key))` chained onto it, so
  only the allowed links are actually rendered in the menu.

---

### 7. `public/cases.html`
**One-line change:** the `<div class="section-card">` that wraps the
"Audit-Approved — Waiting for Case Officer Assignment" table now has
`id="unassignedSection"` added to it, so JavaScript can hide/show that
specific block.
```
BEFORE: <div class="section-card">
AFTER:  <div class="section-card" id="unassignedSection">
```
(This is the very first `section-card` div in the file, right after the
`<div class="topbar">` block.)

---

### 8. `public/js/cases.js`
**Bottom of the file — the self-running startup block.**

**Before:**
```js
(async () => {
  CURRENT_USER = await renderSidebar('cases');
  loadUnassigned();
  loadBoard();
})();
```
This always called `loadUnassigned()`, which now (after the `routes/cases.js`
change above) would return a 403 error for a Case Officer and pop up an
ugly permission-error toast.

**After:**
```js
(async () => {
  CURRENT_USER = await renderSidebar('cases');
  if (!CURRENT_USER) return;

  const canAssign = CURRENT_USER.role === 'OPS_MANAGER' || CURRENT_USER.role === 'MD';
  if (canAssign) {
    loadUnassigned();
  } else {
    document.getElementById('unassignedSection').style.display = 'none';
  }
  loadBoard();
})();
```
Now a Case Officer simply doesn't see that section at all (clean UI) instead
of seeing an error toast. Ops Manager / MD see it exactly as before.

---

## Working module summary (for the whole team)

1. **Login stays exactly the same** for every role — same emails, same
   password, same login page. Nothing changes there.
2. **What changes is what happens *after* login**, based on the role stored
   in your login token:
   - **Chairman (MD)** and **Ops Manager** → nothing changes for you. You
     still see all 4 menu items and all data, company-wide.
   - **Counselor** → your sidebar now only shows **Dashboard** and
     **Leads**. On the Leads page you only see the leads you personally
     added. Your dashboard numbers are your own leads only.
   - **Auditor** → your sidebar now only shows **Dashboard** and
     **Quality Audit**. The "pending verification calls" queue is still
     shared with other auditors (so any of you can pick up a waiting call),
     but your **audit history** table only shows calls you personally
     conducted.
   - **Case Officer** → your sidebar now only shows **Dashboard** and
     **Case Filing Ops**. The Kanban board only shows cards assigned to
     you — you no longer see other officers' students, and you can no
     longer drag-move a card that isn't assigned to you (server blocks it
     even if someone tries via the browser's dev tools).
3. **No database changes, no `npm run seed` needed again** — your existing
   accounts and data work as-is. Just restart the server
   (`npm start`) after pulling these files and log in again to see the
   new, scoped view.
4. **Testing checklist before you call it done:**
   - Log in as `counselor@vjcoverseas.com` → confirm only Dashboard + Leads
     show in the sidebar, and only leads that counselor added appear.
   - Log in as `auditor@vjcoverseas.com` → confirm only Dashboard + Audit
     show, and History table only has that auditor's own entries.
   - Log in as `case.uk@vjcoverseas.com` → confirm only Dashboard + Cases
     show, no "assign officer" table visible, board only shows their own
     cards.
   - Log in as `ops.manager@vjcoverseas.com` or `md@vjcoverseas.com` →
     confirm all 4 sections still show and all data is still visible
     (nothing should look different for these two).

# Document Repository — ops.vjcoverseas.com gap fix

**Scope check against the Chairman's PDF (§2 table + §3.6):** the PDF assigns
only **Quality Audit & Case Filing** to `ops.vjcoverseas.com`. Comparing that
section against the running code, everything matched **except one item**
explicitly named in §3.6:

> "Document Repository: Centralized, encrypted storage for student academic
> transcripts, IELTS/PTE scorecards, bank solvency letters, passport scans,
> and CAS/I-20 letters."

This is the same feature already flagged from the flow-diagram screenshot
earlier (rows 5 & 6 — "📁 Documents button", "Documents (3/7 verified)"
badge). This update builds it, and only it — nothing from HRMS/CRM/Billing
was touched.

Two small DDL items also present in the PDF's official schema for
`case_assignments` (`intake_semester`, `visa_submission_date`) were added at
the same time since they belong to the same table.

**7 document categories** (fixed list, matches the PDF's examples plus two
more to make a clean checklist of 7 — matches "Documents (3/7 verified)" from
the diagram): Passport, Transcripts, IELTS/PTE, Bank Letter, CAS/I-20, Photo,
Offer Letter.

**Who can do what:**
- **Case Officer** — upload/replace documents on cases assigned to them only.
- **Ops Manager / MD (chairman)** — upload on any case, AND are the only
  roles who can tick a document as **Verified**.

---

## Files — what's new vs what's edited

| File | New or edited? | What changed |
|---|---|---|
| `db/schema.sql` | Edited | 2 new columns on `case_assignments`, 1 new table `case_documents` |
| `db/migration_001_documents.sql` | **New file** | Same 2 columns + table, written as a safe `ADD COLUMN IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS` migration for databases that already have real data |
| `uploads/case_documents/` | **New folder** | Where uploaded document files physically land (same pattern as `uploads/audits/`) |
| `routes/documents.js` | **New file** | 3 new API endpoints: list, upload, verify |
| `server.js` | Edited | 2 lines added — require the new router, mount it |
| `routes/cases.js` | Edited | `/board` query now also returns a verified-document count per case |
| `public/cases.html` | Edited | 1 new modal block added (Documents table) |
| `public/js/cases.js` | Edited | Documents button on every card + all modal logic |

---

## 1. `db/schema.sql` (edited)

**Before** — `case_assignments` had no document-tracking columns, and there
was no `case_documents` table at all; the file ended right after
`case_activity` and 3 indexes.

**After** — inside the `CREATE TABLE case_assignments (...)` block, two new
columns were inserted right after `target_university` and before
`kanban_stage`:
```sql
target_university VARCHAR(250),
intake_semester VARCHAR(50),          -- ADDED
visa_submission_date DATE,            -- ADDED
kanban_stage VARCHAR(60) DEFAULT 'CHECKLIST_SENT',
```
And a brand new table + index were added right after the existing
`case_activity` table, before the final 3 `CREATE INDEX` lines:
```sql
CREATE TABLE case_documents (
  id BIGSERIAL PRIMARY KEY,
  case_id BIGINT REFERENCES case_assignments(id) ON DELETE CASCADE,
  doc_type VARCHAR(50) NOT NULL,
  file_url TEXT NOT NULL,
  original_filename VARCHAR(255),
  uploaded_by UUID REFERENCES employees(id),
  is_verified BOOLEAN DEFAULT false,
  verified_by UUID REFERENCES employees(id),
  verified_at TIMESTAMPTZ,
  uploaded_at TIMESTAMPTZ DEFAULT now()
);
```
plus `CREATE INDEX idx_case_documents_case ON case_documents(case_id);` added
next to the other indexes.

**If you run `schema.sql` fresh (new database), you already have all of
this — no extra step needed.**

**If your database already exists with real data**, do NOT re-run
`schema.sql` (it starts with `DROP TABLE ... CASCADE` and will wipe
everything). Instead run the new `db/migration_001_documents.sql` file once
in pgAdmin's Query Tool — it only adds the new columns/table and touches
nothing else.

---

## 2. `routes/documents.js` (brand new file)

Sits in the `routes/` folder next to `audits.js`, `cases.js`, etc. Three
endpoints, all mounted under `/api/case-documents`:

- `GET /api/case-documents/:caseId` — returns the fixed 7-type checklist +
  whatever's been uploaded so far for that case. A Case Officer calling this
  for a case that isn't theirs gets `403`.
- `POST /api/case-documents/:caseId` — multipart upload (`file` + `doc_type`
  fields), same ownership rule. Accepts PDF/JPG/PNG up to 10MB, stored in
  `uploads/case_documents/`.
- `PATCH /api/case-documents/doc/:docId/verify` — restricted to
  `OPS_MANAGER`/`MD` only, flips `is_verified` and records who verified it
  and when.

---

## 3. `server.js` (edited)

Two lines added. The `require` line was added to the block of existing
route requires:
```
BEFORE:
const caseRoutes = require('./routes/cases');

AFTER:
const caseRoutes = require('./routes/cases');
const documentRoutes = require('./routes/documents');   // ADDED
```
And the mount line was added right after the existing `/api/cases` mount:
```
BEFORE:
app.use('/api/cases', caseRoutes);

AFTER:
app.use('/api/cases', caseRoutes);
app.use('/api/case-documents', documentRoutes);   // ADDED
```

---

## 4. `routes/cases.js` (edited — `/board` route only)

The `SELECT` inside `router.get('/board', ...)` now LEFT JOINs a subquery
that counts verified documents per case, so the Kanban board response
carries a `documents_verified` number on every card without a second
network call per card:
```sql
-- ADDED, joined onto the existing SELECT:
LEFT JOIN (
  SELECT case_id, COUNT(*) FILTER (WHERE is_verified) AS verified_count
  FROM case_documents GROUP BY case_id
) doc ON doc.case_id = ca.id
```
and `COALESCE(doc.verified_count, 0) AS documents_verified` was added to the
column list. Nothing else in this file changed.

---

## 5. `public/cases.html` (edited)

One new `<div class="modal-overlay" id="documentsModal">` block was inserted
right after the existing `outcomeModal` block and right before the
`<script src="/js/api.js">` line at the bottom — a simple table with columns
Type / File / Uploaded By / Verified / (upload button), plus a Close button.

---

## 6. `public/js/cases.js` (edited)

- `DOC_LABELS` object added near the top (maps `PASSPORT` → `Passport`, etc.
  for the 7 types) right after `let officersCache = [];`.
- Every Kanban card now renders a **"📁 Documents X/7"** button (added right
  after the officer-name line in the card template), which opens the modal.
  The button stops the click from also starting a drag (`onmousedown`
  `stopPropagation`) so it doesn't fight with the existing drag-and-drop.
- New functions added right before the final startup `(async () => {...})()`
  block: `openDocuments()`, `loadDocuments()`, `uploadDoc()`,
  `toggleVerify()` — these build the table rows, wire up file inputs, and
  call the three new API endpoints. A Case Officer sees a read-only
  Verified/Pending badge; Ops Manager/MD see a clickable checkbox instead.
- Closing the modal now also calls `loadBoard()` again so the "X/7" badge on
  the card updates immediately.

---

## How to test (hands-on)

1. Run the migration (`migration_001_documents.sql`) or fresh `schema.sql` +
   `npm run seed`, then `npm start`.
2. Log in as a **Case Officer** whose board has at least one card (assign
   one first via Ops Manager/MD if needed).
3. Click **📁 Documents 0/7** on a card → upload a couple of files (any
   small PDF/JPG) against different rows → confirm they show as "Pending"
   for the Case Officer (no checkbox — they can't self-verify).
4. Log out, log in as **Ops Manager** or **MD** → open the same case's
   Documents modal → tick a couple of checkboxes → close the modal → the
   card badge should now read e.g. **📁 Documents 2/7**.
5. Log back in as the Case Officer → confirm those two now show a green
   "Verified" badge (still no checkbox for them — read-only).

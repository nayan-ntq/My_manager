# My Manager

Personal task/health/growth planner merged with a full teaching assistant:
class planner, attendance, correction records, performance/gradebook, and an
AI coach — all with real accounts and a shared Postgres backend (Supabase).

## What's already done for you
- Supabase project is live with the full schema and Row Level Security applied
- The Supabase URL + publishable key are already hardcoded in
  `src/lib/supabaseClient.js` — safe to expose, protected by RLS, no setup needed
- Icons, PWA manifest, and branding are in place

## What you still need to do

### 1. Push this to GitHub
Unzip this folder, upload its contents to a new GitHub repo (drag-and-drop via
GitHub's web UI works fine — see the "uploading an existing file" link on a
fresh empty repo).

### 2. Import into Vercel
Go to vercel.com/new, import the repo. Vercel auto-detects Vite — no config
changes needed.

### 3. Add ONE environment variable (for the AI Coach)
In Vercel → Project Settings → Environment Variables, add either or both:
- `ANTHROPIC_API_KEY` — console.anthropic.com (~$5 free trial credit)
- `GEMINI_API_KEY` — aistudio.google.com/apikey (ongoing free tier, no card)

Optionally `AI_PROVIDER` = `anthropic` or `gemini` to pick which runs first.
This is the only manual step left — I have no way to set Vercel env vars
through my current access, so this one's on you.

### 4. Deploy
Click Deploy. You'll get a live URL. Sign up for an account in the app itself
(top of the Auth screen) — that's separate from your Supabase/Vercel logins.

## Project structure
```
├── api/coach.js              AI coach serverless function (Anthropic/Gemini, auto-fallback)
├── public/                    Icons + PWA manifest assets
├── src/
│   ├── lib/
│   │   ├── supabaseClient.js   Supabase connection (credentials already filled in)
│   │   ├── db.js               All reads/writes: auth, tasks, classes, planner, attendance, etc.
│   │   ├── schedule.js         Live task-rescheduling engine
│   │   ├── images.js           Client-side photo compression
│   │   └── constants.js        Categories, seed data
│   ├── components/             TaskCard, AddTaskSheet, PhotoStrip, DateStrip, BottomNav
│   ├── pages/                  Auth, Today, Teach (5 sub-panels), Insights, Coach
│   └── App.jsx
└── vite.config.js              Includes PWA plugin for phone install
```

## Custom domain
Works with zero code changes — add it under Vercel → Domains, point your
registrar's DNS at it, SSL is automatic.

## Recent update: attendance day-off + concept-based test scoring

- **Attendance** now defaults every student to present; you only tap to mark
  exceptions absent. A "Day off" switch skips attendance entirely for a date.
- **Test creation** now asks for number of chapters and (optionally) exercises
  and specific concepts. Leave concepts blank and it auto-pulls every chapter
  logged in that class's Planner.
- Each test now has an expandable **concept breakdown** grid — tap a cell to
  cycle a student through Accurate / Application gap / Silly mistake / Concept
  gap, per concept.
- New **Absences** tab cross-references who was absent on which date with
  whatever chapter was logged in the Planner for that date.

This required one additional Supabase migration (already applied to your live
project): `attendance_records.is_day_off`, and
`performance_records.concepts` / `concept_marks` / `chapter_count` / `exercises`.
If you ever recreate the Supabase project from scratch, re-run
`supabase/schema.sql` first, then this migration is baked into the schema
already if you're copying it fresh — no separate step needed there.

## Recent update: chapter linking, concept tracing, incomplete-task follow-up

- **Planner** — chapter number and chapter name are now separate fields.
  Type a chapter number you've used before and the name (plus concepts/
  exercises, if you don't overwrite them) auto-fills from your last entry
  for that number.
- **Concepts & exercises** are now captured explicitly in the Planner per
  lesson, and can be linked into **Correction records** by entering the same
  chapter number \u2014 it pulls in that lesson's concepts/exercises automatically.
- **Correction type** is now a free-text field with a dropdown built from
  every type you've used before (starts with Classwork/Homework/Worksheet/
  Textbook/Revision, but anything new you type joins the list from then on).
- **Incomplete tasks** \u2014 a new expandable section at the top of the
  Correction tab lists every student currently marked "ic" (incomplete)
  across that class, with a one-tap "Done" button once they finish it.

Database migration for this is already applied to your live Supabase project
and included in `supabase/schema.sql` for a fresh setup.

## Recent update: concept-level understanding, test statistics, full-data Coach

- **Correction records** now have a per-student, per-concept "understanding"
  grid (Understood / Not understood / Not done), alongside the existing
  overall done/absent/incomplete/not-submitted status. A new **"ns" (not
  submitted)** status was added to that cycle.
- **Concept suggestions** \u2014 when creating a correction record, enter the
  chapter number and it suggests concepts pulled from that lesson's
  Methodology (for Classwork-type entries) or Assignment (for Homework-type)
  as tappable chips.
- **Test records** now ask for **passing marks**, support marking a student
  **Absent** (excluded from all statistics), and show **mean, median, mode,
  and standard deviation** alongside pass/fail counts.
- **Improving / slipping students** \u2014 a new card compares each student's
  most recent test % against their average on earlier tests for that class.
- **Coach now has full app access** \u2014 every class's roster, planner
  chapters/concepts, attendance rate, correction completion, and test
  statistics are sent as a single snapshot at the start of each conversation,
  not just a trimmed personal summary.
- **AI model updated to Gemini 3.6 Flash** (`gemini-3.6-flash`) as the
  default when `AI_PROVIDER=gemini` or as fallback. Override anytime via the
  `GEMINI_MODEL` environment variable in Vercel.

This required one more Supabase migration (already applied to your live
project) and is included in `supabase/schema.sql` for a fresh setup.

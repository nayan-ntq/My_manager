# Teacher mode update: how to apply

Extract this zip over your repo (same paths, overwrite when asked). Then do the edits below.
The database migration is already applied to your live Supabase project.

## Files in this zip
- src/App.jsx (replaced): no Today tab, no points/streak, opens on Teach, asks for a school on first login
- src/pages/Insights.jsx (replaced): teaching stats only
- src/pages/Coach.jsx (replaced): teaching-only prompts, sends only class data
- src/components/BottomNav.jsx (replaced): Teach | Insights | Coach
- src/components/SchoolSetup.jsx (new): first-login "which school" screen
- src/lib/school.js (new): school membership helpers
- api/coach.js (replaced): teaching-only system prompt
- supabase/migrations/20260920_teacher_mode_school_scoping.sql (new, already applied)

## 1. REQUIRED edit: src/pages/Teach.jsx (two lines, in confirmPlannerImport)

Delete this whole line:

    await db.createTeachingTask(userId, row.date, classId, cls?.name || "Class", row.chapter);

Change this line:

    toast(`Imported ${created} lesson${created === 1 ? "" : "s"} - added to Today too`);

to:

    toast(`Imported ${created} lesson${created === 1 ? "" : "s"}`);

If you skip the first one, importing a planner photo will keep creating hidden tasks on a Today page that no longer exists.

## 2. Small cosmetic edit: src/components/PlannerImportReviewSheet.jsx

Change ", and shows up on Today for that date." to "." in the sentence that starts "Gemini found ...".

## 3. Recommended edit: src/lib/db.js, fetchFullAppData

Replace

    const [meta, classes, todayTasks, taskHistory] = await Promise.all([
      fetchMeta(userId),
      fetchClasses(userId),
      fetchTasksForDate(userId, today),
      fetchTasksInRange(userId, from90, today),
    ]);

with

    const classes = await fetchClasses(userId);

and replace the final `return { profile: meta, todayTasks: ..., classes: classSummaries };` line with

    return { classes: classSummaries };

(Coach.jsx already drops the personal fields, so this only saves three unneeded queries.)

## 4. Delete these now-unused files
src/pages/Today.jsx, src/components/TaskCard.jsx, src/components/AddTaskSheet.jsx,
src/components/CategoryManager.jsx, src/lib/schedule.js

## 5. Housekeeping
- supabase/schema.sql: append the contents of the migration file above.
- README.md: add a changelog entry, e.g. "Teacher mode: personal planner removed from the app; teachers belong to a school (schools, school_members, classes.school_id)."

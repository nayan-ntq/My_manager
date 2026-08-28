import { supabase } from "./supabaseClient";
import { SEED_TASKS, SEED_CLASSES, DEFAULT_CATEGORY_SEED, BADGES } from "./constants";

/* ---------- auth ---------- */

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}
export function onAuthChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((_e, session) => callback(session));
  return () => data.subscription.unsubscribe();
}
export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}
export async function signOut() { await supabase.auth.signOut(); }

/* ---------- personal: tasks ---------- */

const TASK_SELECT = "*, subtasks(*), exercises(*, exercise_sets(*))";

export async function fetchTasksForDate(userId, dateStr) {
  const { data, error } = await supabase.from("tasks").select(TASK_SELECT)
    .eq("user_id", userId).eq("date", dateStr).order("time", { ascending: true });
  if (error) throw error;
  return (data || []).map(normalizeTask);
}

export async function fetchTasksInRange(userId, fromDate, toDate) {
  const { data, error } = await supabase.from("tasks").select("id, category, date, status, important")
    .eq("user_id", userId).gte("date", fromDate).lte("date", toDate);
  if (error) throw error;
  return data || [];
}

function normalizeTask(row) {
  return {
    ...row,
    duration: row.duration_min,
    subtasks: (row.subtasks || []).sort((a, b) => a.position - b.position),
    exercises: (row.exercises || [])
      .map((ex) => ({ ...ex, sets: (ex.exercise_sets || []).sort((a, b) => a.set_number - b.set_number) }))
      .sort((a, b) => a.position - b.position),
  };
}

export async function createTask(userId, date, form) {
  const { data: task, error } = await supabase.from("tasks").insert({
    user_id: userId, title: form.title, category: form.category, date,
    time: form.time, duration_min: Number(form.duration) || 15,
    anchored: !!form.anchored, important: !!form.important,
  }).select().single();
  if (error) throw error;

  if (form.subtasks?.length) {
    await supabase.from("subtasks").insert(
      form.subtasks.filter((s) => s.title.trim()).map((s, i) => ({ task_id: task.id, user_id: userId, title: s.title, position: i }))
    );
  }
  if (form.category === "gym" && form.exercises?.length) {
    for (let i = 0; i < form.exercises.length; i++) {
      const ex = form.exercises[i];
      if (!ex.name.trim()) continue;
      const { data: exRow, error: exErr } = await supabase.from("exercises")
        .insert({ task_id: task.id, user_id: userId, name: ex.name, position: i, photos: ex.photos || [] })
        .select().single();
      if (exErr) throw exErr;
      if (ex.sets?.length) {
        await supabase.from("exercise_sets").insert(
          ex.sets.map((s, j) => ({ exercise_id: exRow.id, user_id: userId, set_number: j + 1, reps: s.reps || null, weight: s.weight || null }))
        );
      }
    }
  }
  return task;
}

export async function updateTaskCore(taskId, patch) {
  const dbPatch = { ...patch };
  if ("duration" in dbPatch) { dbPatch.duration_min = dbPatch.duration; delete dbPatch.duration; }
  const { error } = await supabase.from("tasks").update(dbPatch).eq("id", taskId);
  if (error) throw error;
}
export async function setTaskStatus(taskId, status, actualStart = null) {
  const { error } = await supabase.from("tasks").update({ status, actual_start: actualStart }).eq("id", taskId);
  if (error) throw error;
}
export async function deleteTask(taskId) {
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) throw error;
}

export async function toggleSubtask(id, done) {
  const { error } = await supabase.from("subtasks").update({ done }).eq("id", id);
  if (error) throw error;
}

export async function addExercisePhoto(exerciseId, currentPhotos, dataUrl) {
  const photos = [...(currentPhotos || []), dataUrl];
  const { error } = await supabase.from("exercises").update({ photos }).eq("id", exerciseId);
  if (error) throw error;
  return photos;
}
export async function removeExercisePhoto(exerciseId, currentPhotos, idx) {
  const photos = (currentPhotos || []).filter((_, i) => i !== idx);
  const { error } = await supabase.from("exercises").update({ photos }).eq("id", exerciseId);
  if (error) throw error;
  return photos;
}
export async function updateSet(id, patch) {
  const { error } = await supabase.from("exercise_sets").update(patch).eq("id", id);
  if (error) throw error;
}

/* ---------- personal: stats/profile ---------- */

/* ---------- personal: task categories (user-editable) ---------- */

export async function fetchCategories(userId) {
  const { data, error } = await supabase.from("task_categories").select("*").eq("user_id", userId).order("position");
  if (error) throw error;
  return data || [];
}
export async function createCategory(userId, key, label, color, iconKey, position) {
  const { data, error } = await supabase.from("task_categories")
    .insert({ user_id: userId, key, label, color, icon_key: iconKey, position }).select().single();
  if (error) throw error;
  return data;
}
export async function updateCategory(id, patch) {
  const { error } = await supabase.from("task_categories").update(patch).eq("id", id);
  if (error) throw error;
}
export async function deleteCategory(id) {
  const { error } = await supabase.from("task_categories").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchMeta(userId) {
  const { data, error } = await supabase.from("user_meta").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (data) return data;
  const defaults = { user_id: userId, display_name: null, points: 0, streak: 0, longest_streak: 0, last_active_day: null, badges_earned: [] };
  const { error: insErr } = await supabase.from("user_meta").insert(defaults);
  if (insErr) throw insErr;
  return defaults;
}
export async function saveMeta(userId, patch) {
  const { error } = await supabase.from("user_meta").upsert({ user_id: userId, ...patch });
  if (error) throw error;
}

/* ---------- rewards: streak + badges ---------- */

function addDaysStr(dateStr, n) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/** A date is "protected" (doesn't require action, doesn't break the streak) if a class was
 *  explicitly marked a day off that date, or no class meets on that weekday at all. */
export async function isProtectedDay(userId, date) {
  const { data: dayOff, error: e1 } = await supabase.from("attendance_records").select("id")
    .eq("user_id", userId).eq("date", date).eq("is_day_off", true).limit(1);
  if (e1) throw e1;
  if (dayOff && dayOff.length) return true;

  const dow = new Date(date + "T00:00:00").getDay();
  const { count, error: e2 } = await supabase.from("timetable_slots").select("id", { count: "exact", head: true })
    .eq("user_id", userId).eq("day_of_week", dow);
  if (e2) throw e2;
  return (count || 0) === 0;
}

/**
 * Credits today's streak/points for a qualifying action (personal important task done,
 * attendance taken, correction/test marks entered, or a planner entry logged). Bridges
 * gaps of "protected" days (day-off or no-school weekdays) without breaking the streak.
 * Safe to call multiple times per day - only the first call each day changes anything.
 */
export async function recordStreakActivity(userId, pointsToAdd = 0) {
  const meta = await fetchMeta(userId);
  const today = new Date().toISOString().slice(0, 10);

  if (meta.last_active_day === today) {
    if (pointsToAdd) { await saveMeta(userId, { points: meta.points + pointsToAdd }); return { ...meta, points: meta.points + pointsToAdd }; }
    return meta;
  }

  let newStreak;
  if (!meta.last_active_day) {
    newStreak = 1;
  } else {
    const last = new Date(meta.last_active_day + "T00:00:00");
    const cur = new Date(today + "T00:00:00");
    const dayDiff = Math.round((cur - last) / 86400000);
    if (dayDiff === 1) {
      newStreak = meta.streak + 1;
    } else if (dayDiff > 1) {
      let allProtected = true;
      for (let i = 1; i < dayDiff; i++) {
        if (!(await isProtectedDay(userId, addDaysStr(meta.last_active_day, i)))) { allProtected = false; break; }
      }
      newStreak = allProtected ? meta.streak + 1 : 1;
    } else {
      newStreak = meta.streak; // action logged for a past/backdated date - don't touch streak
    }
  }

  const patch = {
    points: meta.points + pointsToAdd,
    streak: newStreak,
    longest_streak: Math.max(meta.longest_streak || 0, newStreak),
    last_active_day: today,
  };
  await saveMeta(userId, patch);
  return { ...meta, ...patch };
}

/** Cumulative counts used to check teaching-milestone badges. */
export async function fetchRewardAggregates(userId) {
  const [classes, planner, correction, performance, attendance] = await Promise.all([
    supabase.from("classes").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("planner_entries").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("correction_records").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("performance_records").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("attendance_records").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("is_day_off", false),
  ]);
  return {
    classCount: classes.count || 0,
    plannerCount: planner.count || 0,
    correctionCount: correction.count || 0,
    performanceCount: performance.count || 0,
    attendanceDays: attendance.count || 0,
  };
}

/** Checks every badge definition against current stats/aggregates and persists any newly earned ones. */
export async function checkAndAwardBadges(userId, meta) {
  const aggregates = await fetchRewardAggregates(userId);
  const earned = new Set(meta.badges_earned || []);
  const newlyEarned = [];
  for (const badge of BADGES) {
    if (!earned.has(badge.key) && badge.check(meta, aggregates)) {
      earned.add(badge.key);
      newlyEarned.push(badge);
    }
  }
  if (newlyEarned.length) {
    await saveMeta(userId, { badges_earned: [...earned] });
  }
  return { newlyEarned, aggregates, badgesEarned: [...earned] };
}

/* ---------- teaching: classes + students ---------- */

export async function fetchClasses(userId) {
  const { data, error } = await supabase.from("classes").select("*, students(*)").eq("user_id", userId).order("created_at");
  if (error) throw error;
  return (data || []).map((c) => ({ ...c, students: (c.students || []).sort((a, b) => a.position - b.position) }));
}
export async function createClass(userId, name, subject) {
  const { data, error } = await supabase.from("classes").insert({ user_id: userId, name, subject }).select().single();
  if (error) throw error;
  return { ...data, students: [] };
}
export async function updateClass(id, patch) {
  const { error } = await supabase.from("classes").update(patch).eq("id", id);
  if (error) throw error;
}
export async function deleteClass(id) {
  const { error } = await supabase.from("classes").delete().eq("id", id);
  if (error) throw error;
}
export async function addStudent(userId, classId, name, position, extra) {
  const { data, error } = await supabase.from("students").insert({ user_id: userId, class_id: classId, name, position, ...extra }).select().single();
  if (error) throw error;
  return data;
}
export async function updateStudent(id, patch) {
  const { data, error } = await supabase.from("students").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}
export async function removeStudent(id) {
  const { error } = await supabase.from("students").delete().eq("id", id);
  if (error) throw error;
}

/* ---------- teaching: weekly timetable ---------- */

export async function fetchTimetable(userId) {
  const { data, error } = await supabase.from("timetable_slots").select("*, classes(name, subject)").eq("user_id", userId).order("day_of_week").order("start_time");
  if (error) throw error;
  return data || [];
}
export async function createTimetableSlot(userId, classId, dayOfWeek, startTime, endTime, label, position) {
  const { data, error } = await supabase.from("timetable_slots")
    .insert({ user_id: userId, class_id: classId, day_of_week: dayOfWeek, start_time: startTime, end_time: endTime || null, label: label || null, position })
    .select().single();
  if (error) throw error;
  return data;
}
export async function deleteTimetableSlot(id) {
  const { error } = await supabase.from("timetable_slots").delete().eq("id", id);
  if (error) throw error;
}
export async function updateTimetableSlot(id, patch) {
  const { error } = await supabase.from("timetable_slots").update(patch).eq("id", id);
  if (error) throw error;
}
/** Which class(es) are scheduled on a given day-of-week (0=Sunday), sorted by time \u2014 powers "today's class" auto-matching. */
export async function fetchTimetableForDay(userId, dayOfWeek) {
  const { data, error } = await supabase.from("timetable_slots").select("*, classes(name, subject)")
    .eq("user_id", userId).eq("day_of_week", dayOfWeek).order("start_time");
  if (error) throw error;
  return data || [];
}
/**
 * Creates a personal "teach this lesson" task on the given date, timed to the
 * timetable slot for that class if one exists for that weekday (else a
 * default mid-morning slot). This is what makes an imported Planner entry
 * show up on the date-wise Today page.
 */
export async function createTeachingTask(userId, date, classId, className, chapterLabel) {
  const dow = new Date(date + "T00:00:00").getDay();
  const daySlots = await fetchTimetableForDay(userId, dow);
  const slot = daySlots.find((s) => s.class_id === classId);
  const time = slot ? slot.start_time.slice(0, 5) : "09:00";
  const duration = slot?.end_time
    ? Math.max(15, Math.round((new Date(`2000-01-01T${slot.end_time}`) - new Date(`2000-01-01T${slot.start_time}`)) / 60000))
    : 45;
  return createTask(userId, date, {
    title: `Teach ${className}: ${chapterLabel || "lesson"}`,
    category: "professional", time, duration, anchored: !!slot, important: true,
  });
}

/* ---------- import logs (photo -> Gemini -> CSV -> database) ---------- */

export async function createImportLog(userId, kind, sourceNote, csvPreview, rowCount) {
  const { data, error } = await supabase.from("import_logs")
    .insert({ user_id: userId, kind, source_note: sourceNote || null, csv_preview: csvPreview || null, row_count: rowCount || null, status: "pending" })
    .select().single();
  if (error) throw error;
  return data;
}
export async function updateImportLogStatus(id, status) {
  const { error } = await supabase.from("import_logs").update({ status }).eq("id", id);
  if (error) throw error;
}
export async function fetchImportLogs(userId) {
  const { data, error } = await supabase.from("import_logs").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
  if (error) throw error;
  return data || [];
}

/* ---------- teaching: planner ---------- */

export async function fetchPlannerEntries(userId, classId) {
  const { data, error } = await supabase.from("planner_entries").select("*").eq("user_id", userId).eq("class_id", classId).order("date", { ascending: false });
  if (error) throw error;
  return data || [];
}
export async function createPlannerEntry(userId, classId, date, form) {
  const { data, error } = await supabase.from("planner_entries").insert({ user_id: userId, class_id: classId, date, ...form }).select().single();
  if (error) throw error;
  return data;
}
export async function deletePlannerEntry(id) {
  const { error } = await supabase.from("planner_entries").delete().eq("id", id);
  if (error) throw error;
}
export async function updatePlannerEntry(id, patch) {
  const { error } = await supabase.from("planner_entries").update(patch).eq("id", id);
  if (error) throw error;
}
/** Looks up the most recent chapter name used for a given chapter number in this class - powers auto-fill. */
export async function fetchChapterNameForNumber(userId, classId, chapterNumber) {
  if (!chapterNumber?.trim()) return null;
  const { data, error } = await supabase.from("planner_entries")
    .select("chapter, concepts, exercise_list, methodology, assignment").eq("user_id", userId).eq("class_id", classId)
    .eq("chapter_number", chapterNumber.trim()).order("date", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data;
}
/** Distinct chapter numbers logged for a class, for the datalist dropdown. */
export async function fetchChapterNumbers(userId, classId) {
  const { data, error } = await supabase.from("planner_entries").select("chapter_number").eq("user_id", userId).eq("class_id", classId);
  if (error) throw error;
  const seen = new Set();
  for (const row of data || []) if (row.chapter_number?.trim()) seen.add(row.chapter_number.trim());
  return [...seen];
}

/* ---------- teaching: attendance ---------- */

export async function fetchAttendance(userId, classId, date) {
  const { data, error } = await supabase.from("attendance_records").select("*").eq("user_id", userId).eq("class_id", classId).eq("date", date).maybeSingle();
  if (error) throw error;
  return data;
}
export async function fetchAttendanceRange(userId, fromDate, toDate) {
  const { data, error } = await supabase.from("attendance_records").select("*").eq("user_id", userId).gte("date", fromDate).lte("date", toDate);
  if (error) throw error;
  return data || [];
}
export async function upsertAttendance(userId, classId, date, present, isDayOff = false) {
  const { data, error } = await supabase.from("attendance_records")
    .upsert({ user_id: userId, class_id: classId, date, present, is_day_off: isDayOff }, { onConflict: "class_id,date" })
    .select().single();
  if (error) throw error;
  return data;
}
export async function fetchAllAttendanceForClass(userId, classId) {
  const { data, error } = await supabase.from("attendance_records").select("*").eq("user_id", userId).eq("class_id", classId).order("date", { ascending: false });
  if (error) throw error;
  return data || [];
}
/** Every date a given class had a lesson logged, mapped to its chapter/concept. */
export async function fetchPlannerChapterMap(userId, classId) {
  const { data, error } = await supabase.from("planner_entries").select("date, chapter").eq("user_id", userId).eq("class_id", classId);
  if (error) throw error;
  const map = {};
  for (const row of data || []) if (row.chapter) map[row.date] = row.chapter;
  return map;
}
/** Every concept AND exercise logged across a class's planner - merged into one list since both
 *  are tracked identically (same understanding/accuracy tags). Used to auto-fill test/correction
 *  concept lists when none are given explicitly. */
export async function fetchPlannerChapters(userId, classId) {
  const { data, error } = await supabase.from("planner_entries").select("concepts, exercise_list").eq("user_id", userId).eq("class_id", classId);
  if (error) throw error;
  const seen = new Set();
  for (const row of data || []) {
    for (const c of row.concepts || []) if (c?.trim()) seen.add(c.trim());
    for (const e of row.exercise_list || []) if (e?.trim()) seen.add(e.trim());
  }
  return [...seen];
}
/** Absences cross-referenced with the concept/chapter taught that day. */
export async function fetchAbsenceConceptReport(userId, classId, studentsById) {
  const [records, chapterMap] = await Promise.all([
    fetchAllAttendanceForClass(userId, classId),
    fetchPlannerChapterMap(userId, classId),
  ]);
  const rows = [];
  for (const r of records) {
    if (r.is_day_off) continue;
    for (const [studentId, present] of Object.entries(r.present || {})) {
      if (present === false) {
        rows.push({ date: r.date, studentId, studentName: studentsById[studentId] || "Unknown", chapter: chapterMap[r.date] || null });
      }
    }
  }
  return rows.sort((a, b) => b.date.localeCompare(a.date));
}

/* ---------- teaching: correction records ---------- */

export async function fetchCorrectionRecords(userId, classId) {
  const { data, error } = await supabase.from("correction_records").select("*").eq("user_id", userId).eq("class_id", classId).order("date", { ascending: false });
  if (error) throw error;
  return data || [];
}
export async function createCorrectionRecord(userId, classId, date, title, type, chapterNumber, concepts, exerciseList) {
  const { data, error } = await supabase.from("correction_records").insert({
    user_id: userId, class_id: classId, date, title, type, marks: {},
    chapter_number: chapterNumber || null, concepts: concepts || [], exercise_list: exerciseList || [],
  }).select().single();
  if (error) throw error;
  return data;
}
/** Writes the overall record-level status for a student, and logs the change to history (never overwritten). */
export async function updateCorrectionMarks(userId, id, marks, studentId, status) {
  const { error } = await supabase.from("correction_records").update({ marks }).eq("id", id);
  if (error) throw error;
  if (studentId) {
    const { error: logErr } = await supabase.from("correction_status_log").insert({
      user_id: userId, record_id: id, student_id: studentId, concept: null, status,
    });
    if (logErr) throw logErr;
  }
}
/** Per-concept status for one student, with an optional extra value (a date for "next_date", free text
 *  for "remark"). Every change is appended to correction_status_log for a full punctuality history,
 *  while concept_marks holds just the current state for fast display. */
export async function updateCorrectionConceptMark(userId, id, currentConceptMarks, studentId, concept, status, extra) {
  const entry = { status, remark: extra?.remark || null, next_date: extra?.next_date || null, marked_at: new Date().toISOString() };
  const conceptMarks = { ...currentConceptMarks };
  conceptMarks[studentId] = { ...(conceptMarks[studentId] || {}), [concept]: entry };
  const { error } = await supabase.from("correction_records").update({ concept_marks: conceptMarks }).eq("id", id);
  if (error) throw error;
  const { error: logErr } = await supabase.from("correction_status_log").insert({
    user_id: userId, record_id: id, student_id: studentId, concept, status, remark: entry.remark, next_date: entry.next_date,
  });
  if (logErr) throw logErr;
  return conceptMarks;
}
/** Sets every given student's status for one concept in a single write - "mark whole class X", then tap exceptions. */
export async function bulkSetCorrectionConceptMark(userId, id, currentConceptMarks, studentIds, concept, status) {
  const entry = { status, remark: null, next_date: null, marked_at: new Date().toISOString() };
  const conceptMarks = { ...currentConceptMarks };
  for (const sid of studentIds) conceptMarks[sid] = { ...(conceptMarks[sid] || {}), [concept]: entry };
  const { error } = await supabase.from("correction_records").update({ concept_marks: conceptMarks }).eq("id", id);
  if (error) throw error;
  const { error: logErr } = await supabase.from("correction_status_log").insert(
    studentIds.map((sid) => ({ user_id: userId, record_id: id, student_id: sid, concept, status }))
  );
  if (logErr) throw logErr;
  return conceptMarks;
}
/** Full change history for one student on one concept (or the overall record if concept is null) - oldest first. */
export async function fetchCorrectionHistory(recordId, studentId, concept) {
  let query = supabase.from("correction_status_log").select("*").eq("record_id", recordId).eq("student_id", studentId);
  query = concept === null || concept === undefined ? query.is("concept", null) : query.eq("concept", concept);
  const { data, error } = await query.order("marked_at", { ascending: true });
  if (error) throw error;
  return data || [];
}
export async function deleteCorrectionRecord(id) {
  const { error } = await supabase.from("correction_records").delete().eq("id", id);
  if (error) throw error;
}
export async function updateCorrectionRecord(id, patch) {
  const { error } = await supabase.from("correction_records").update(patch).eq("id", id);
  if (error) throw error;
}
/** Every distinct correction type this user has ever used - the dropdown grows itself. */
export async function fetchCorrectionTypes(userId) {
  const { data, error } = await supabase.from("correction_records").select("type").eq("user_id", userId);
  if (error) throw error;
  const seen = new Set();
  for (const row of data || []) if (row.type?.trim()) seen.add(row.type.trim());
  return [...seen];
}
/** Every distinct test type this user has ever used - admin-editable, grows as you type new ones. */
export async function fetchTestTypes(userId) {
  const { data, error } = await supabase.from("performance_records").select("test_type").eq("user_id", userId);
  if (error) throw error;
  const seen = new Set();
  for (const row of data || []) if (row.test_type?.trim()) seen.add(row.test_type.trim());
  return [...seen];
}
/** Every "incomplete" (ic) mark across a class's correction records, flattened for a follow-up list. */
export async function fetchIncompleteTasks(userId, classId, studentsById) {
  const { data, error } = await supabase.from("correction_records").select("*").eq("user_id", userId).eq("class_id", classId).order("date", { ascending: false });
  if (error) throw error;
  const rows = [];
  for (const r of data || []) {
    for (const [studentId, code] of Object.entries(r.marks || {})) {
      if (code === "ic") rows.push({ recordId: r.id, date: r.date, title: r.title, type: r.type, studentId, studentName: studentsById[studentId] || "Unknown", marks: r.marks });
    }
  }
  return rows;
}

/* ---------- teaching: performance records ---------- */

export async function fetchPerformanceRecords(userId, classId) {
  const { data, error } = await supabase.from("performance_records").select("*").eq("user_id", userId).eq("class_id", classId).order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}
export async function fetchAllPerformanceRecords(userId) {
  const { data, error } = await supabase.from("performance_records").select("*").eq("user_id", userId);
  if (error) throw error;
  return data || [];
}
export async function createPerformanceRecord(userId, classId, title, testType, maxMarks, chapterCount, exercises, concepts, passingMarks) {
  const { data, error } = await supabase.from("performance_records")
    .insert({
      user_id: userId, class_id: classId, title, test_type: testType, max_marks: maxMarks,
      chapter_count: chapterCount || null, exercises: exercises || null,
      concepts: concepts || [], marks: {}, concept_marks: {}, absent: {},
      passing_marks: passingMarks || null,
    }).select().single();
  if (error) throw error;
  return data;
}
export async function updatePerformanceMarks(id, marks) {
  const { error } = await supabase.from("performance_records").update({ marks }).eq("id", id);
  if (error) throw error;
}
export async function setPerformanceAbsent(id, currentAbsent, currentMarks, studentId, isAbsent) {
  const absent = { ...currentAbsent, [studentId]: isAbsent };
  const marks = { ...currentMarks };
  if (isAbsent) marks[studentId] = null; // clear any mark when marking absent
  const { error } = await supabase.from("performance_records").update({ absent, marks }).eq("id", id);
  if (error) throw error;
  return { absent, marks };
}
export async function updateConceptMark(id, currentConceptMarks, studentId, concept, tag) {
  const conceptMarks = { ...currentConceptMarks };
  conceptMarks[studentId] = { ...(conceptMarks[studentId] || {}), [concept]: tag };
  const { error } = await supabase.from("performance_records").update({ concept_marks: conceptMarks }).eq("id", id);
  if (error) throw error;
  return conceptMarks;
}
/** Sets every given student's tag for one concept in a single write \u2014 "mark whole class X", then tap exceptions. */
export async function bulkSetConceptMark(id, currentConceptMarks, studentIds, concept, tag) {
  const conceptMarks = { ...currentConceptMarks };
  for (const sid of studentIds) conceptMarks[sid] = { ...(conceptMarks[sid] || {}), [concept]: tag };
  const { error } = await supabase.from("performance_records").update({ concept_marks: conceptMarks }).eq("id", id);
  if (error) throw error;
  return conceptMarks;
}
export async function deletePerformanceRecord(id) {
  const { error } = await supabase.from("performance_records").delete().eq("id", id);
  if (error) throw error;
}
export async function updatePerformanceRecord(id, patch) {
  const { error } = await supabase.from("performance_records").update(patch).eq("id", id);
  if (error) throw error;
}

/* ---------- first-login seeding ---------- */

export async function ensureCategoriesSeeded(userId) {
  const { count, error } = await supabase.from("task_categories").select("id", { count: "exact", head: true }).eq("user_id", userId);
  if (error) throw error;
  if (count && count > 0) return;
  for (let i = 0; i < DEFAULT_CATEGORY_SEED.length; i++) {
    const c = DEFAULT_CATEGORY_SEED[i];
    await createCategory(userId, c.key, c.label, c.color, c.icon_key, i);
  }
}

export async function ensureSeeded(userId) {
  await ensureCategoriesSeeded(userId);
  const { count, error } = await supabase.from("tasks").select("id", { count: "exact", head: true }).eq("user_id", userId);
  if (error) throw error;
  if (count && count > 0) return;

  const today = new Date().toISOString().slice(0, 10);
  for (const t of SEED_TASKS) {
    await createTask(userId, today, {
      title: t.title, category: t.category, time: t.time, duration: t.duration_min,
      anchored: t.anchored, important: t.important,
      subtasks: (t.subtasks || []).map((title) => ({ title })),
      exercises: t.exercises || [],
    });
  }
  for (const c of SEED_CLASSES) {
    const cls = await createClass(userId, c.name, c.subject);
    for (let i = 0; i < c.students.length; i++) await addStudent(userId, cls.id, c.students[i], i);
  }
}

/* ---------- full data snapshot for the AI Coach ---------- */

function statSummary(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const counts = {};
  for (const v of values) counts[v] = (counts[v] || 0) + 1;
  const maxCount = Math.max(...Object.values(counts));
  const mode = maxCount > 1 ? Object.keys(counts).filter((k) => counts[k] === maxCount).map(Number) : null;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return { mean: +mean.toFixed(2), median, mode, stdDev: +Math.sqrt(variance).toFixed(2), count: values.length };
}

/**
 * Pulls together a full analytical snapshot - personal + every class's
 * planner/attendance/correction/performance data - for the Coach to reason
 * over. Summarized rather than raw-dumped to keep the payload manageable.
 */
export async function fetchFullAppData(userId) {
  const today = new Date().toISOString().slice(0, 10);
  const from90 = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);

  const [meta, classes, todayTasks, taskHistory] = await Promise.all([
    fetchMeta(userId),
    fetchClasses(userId),
    fetchTasksForDate(userId, today),
    fetchTasksInRange(userId, from90, today),
  ]);

  const classSummaries = await Promise.all(classes.map(async (cls) => {
    const studentsById = Object.fromEntries(cls.students.map((s) => [s.id, s.name]));
    const [planner, attendance, correction, performance] = await Promise.all([
      fetchPlannerEntries(userId, cls.id),
      fetchAllAttendanceForClass(userId, cls.id),
      fetchCorrectionRecords(userId, cls.id),
      fetchPerformanceRecords(userId, cls.id),
    ]);

    const workingDays = attendance.filter((a) => !a.is_day_off);
    const attendanceRate = workingDays.length
      ? Math.round((workingDays.reduce((sum, a) => sum + Object.values(a.present || {}).filter((p) => p !== false).length, 0) /
          (workingDays.length * cls.students.length)) * 100)
      : null;

    const performanceSummary = performance.slice(0, 15).map((r) => {
      const vals = Object.entries(r.marks)
        .filter(([sid]) => !(r.absent || {})[sid])
        .map(([, v]) => v).filter((v) => v !== null && v !== undefined);
      const stats = statSummary(vals);
      const passCount = r.passing_marks != null ? vals.filter((v) => v >= r.passing_marks).length : null;
      const marksByName = Object.fromEntries(Object.entries(r.marks).map(([sid, v]) => [studentsById[sid] || sid, v]));
      const conceptBreakdown = (r.concepts || []).map((concept) => ({
        concept,
        byStudent: Object.fromEntries(cls.students.map((s) => [s.name, r.concept_marks?.[s.id]?.[concept] || "blank"])),
      }));
      return {
        title: r.title, testType: r.test_type, maxMarks: r.max_marks, passingMarks: r.passing_marks,
        stats, passCount, absentCount: Object.values(r.absent || {}).filter(Boolean).length,
        marksByStudent: marksByName, conceptBreakdown,
      };
    });

    const correctionDetail = correction.slice(0, 15).map((r) => ({
      title: r.title, type: r.type, date: r.date, chapterNumber: r.chapter_number,
      statusByStudent: Object.fromEntries(cls.students.map((s) => [s.name, r.marks?.[s.id] || "blank"])),
      conceptUnderstanding: (r.concepts || []).map((concept) => ({
        concept,
        byStudent: Object.fromEntries(cls.students.map((s) => [s.name, r.concept_marks?.[s.id]?.[concept] || "blank"])),
      })),
    }));
    const incompleteCount = correction.reduce((sum, r) => sum + Object.values(r.marks || {}).filter((v) => v === "ic").length, 0);
    const notSubmittedCount = correction.reduce((sum, r) => sum + Object.values(r.marks || {}).filter((v) => v === "ns").length, 0);

    return {
      name: cls.name, subject: cls.subject, students: cls.students.map((s) => s.name),
      attendanceRatePct: attendanceRate,
      plannerChapters: planner.map((p) => ({ date: p.date, chapterNumber: p.chapter_number, chapter: p.chapter, concepts: p.concepts })),
      correctionSummary: { totalRecords: correction.length, incompleteCount, notSubmittedCount },
      correctionDetail,
      performanceSummary,
    };
  }));

  return { profile: meta, todayTasks: todayTasks.map((t) => ({ title: t.title, category: t.category, status: t.status, important: t.important })), last90DaysTaskCounts: { total: taskHistory.length, done: taskHistory.filter((t) => t.status === "done").length }, classes: classSummaries };
}

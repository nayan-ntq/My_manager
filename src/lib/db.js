import { supabase } from "./supabaseClient";
import { SEED_TASKS, SEED_CLASSES } from "./constants";

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

export async function fetchMeta(userId) {
  const { data, error } = await supabase.from("user_meta").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (data) return data;
  const defaults = { user_id: userId, display_name: null, points: 0, streak: 0, longest_streak: 0, last_active_day: null };
  const { error: insErr } = await supabase.from("user_meta").insert(defaults);
  if (insErr) throw insErr;
  return defaults;
}
export async function saveMeta(userId, patch) {
  const { error } = await supabase.from("user_meta").upsert({ user_id: userId, ...patch });
  if (error) throw error;
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
export async function deleteClass(id) {
  const { error } = await supabase.from("classes").delete().eq("id", id);
  if (error) throw error;
}
export async function addStudent(userId, classId, name, position) {
  const { data, error } = await supabase.from("students").insert({ user_id: userId, class_id: classId, name, position }).select().single();
  if (error) throw error;
  return data;
}
export async function removeStudent(id) {
  const { error } = await supabase.from("students").delete().eq("id", id);
  if (error) throw error;
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
export async function upsertAttendance(userId, classId, date, present) {
  const { data, error } = await supabase.from("attendance_records")
    .upsert({ user_id: userId, class_id: classId, date, present }, { onConflict: "class_id,date" })
    .select().single();
  if (error) throw error;
  return data;
}

/* ---------- teaching: correction records ---------- */

export async function fetchCorrectionRecords(userId, classId) {
  const { data, error } = await supabase.from("correction_records").select("*").eq("user_id", userId).eq("class_id", classId).order("date", { ascending: false });
  if (error) throw error;
  return data || [];
}
export async function createCorrectionRecord(userId, classId, date, title, type) {
  const { data, error } = await supabase.from("correction_records").insert({ user_id: userId, class_id: classId, date, title, type, marks: {} }).select().single();
  if (error) throw error;
  return data;
}
export async function updateCorrectionMarks(id, marks) {
  const { error } = await supabase.from("correction_records").update({ marks }).eq("id", id);
  if (error) throw error;
}
export async function deleteCorrectionRecord(id) {
  const { error } = await supabase.from("correction_records").delete().eq("id", id);
  if (error) throw error;
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
export async function createPerformanceRecord(userId, classId, title, testType, maxMarks) {
  const { data, error } = await supabase.from("performance_records")
    .insert({ user_id: userId, class_id: classId, title, test_type: testType, max_marks: maxMarks, marks: {} }).select().single();
  if (error) throw error;
  return data;
}
export async function updatePerformanceMarks(id, marks) {
  const { error } = await supabase.from("performance_records").update({ marks }).eq("id", id);
  if (error) throw error;
}
export async function deletePerformanceRecord(id) {
  const { error } = await supabase.from("performance_records").delete().eq("id", id);
  if (error) throw error;
}

/* ---------- first-login seeding ---------- */

export async function ensureSeeded(userId) {
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

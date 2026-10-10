import { supabase } from "./supabaseClient";
import { SEED_CLASSES } from "./constants";

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

/* ---------- teaching: classes + students ---------- */

/** Students are shown by roll number (numeric-aware, so "2" sorts before "10") -
 *  falls back to creation order for students with no roll number set. */
function sortStudents(students) {
  return [...(students || [])].sort((a, b) => {
    const an = parseFloat(a.roll_no), bn = parseFloat(b.roll_no);
    const aHas = a.roll_no && !isNaN(an), bHas = b.roll_no && !isNaN(bn);
    if (aHas && bHas) return an - bn;
    if (aHas) return -1;
    if (bHas) return 1;
    return a.position - b.position;
  });
}

export async function fetchClasses(userId) {
  const { data, error } = await supabase.from("classes").select("*, students(*)").eq("user_id", userId).order("created_at");
  if (error) throw error;
  return (data || []).map((c) => ({ ...c, students: sortStudents(c.students) }));
}
/** Every class in the school this caller can see - their own, plus (for admin/coordinator)
 *  everyone else's, via the reviewer RLS policies. Powers school-wide Insights and student profiles. */
export async function fetchSchoolClasses(schoolId) {
  const { data, error } = await supabase.from("classes").select("*, students(*)").eq("school_id", schoolId).order("created_at");
  if (error) throw error;
  return (data || []).map((c) => ({ ...c, students: sortStudents(c.students) }));
}
export async function createClass(userId, name, subject, grade) {
  const { data, error } = await supabase.from("classes").insert({ user_id: userId, name, subject, grade: grade || null }).select().single();
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

/* ---------- school-wide reads (for admin/coordinator - relies on the reviewer RLS
   policies rather than filtering by the calling user's own id) ---------- */

export async function fetchAttendanceForClassAll(classId) {
  const { data, error } = await supabase.from("attendance_records").select("*").eq("class_id", classId).order("date", { ascending: false });
  if (error) throw error;
  return data || [];
}
export async function fetchCorrectionRecordsForClassAll(classId) {
  const { data, error } = await supabase.from("correction_records").select("*").eq("class_id", classId).order("date", { ascending: false });
  if (error) throw error;
  return data || [];
}
export async function fetchPerformanceRecordsForClassAll(classId) {
  const { data, error } = await supabase.from("performance_records").select("*").eq("class_id", classId).order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}
export async function fetchPlannerEntriesForClassAll(classId) {
  const { data, error } = await supabase.from("planner_entries").select("*").eq("class_id", classId).order("date", { ascending: false });
  if (error) throw error;
  return data || [];
}
/** Raw activity rows (class_id + created_at) across every class in a set, for tallying
 *  per-teacher activity counts in Insights - Teachers. */
export async function fetchActivityForClasses(classIds) {
  if (!classIds.length) return { planner: [], correction: [], performance: [] };
  const [planner, correction, performance] = await Promise.all([
    supabase.from("planner_entries").select("class_id, created_at").in("class_id", classIds),
    supabase.from("correction_records").select("class_id, created_at").in("class_id", classIds),
    supabase.from("performance_records").select("class_id, created_at").in("class_id", classIds),
  ]);
  if (planner.error) throw planner.error;
  if (correction.error) throw correction.error;
  if (performance.error) throw performance.error;
  return { planner: planner.data || [], correction: correction.data || [], performance: performance.data || [] };
}

/* ---------- school terms + holidays (admin sets, everyone reads) ---------- */

export async function fetchTerms(schoolId) {
  const { data, error } = await supabase.from("school_terms").select("*").eq("school_id", schoolId).order("start_date");
  if (error) throw error;
  return data || [];
}
export async function createTerm(schoolId, form) {
  const { data, error } = await supabase.from("school_terms")
    .insert({ school_id: schoolId, name: form.name, start_date: form.start_date, end_date: form.end_date, weekly_off_days: form.weekly_off_days })
    .select().single();
  if (error) throw error;
  return data;
}
export async function updateTerm(id, patch) {
  const { error } = await supabase.from("school_terms").update(patch).eq("id", id);
  if (error) throw error;
}
export async function deleteTerm(id) {
  const { error } = await supabase.from("school_terms").delete().eq("id", id);
  if (error) throw error;
}
export async function fetchHolidays(schoolId) {
  const { data, error } = await supabase.from("school_holidays").select("*").eq("school_id", schoolId).order("date");
  if (error) throw error;
  return data || [];
}
export async function createHoliday(schoolId, date, label) {
  const { data, error } = await supabase.from("school_holidays").insert({ school_id: schoolId, date, label: label || null }).select().single();
  if (error) throw error;
  return data;
}
export async function bulkCreateHolidays(schoolId, rows) {
  const payload = rows.filter((r) => r.date?.trim()).map((r) => ({ school_id: schoolId, date: r.date.trim(), label: r.label?.trim() || null }));
  const { error } = await supabase.from("school_holidays").insert(payload);
  if (error) throw error;
  return payload.length;
}
export async function deleteHoliday(id) {
  const { error } = await supabase.from("school_holidays").delete().eq("id", id);
  if (error) throw error;
}

/* ---------- teaching: syllabus (per-grade, shared across sections) ---------- */

export async function fetchSyllabus(schoolId, grade, subject) {
  let query = supabase.from("syllabus_chapters").select("*").eq("school_id", schoolId).eq("grade", grade).order("position");
  if (subject) query = query.eq("subject", subject);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}
export async function createSyllabusChapter(schoolId, userId, grade, subject, form, position) {
  const { data, error } = await supabase.from("syllabus_chapters")
    .insert({ school_id: schoolId, created_by: userId, grade, subject, chapter_number: form.chapter_number || null, chapter_name: form.chapter_name, kind: form.kind || "syllabus", position })
    .select().single();
  if (error) throw error;
  return data;
}
export async function bulkCreateSyllabusChapters(schoolId, userId, grade, subject, rows, startPosition) {
  const payload = rows.map((r, i) => ({ school_id: schoolId, created_by: userId, grade, subject, chapter_number: r.chapter_number || null, chapter_name: r.chapter_name, kind: "syllabus", position: startPosition + i }));
  const { error } = await supabase.from("syllabus_chapters").insert(payload);
  if (error) throw error;
}
export async function updateSyllabusChapter(id, patch) {
  const { error } = await supabase.from("syllabus_chapters").update(patch).eq("id", id);
  if (error) throw error;
}
export async function deleteSyllabusChapter(id) {
  const { error } = await supabase.from("syllabus_chapters").delete().eq("id", id);
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
    .select("chapter, concepts, exercise_list, methodology, assignment, classwork_items, homework_items").eq("user_id", userId).eq("class_id", classId)
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
  const { data, error } = await supabase.from("planner_entries").select("concepts, exercise_list, classwork_items, homework_items").eq("user_id", userId).eq("class_id", classId);
  if (error) throw error;
  const seen = new Set();
  for (const row of data || []) {
    for (const c of row.concepts || []) if (c?.trim()) seen.add(c.trim());
    for (const e of row.exercise_list || []) if (e?.trim()) seen.add(e.trim());
    for (const item of [...(row.classwork_items || []), ...(row.homework_items || [])]) if (item?.text?.trim()) seen.add(item.text.trim());
  }
  return [...seen];
}
/** Every classwork/homework item logged for a class, flattened with its date/chapter - for the
 *  Classwork & Homework browsing list (date-wise / chapter-wise filterable). */
export async function fetchClassworkHomework(userId, classId) {
  const { data, error } = await supabase.from("planner_entries")
    .select("date, chapter_number, chapter, classwork_items, homework_items")
    .eq("user_id", userId).eq("class_id", classId).order("date", { ascending: false });
  if (error) throw error;
  const rows = [];
  for (const entry of data || []) {
    for (const item of entry.classwork_items || []) rows.push({ ...item, type: "classwork", date: entry.date, chapterNumber: entry.chapter_number, chapter: entry.chapter });
    for (const item of entry.homework_items || []) rows.push({ ...item, type: "homework", date: entry.date, chapterNumber: entry.chapter_number, chapter: entry.chapter });
  }
  return rows;
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
  const entry = {
    status, remark: extra?.remark || null, next_date: extra?.next_date || null,
    quality: extra?.quality || null, rating: extra?.rating ?? null, marked_at: new Date().toISOString(),
  };
  const conceptMarks = { ...currentConceptMarks };
  conceptMarks[studentId] = { ...(conceptMarks[studentId] || {}), [concept]: entry };
  const { error } = await supabase.from("correction_records").update({ concept_marks: conceptMarks }).eq("id", id);
  if (error) throw error;
  const { error: logErr } = await supabase.from("correction_status_log").insert({
    user_id: userId, record_id: id, student_id: studentId, concept, status,
    remark: entry.remark, next_date: entry.next_date, quality: entry.quality, rating: entry.rating,
  });
  if (logErr) throw logErr;
  return conceptMarks;
}
/** Sets every given student's status for one concept in a single write - "mark whole class X", then tap exceptions.
 *  defaultQuality is passed when bulk-marking a homework concept "done" - every student defaults to Accurate so
 *  the teacher only has to touch the exceptions afterward. */
export async function bulkSetCorrectionConceptMark(userId, id, currentConceptMarks, studentIds, concept, status, defaultQuality) {
  const entry = { status, remark: null, next_date: null, quality: defaultQuality || null, rating: null, marked_at: new Date().toISOString() };
  const conceptMarks = { ...currentConceptMarks };
  for (const sid of studentIds) conceptMarks[sid] = { ...(conceptMarks[sid] || {}), [concept]: entry };
  const { error } = await supabase.from("correction_records").update({ concept_marks: conceptMarks }).eq("id", id);
  if (error) throw error;
  const { error: logErr } = await supabase.from("correction_status_log").insert(
    studentIds.map((sid) => ({ user_id: userId, record_id: id, student_id: sid, concept, status, quality: entry.quality }))
  );
  if (logErr) throw logErr;
  return conceptMarks;
}
/** Sets just the quality tag (+optional rating) for one student's concept, without touching completion status -
 *  used when the teacher corrects an outlier (e.g. Silly Mistake) after a bulk "done" already defaulted them. */
export async function updateCorrectionConceptQuality(userId, id, currentConceptMarks, studentId, concept, quality, rating) {
  const current = currentConceptMarks?.[studentId]?.[concept] || { status: "done" };
  const entry = { ...current, quality, rating: rating ?? current.rating ?? null, marked_at: new Date().toISOString() };
  const conceptMarks = { ...currentConceptMarks };
  conceptMarks[studentId] = { ...(conceptMarks[studentId] || {}), [concept]: entry };
  const { error } = await supabase.from("correction_records").update({ concept_marks: conceptMarks }).eq("id", id);
  if (error) throw error;
  const { error: logErr } = await supabase.from("correction_status_log").insert({
    user_id: userId, record_id: id, student_id: studentId, concept, status: entry.status, quality, rating: entry.rating,
  });
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

export async function ensureSeeded(userId) {
  const { count, error } = await supabase.from("classes").select("id", { count: "exact", head: true }).eq("user_id", userId);
  if (error) throw error;
  if (count && count > 0) return;

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
 * Pulls together a full analytical snapshot - every class's planner/
 * attendance/correction/performance data - for the Coach to reason over.
 * Summarized rather than raw-dumped to keep the payload manageable.
 */
export async function fetchFullAppData(userId) {
  const classes = await fetchClasses(userId);

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

  return { classes: classSummaries };
}

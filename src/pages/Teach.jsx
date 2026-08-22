import React, { useEffect, useState, useCallback } from "react";
import { Plus, X, Trash2, UserPlus, ClipboardList, ClipboardCheck, Check, BarChart3, Users, ChevronRight, ChevronDown, UserX } from "lucide-react";
import { Segmented } from "../components/Shared";
import PhotoStrip from "../components/PhotoStrip";
import { TEST_TYPES, CORRECTION_CODES, CORRECTION_LABELS, CONCEPT_TAGS, CONCEPT_TAG_LABELS, CONCEPT_TAG_TITLES, DEFAULT_CORRECTION_TYPES } from "../lib/constants";
import * as db from "../lib/db";

function todayKey() { return new Date().toISOString().slice(0, 10); }

/* ---------- classes ---------- */

function ClassesPanel({ userId, classes, reloadClasses }) {
  const [name, setName] = useState(""); const [subject, setSubject] = useState("");
  const [studentInput, setStudentInput] = useState({});

  const addClass = async () => {
    if (!name.trim()) return;
    await db.createClass(userId, name, subject);
    setName(""); setSubject(""); reloadClasses();
  };
  const addStudent = async (classId) => {
    const val = (studentInput[classId] || "").trim();
    if (!val) return;
    const cls = classes.find((c) => c.id === classId);
    await db.addStudent(userId, classId, val, cls.students.length);
    setStudentInput({ ...studentInput, [classId]: "" });
    reloadClasses();
  };
  const removeStudent = async (id) => { await db.removeStudent(id); reloadClasses(); };
  const removeClass = async (id) => { await db.deleteClass(id); reloadClasses(); };

  return (
    <div>
      <div className="card">
        <div className="card-title">New class</div>
        <div className="row-2">
          <input className="input" placeholder="Class name (e.g. Grade 6 \u2014 Maths)" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="input" placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <button className="btn btn-primary" style={{ marginTop: 10 }} onClick={addClass}><Plus size={14} /> Add class</button>
      </div>
      {classes.map((c) => (
        <div className="card" key={c.id}>
          <div className="card-title-row">
            <div><div className="card-title" style={{ marginBottom: 0 }}>{c.name}</div><div className="card-sub">{c.subject} \u00b7 {c.students.length} students</div></div>
            <button className="btn btn-icon" onClick={() => removeClass(c.id)}><Trash2 size={14} /></button>
          </div>
          <div className="student-chip-wrap">
            {c.students.map((s) => <span className="student-chip" key={s.id}>{s.name}<button onClick={() => removeStudent(s.id)}><X size={11} /></button></span>)}
          </div>
          <div className="row-2" style={{ marginTop: 10 }}>
            <input className="input" placeholder="Add student name" value={studentInput[c.id] || ""} onChange={(e) => setStudentInput({ ...studentInput, [c.id]: e.target.value })} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addStudent(c.id))} />
            <button type="button" className="btn btn-ghost" onClick={() => addStudent(c.id)}><UserPlus size={14} /></button>
          </div>
        </div>
      ))}
    </div>
  );
}

function ClassPicker({ classes, value, onChange }) {
  if (classes.length === 0) return <div className="empty">Add a class first, in the Classes tab.</div>;
  return <select className="input" value={value || ""} onChange={(e) => onChange(e.target.value)}>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>;
}

/* ---------- planner ---------- */

function PlannerPanel({ userId, classes }) {
  const [classId, setClassId] = useState(classes[0]?.id || "");
  useEffect(() => { if (!classId && classes[0]) setClassId(classes[0].id); }, [classes, classId]);
  const [date, setDate] = useState(todayKey());
  const [form, setForm] = useState({ chapter_number: "", chapter: "", objectives: "", methodology: "", resources: "", assignment: "", reflection: "", conceptsInput: "", exercisesInput: "", photos: [] });
  const [entries, setEntries] = useState([]);
  const [chapterNumbers, setChapterNumbers] = useState([]);
  const [autoFilled, setAutoFilled] = useState(false);

  const load = useCallback(async () => {
    if (!classId) return;
    const [entryRows, numbers] = await Promise.all([db.fetchPlannerEntries(userId, classId), db.fetchChapterNumbers(userId, classId)]);
    setEntries(entryRows); setChapterNumbers(numbers);
  }, [userId, classId]);
  useEffect(() => { load(); }, [load]);

  const onChapterNumberBlur = async () => {
    if (!form.chapter_number.trim() || form.chapter.trim()) return; // don't clobber a manually-typed name
    const match = await db.fetchChapterNameForNumber(userId, classId, form.chapter_number);
    if (match) {
      setForm((f) => ({
        ...f,
        chapter: match.chapter || f.chapter,
        conceptsInput: f.conceptsInput || (match.concepts || []).join(", "),
        exercisesInput: f.exercisesInput || (match.exercise_list || []).join(", "),
      }));
      setAutoFilled(true);
    }
  };

  const save = async () => {
    if (!classId || !form.chapter.trim()) return;
    const payload = {
      chapter_number: form.chapter_number.trim() || null,
      chapter: form.chapter, objectives: form.objectives, methodology: form.methodology,
      resources: form.resources, assignment: form.assignment, reflection: form.reflection,
      concepts: form.conceptsInput.split(",").map((s) => s.trim()).filter(Boolean),
      exercise_list: form.exercisesInput.split(",").map((s) => s.trim()).filter(Boolean),
      photos: form.photos,
    };
    await db.createPlannerEntry(userId, classId, date, payload);
    setForm({ chapter_number: "", chapter: "", objectives: "", methodology: "", resources: "", assignment: "", reflection: "", conceptsInput: "", exercisesInput: "", photos: [] });
    setAutoFilled(false);
    load();
  };
  const remove = async (id) => { await db.deletePlannerEntry(id); load(); };

  return (
    <div>
      <div className="card">
        <div className="card-title">Daily / weekly planner entry</div>
        <div className="field-label">Class</div>
        <ClassPicker classes={classes} value={classId} onChange={setClassId} />
        <div className="field-label">Date</div>
        <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        <div className="row-2">
          <div>
            <div className="field-label">Chapter number</div>
            <input className="input" list="chapter-numbers" placeholder="e.g. 3" value={form.chapter_number}
              onChange={(e) => { setAutoFilled(false); setForm({ ...form, chapter_number: e.target.value }); }}
              onBlur={onChapterNumberBlur} />
            <datalist id="chapter-numbers">{chapterNumbers.map((n) => <option key={n} value={n} />)}</datalist>
          </div>
          <div>
            <div className="field-label">Chapter name</div>
            <input className="input" placeholder="e.g. Fractions" value={form.chapter} onChange={(e) => setForm({ ...form, chapter: e.target.value })} />
          </div>
        </div>
        {autoFilled && <div className="autofill-hint">Filled in from a previous entry for chapter {form.chapter_number} \u2014 edit anything as needed.</div>}
        <div className="field-label">Learning objectives</div>
        <textarea className="input textarea" value={form.objectives} onChange={(e) => setForm({ ...form, objectives: e.target.value })} />
        <div className="field-label">Methodology / activity</div>
        <textarea className="input textarea" value={form.methodology} onChange={(e) => setForm({ ...form, methodology: e.target.value })} />
        <div className="field-label">Resources</div>
        <input className="input" value={form.resources} onChange={(e) => setForm({ ...form, resources: e.target.value })} />
        <div className="field-label">Assignment</div>
        <input className="input" value={form.assignment} onChange={(e) => setForm({ ...form, assignment: e.target.value })} />
        <div className="field-label">Reflection</div>
        <textarea className="input textarea" value={form.reflection} onChange={(e) => setForm({ ...form, reflection: e.target.value })} />
        <div className="field-label">Concepts covered (comma-separated)</div>
        <input className="input" placeholder="e.g. Equivalent fractions, LCM" value={form.conceptsInput} onChange={(e) => setForm({ ...form, conceptsInput: e.target.value })} />
        <div className="field-label">Exercises covered (comma-separated)</div>
        <input className="input" placeholder="e.g. Ex 3.1, Ex 3.2" value={form.exercisesInput} onChange={(e) => setForm({ ...form, exercisesInput: e.target.value })} />
        <div className="field-label">Photos (board work, worksheets, textbook pages\u2026)</div>
        <PhotoStrip photos={form.photos} onAdd={(url) => setForm({ ...form, photos: [...form.photos, url] })} onRemove={(pi) => setForm({ ...form, photos: form.photos.filter((_, idx) => idx !== pi) })} max={6} />
        <button className="btn btn-primary" style={{ marginTop: 12, width: "100%" }} onClick={save}><Plus size={14} /> Save entry</button>
      </div>
      {entries.map((e) => (
        <div className="card planner-entry" key={e.id}>
          <div className="card-title-row"><div className="card-sub mono">{e.date}</div><button className="btn btn-icon" onClick={() => remove(e.id)}><Trash2 size={13} /></button></div>
          <div className="planner-field"><b>{e.chapter_number ? `Ch ${e.chapter_number}: ` : ""}{e.chapter}</b></div>
          {e.objectives && <div className="planner-field"><span className="planner-label">Objectives:</span> {e.objectives}</div>}
          {e.methodology && <div className="planner-field"><span className="planner-label">Methodology:</span> {e.methodology}</div>}
          {e.assignment && <div className="planner-field"><span className="planner-label">Assignment:</span> {e.assignment}</div>}
          {e.reflection && <div className="planner-field"><span className="planner-label">Reflection:</span> {e.reflection}</div>}
          {e.concepts?.length > 0 && <div className="planner-field"><span className="planner-label">Concepts:</span> {e.concepts.join(", ")}</div>}
          {e.exercise_list?.length > 0 && <div className="planner-field"><span className="planner-label">Exercises:</span> {e.exercise_list.join(", ")}</div>}
          {e.photos?.length > 0 && <div className="photo-strip" style={{ marginTop: 8 }}>{e.photos.map((p, i) => <div className="photo-thumb photo-thumb-view" key={i}><img src={p} alt="" /></div>)}</div>}
        </div>
      ))}
    </div>
  );
}

/* ---------- attendance ---------- */


function AttendancePanel({ userId, classes }) {
  const [classId, setClassId] = useState(classes[0]?.id || "");
  useEffect(() => { if (!classId && classes[0]) setClassId(classes[0].id); }, [classes, classId]);
  const [date, setDate] = useState(todayKey());
  const [record, setRecord] = useState(null);
  const cls = classes.find((c) => c.id === classId);

  useEffect(() => { (async () => { if (classId) setRecord(await db.fetchAttendance(userId, classId, date)); })(); }, [userId, classId, date]);

  // Working day default: everyone present unless explicitly marked absent.
  const present = record?.present || {};
  const isDayOff = !!record?.is_day_off;
  const isPresent = (studentId) => present[studentId] !== false;

  const toggleAbsent = async (studentId) => {
    const next = { ...present, [studentId]: isPresent(studentId) ? false : true };
    const saved = await db.upsertAttendance(userId, classId, date, next, false);
    setRecord(saved);
  };
  const toggleDayOff = async () => {
    const saved = await db.upsertAttendance(userId, classId, date, present, !isDayOff);
    setRecord(saved);
  };

  const presentCount = cls ? cls.students.filter((s) => isPresent(s.id)).length : 0;

  return (
    <div>
      <div className="card">
        <div className="row-2">
          <div><div className="field-label">Class</div><ClassPicker classes={classes} value={classId} onChange={setClassId} /></div>
          <div><div className="field-label">Date</div><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        </div>
        <div className="toggle-row">
          <div><div className="toggle-label">Day off</div><div className="toggle-sub">No attendance taken for this date</div></div>
          <div className={`switch ${isDayOff ? "on" : ""}`} onClick={toggleDayOff}><div className="switch-knob" /></div>
        </div>
      </div>
      {cls && isDayOff && <div className="card"><div className="empty">Marked as a day off \u2014 no attendance for {date}.</div></div>}
      {cls && !isDayOff && (
        <div className="card">
          <div className="card-title-row"><div className="card-title" style={{ marginBottom: 0 }}>Attendance</div><div className="card-sub">{presentCount}/{cls.students.length} present \u00b7 everyone present by default</div></div>
          {cls.students.map((s) => (
            <label key={s.id} className={`attendance-row ${isPresent(s.id) ? "present" : "absent"}`}>
              <span>{s.name}</span>
              <input type="checkbox" checked={!isPresent(s.id)} onChange={() => toggleAbsent(s.id)} />
            </label>
          ))}
          <div className="legend">checkbox marks a student absent \u2014 unchecked means present</div>
        </div>
      )}
    </div>
  );
}

/* ---------- absences & concepts missed ---------- */

function AbsencePanel({ userId, classes }) {
  const [classId, setClassId] = useState(classes[0]?.id || "");
  useEffect(() => { if (!classId && classes[0]) setClassId(classes[0].id); }, [classes, classId]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const cls = classes.find((c) => c.id === classId);

  useEffect(() => {
    (async () => {
      if (!classId || !cls) return;
      setLoading(true);
      const studentsById = Object.fromEntries(cls.students.map((s) => [s.id, s.name]));
      setRows(await db.fetchAbsenceConceptReport(userId, classId, studentsById));
      setLoading(false);
    })();
  }, [userId, classId, cls]);

  return (
    <div>
      <div className="card">
        <div className="field-label">Class</div>
        <ClassPicker classes={classes} value={classId} onChange={setClassId} />
      </div>
      <div className="card">
        <div className="card-title">Absences & concepts missed</div>
        {loading ? <div className="card-sub">Loading\u2026</div> : rows.length === 0 ? (
          <div className="card-sub">No absences recorded for this class yet.</div>
        ) : rows.map((r, i) => (
          <div className="marks-row" key={i}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>{r.studentName}</div>
              <div className="card-sub mono">{r.date}</div>
            </div>
            <div style={{ textAlign: "right", fontSize: 12.5, color: r.chapter ? "#33302B" : "#9c9488", maxWidth: 160 }}>
              {r.chapter || "No lesson logged"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- correction ---------- */

function CorrectionPanel({ userId, classes }) {
  const [classId, setClassId] = useState(classes[0]?.id || "");
  useEffect(() => { if (!classId && classes[0]) setClassId(classes[0].id); }, [classes, classId]);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState(""); const [type, setType] = useState(""); const [date, setDate] = useState(todayKey());
  const [chapterNumber, setChapterNumber] = useState("");
  const [linkedConcepts, setLinkedConcepts] = useState([]);
  const [linkedExercises, setLinkedExercises] = useState([]);
  const [records, setRecords] = useState([]);
  const [correctionTypes, setCorrectionTypes] = useState(DEFAULT_CORRECTION_TYPES);
  const [chapterNumbers, setChapterNumbers] = useState([]);
  const [incomplete, setIncomplete] = useState([]);
  const [showIncomplete, setShowIncomplete] = useState(false);
  const cls = classes.find((c) => c.id === classId);

  const load = useCallback(async () => {
    if (!classId) return;
    const [recs, types, numbers] = await Promise.all([
      db.fetchCorrectionRecords(userId, classId), db.fetchCorrectionTypes(userId), db.fetchChapterNumbers(userId, classId),
    ]);
    setRecords(recs);
    setCorrectionTypes([...new Set([...DEFAULT_CORRECTION_TYPES, ...types])]);
    setChapterNumbers(numbers);
  }, [userId, classId]);
  useEffect(() => { load(); }, [load]);

  const loadIncomplete = useCallback(async () => {
    if (!classId || !cls) return;
    const studentsById = Object.fromEntries(cls.students.map((s) => [s.id, s.name]));
    setIncomplete(await db.fetchIncompleteTasks(userId, classId, studentsById));
  }, [userId, classId, cls]);
  useEffect(() => { if (showIncomplete) loadIncomplete(); }, [showIncomplete, loadIncomplete]);

  const onChapterNumberBlur = async () => {
    if (!chapterNumber.trim()) { setLinkedConcepts([]); setLinkedExercises([]); return; }
    const match = await db.fetchChapterNameForNumber(userId, classId, chapterNumber);
    setLinkedConcepts(match?.concepts || []);
    setLinkedExercises(match?.exercise_list || []);
  };

  const createRecord = async () => {
    if (!title.trim() || !type.trim() || !cls) return;
    await db.createCorrectionRecord(userId, classId, date, title, type.trim(), chapterNumber.trim() || null, linkedConcepts, linkedExercises);
    setTitle(""); setType(""); setChapterNumber(""); setLinkedConcepts([]); setLinkedExercises([]); setCreating(false);
    load();
  };
  const cycle = async (record, studentId) => {
    const cur = record.marks[studentId] || "blank";
    const next = CORRECTION_CODES[(CORRECTION_CODES.indexOf(cur) + 1) % CORRECTION_CODES.length];
    const marks = { ...record.marks, [studentId]: next };
    await db.updateCorrectionMarks(record.id, marks);
    setRecords((prev) => prev.map((r) => r.id === record.id ? { ...r, marks } : r));
    if (showIncomplete) loadIncomplete();
  };
  const markTaskDone = async (task) => {
    const record = records.find((r) => r.id === task.recordId);
    const marks = { ...(record ? record.marks : task.marks), [task.studentId]: "done" };
    await db.updateCorrectionMarks(task.recordId, marks);
    setRecords((prev) => prev.map((r) => r.id === task.recordId ? { ...r, marks } : r));
    setIncomplete((prev) => prev.filter((t) => !(t.recordId === task.recordId && t.studentId === task.studentId)));
  };
  const removeRecord = async (id) => { await db.deleteCorrectionRecord(id); load(); };

  return (
    <div>
      <div className="card">
        <div className="field-label">Class</div>
        <ClassPicker classes={classes} value={classId} onChange={setClassId} />
        {!creating ? (
          <button className="btn btn-primary" style={{ marginTop: 10 }} onClick={() => setCreating(true)}><Plus size={14} /> New correction record</button>
        ) : (
          <>
            <div className="row-2" style={{ marginTop: 10 }}>
              <input className="input" placeholder="Assignment title" value={title} onChange={(e) => setTitle(e.target.value)} />
              <input className="input" list="correction-types" placeholder="Type (e.g. Homework)" value={type} onChange={(e) => setType(e.target.value)} />
              <datalist id="correction-types">{correctionTypes.map((t) => <option key={t} value={t} />)}</datalist>
            </div>
            <input type="date" className="input" style={{ marginTop: 8 }} value={date} onChange={(e) => setDate(e.target.value)} />
            <div className="field-label">Chapter number (optional \u2014 links concepts from the Planner)</div>
            <input className="input" list="chapter-numbers-correction" value={chapterNumber} onChange={(e) => setChapterNumber(e.target.value)} onBlur={onChapterNumberBlur} />
            <datalist id="chapter-numbers-correction">{chapterNumbers.map((n) => <option key={n} value={n} />)}</datalist>
            {(linkedConcepts.length > 0 || linkedExercises.length > 0) && (
              <div className="autofill-hint">
                {linkedConcepts.length > 0 && <>Concepts: {linkedConcepts.join(", ")}<br /></>}
                {linkedExercises.length > 0 && <>Exercises: {linkedExercises.join(", ")}</>}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button className="btn btn-ghost" onClick={() => setCreating(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={createRecord}>Create</button>
            </div>
          </>
        )}
      </div>

      {cls && (
        <div className="card">
          <button className="expand-toggle" style={{ paddingTop: 0 }} onClick={() => setShowIncomplete(!showIncomplete)}>
            {showIncomplete ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Incomplete tasks
          </button>
          {showIncomplete && (
            incomplete.length === 0 ? <div className="card-sub" style={{ marginTop: 8 }}>Nothing marked incomplete for this class.</div> :
            incomplete.map((t) => (
              <div className="marks-row" key={`${t.recordId}-${t.studentId}`}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>{t.studentName}</div>
                  <div className="card-sub">{t.title} <span className="badge-mini">{t.type}</span> \u00b7 <span className="mono">{t.date}</span></div>
                </div>
                <button className="btn btn-done" onClick={() => markTaskDone(t)}><Check size={13} /> Done</button>
              </div>
            ))
          )}
        </div>
      )}

      {cls && records.map((r) => (
        <div className="card" key={r.id}>
          <div className="card-title-row">
            <div>
              <div className="card-title" style={{ marginBottom: 0 }}>{r.title} <span className="badge-mini">{r.type}</span></div>
              <div className="card-sub mono">{r.date}{r.chapter_number ? ` \u00b7 Ch ${r.chapter_number}` : ""}</div>
              {r.concepts?.length > 0 && <div className="card-sub">Concepts: {r.concepts.join(", ")}</div>}
            </div>
            <button className="btn btn-icon" onClick={() => removeRecord(r.id)}><Trash2 size={13} /></button>
          </div>
          <div className="grid-table">
            {cls.students.map((s) => {
              const code = r.marks[s.id] || "blank";
              return (
                <button key={s.id} className={`grid-cell code-${code}`} onClick={() => cycle(r, s.id)}>
                  <span className="grid-cell-name">{s.name}</span><span className="grid-cell-code">{CORRECTION_LABELS[code]}</span>
                </button>
              );
            })}
          </div>
          <div className="legend">tap to cycle \u00b7 blank \u2192 done \u2192 ab absent \u2192 ic incomplete</div>
        </div>
      ))}
    </div>
  );
}

/* ---------- performance ---------- */

function PerformancePanel({ userId, classes }) {
  const [classId, setClassId] = useState(classes[0]?.id || "");
  useEffect(() => { if (!classId && classes[0]) setClassId(classes[0].id); }, [classes, classId]);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState(""); const [testType, setTestType] = useState("CT"); const [maxMarks, setMaxMarks] = useState(20);
  const [chapterCount, setChapterCount] = useState("");
  const [exercises, setExercises] = useState("");
  const [conceptsInput, setConceptsInput] = useState("");
  const [records, setRecords] = useState([]);
  const [expanded, setExpanded] = useState({});
  const cls = classes.find((c) => c.id === classId);

  const load = useCallback(async () => { if (classId) setRecords(await db.fetchPerformanceRecords(userId, classId)); }, [userId, classId]);
  useEffect(() => { load(); }, [load]);

  const createRecord = async () => {
    if (!title.trim() || !cls) return;
    let concepts = conceptsInput.split(",").map((c) => c.trim()).filter(Boolean);
    if (concepts.length === 0) {
      concepts = await db.fetchPlannerChapters(userId, classId); // fall back to everything logged in the planner
    }
    await db.createPerformanceRecord(userId, classId, title, testType, Number(maxMarks), chapterCount ? Number(chapterCount) : null, exercises.trim() || null, concepts);
    setTitle(""); setChapterCount(""); setExercises(""); setConceptsInput(""); setCreating(false);
    load();
  };
  const setMark = async (record, studentId, val) => {
    const marks = { ...record.marks, [studentId]: val === "" ? null : Number(val) };
    await db.updatePerformanceMarks(record.id, marks);
    setRecords((prev) => prev.map((r) => r.id === record.id ? { ...r, marks } : r));
  };
  const cycleConceptTag = async (record, concept, studentId) => {
    const cur = record.concept_marks?.[studentId]?.[concept] || "blank";
    const next = CONCEPT_TAGS[(CONCEPT_TAGS.indexOf(cur) + 1) % CONCEPT_TAGS.length];
    const conceptMarks = await db.updateConceptMark(record.id, record.concept_marks || {}, studentId, concept, next);
    setRecords((prev) => prev.map((r) => r.id === record.id ? { ...r, concept_marks: conceptMarks } : r));
  };
  const removeRecord = async (id) => { await db.deletePerformanceRecord(id); load(); };
  const average = (r) => {
    const vals = Object.values(r.marks).filter((v) => v !== null && v !== undefined);
    if (!vals.length) return "\u2014";
    return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
  };

  return (
    <div>
      <div className="card">
        <div className="field-label">Class</div>
        <ClassPicker classes={classes} value={classId} onChange={setClassId} />
        {!creating ? (
          <button className="btn btn-primary" style={{ marginTop: 10 }} onClick={() => setCreating(true)}><Plus size={14} /> New test record</button>
        ) : (
          <>
            <div className="row-2" style={{ marginTop: 10 }}>
              <input className="input" placeholder="Test title" value={title} onChange={(e) => setTitle(e.target.value)} />
              <select className="input" value={testType} onChange={(e) => setTestType(e.target.value)}>{TEST_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
            </div>
            <div className="field-label">Max marks</div>
            <input type="number" className="input" value={maxMarks} onChange={(e) => setMaxMarks(e.target.value)} />
            <div className="field-label">Number of chapters involved</div>
            <input type="number" min="0" className="input" placeholder="e.g. 2" value={chapterCount} onChange={(e) => setChapterCount(e.target.value)} />
            <div className="field-label">Exercises (optional)</div>
            <input className="input" placeholder="e.g. Ex 3.1, 3.2" value={exercises} onChange={(e) => setExercises(e.target.value)} />
            <div className="field-label">Concepts covered (optional, comma-separated)</div>
            <input className="input" placeholder="Leave blank to pull every concept logged in the Planner for this class" value={conceptsInput} onChange={(e) => setConceptsInput(e.target.value)} />
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button className="btn btn-ghost" onClick={() => setCreating(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={createRecord}>Create</button>
            </div>
          </>
        )}
      </div>
      {cls && records.map((r) => {
        const isOpen = !!expanded[r.id];
        return (
          <div className="card" key={r.id}>
            <div className="card-title-row">
              <div>
                <div className="card-title" style={{ marginBottom: 0 }}>{r.title} <span className="badge-mini">{r.test_type}</span></div>
                <div className="card-sub">Out of {r.max_marks} \u00b7 Class avg {average(r)}{r.chapter_count ? ` \u00b7 ${r.chapter_count} chapters` : ""}</div>
                {r.exercises && <div className="card-sub">Exercises: {r.exercises}</div>}
              </div>
              <button className="btn btn-icon" onClick={() => removeRecord(r.id)}><Trash2 size={13} /></button>
            </div>
            {cls.students.map((s) => (
              <div className="marks-row" key={s.id}>
                <span>{s.name}</span>
                <input type="number" className="input marks-input" max={r.max_marks} value={r.marks[s.id] ?? ""} onChange={(e) => setMark(r, s.id, e.target.value)} placeholder="\u2013" />
              </div>
            ))}
            {(r.concepts || []).length > 0 && (
              <>
                <button className="expand-toggle" onClick={() => setExpanded({ ...expanded, [r.id]: !isOpen })}>
                  {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Concept breakdown
                </button>
                {isOpen && r.concepts.map((concept) => (
                  <div className="concept-block" key={concept}>
                    <div className="concept-block-title">{concept}</div>
                    <div className="grid-table">
                      {cls.students.map((s) => {
                        const tag = r.concept_marks?.[s.id]?.[concept] || "blank";
                        return (
                          <button key={s.id} className={`grid-cell tag-${tag}`} title={CONCEPT_TAG_TITLES[tag]} onClick={() => cycleConceptTag(r, concept, s.id)}>
                            <span className="grid-cell-name">{s.name}</span>
                            <span className="grid-cell-code">{CONCEPT_TAG_LABELS[tag]}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {isOpen && <div className="legend">tap to cycle \u00b7 accurate \u2192 application gap \u2192 silly mistake \u2192 concept gap</div>}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---------- shell ---------- */

export default function Teach({ userId, classes, reloadClasses }) {
  const [sub, setSub] = useState("planner");
  return (
    <div className="page">
      <Segmented
        options={[
          { value: "planner", label: "Planner", icon: ClipboardList },
          { value: "attendance", label: "Attendance", icon: ClipboardCheck },
          { value: "correction", label: "Correction", icon: Check },
          { value: "performance", label: "Scores", icon: BarChart3 },
          { value: "absences", label: "Absences", icon: UserX },
          { value: "classes", label: "Classes", icon: Users },
        ]}
        value={sub} onChange={setSub}
      />
      {sub === "planner" && <PlannerPanel userId={userId} classes={classes} />}
      {sub === "attendance" && <AttendancePanel userId={userId} classes={classes} />}
      {sub === "correction" && <CorrectionPanel userId={userId} classes={classes} />}
      {sub === "performance" && <PerformancePanel userId={userId} classes={classes} />}
      {sub === "absences" && <AbsencePanel userId={userId} classes={classes} />}
      {sub === "classes" && <ClassesPanel userId={userId} classes={classes} reloadClasses={reloadClasses} />}
    </div>
  );
}

import React, { useEffect, useState, useCallback } from "react";
import { Plus, X, Trash2, UserPlus, ClipboardList, ClipboardCheck, Check, BarChart3, Users } from "lucide-react";
import { Segmented } from "../components/Shared";
import PhotoStrip from "../components/PhotoStrip";
import { TEST_TYPES, CORRECTION_CODES, CORRECTION_LABELS } from "../lib/constants";
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
  const [form, setForm] = useState({ chapter: "", objectives: "", methodology: "", resources: "", assignment: "", reflection: "", photos: [] });
  const [entries, setEntries] = useState([]);

  const load = useCallback(async () => { if (classId) setEntries(await db.fetchPlannerEntries(userId, classId)); }, [userId, classId]);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!classId || !form.chapter.trim()) return;
    await db.createPlannerEntry(userId, classId, date, form);
    setForm({ chapter: "", objectives: "", methodology: "", resources: "", assignment: "", reflection: "", photos: [] });
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
        <div className="field-label">Chapter / Unit</div>
        <input className="input" value={form.chapter} onChange={(e) => setForm({ ...form, chapter: e.target.value })} />
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
        <div className="field-label">Photos (board work, worksheets, textbook pages\u2026)</div>
        <PhotoStrip photos={form.photos} onAdd={(url) => setForm({ ...form, photos: [...form.photos, url] })} onRemove={(pi) => setForm({ ...form, photos: form.photos.filter((_, idx) => idx !== pi) })} max={6} />
        <button className="btn btn-primary" style={{ marginTop: 12, width: "100%" }} onClick={save}><Plus size={14} /> Save entry</button>
      </div>
      {entries.map((e) => (
        <div className="card planner-entry" key={e.id}>
          <div className="card-title-row"><div className="card-sub mono">{e.date}</div><button className="btn btn-icon" onClick={() => remove(e.id)}><Trash2 size={13} /></button></div>
          <div className="planner-field"><b>{e.chapter}</b></div>
          {e.objectives && <div className="planner-field"><span className="planner-label">Objectives:</span> {e.objectives}</div>}
          {e.methodology && <div className="planner-field"><span className="planner-label">Methodology:</span> {e.methodology}</div>}
          {e.assignment && <div className="planner-field"><span className="planner-label">Assignment:</span> {e.assignment}</div>}
          {e.reflection && <div className="planner-field"><span className="planner-label">Reflection:</span> {e.reflection}</div>}
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

  const toggle = async (studentId) => {
    const present = { ...(record?.present || {}), [studentId]: !(record?.present || {})[studentId] };
    const saved = await db.upsertAttendance(userId, classId, date, present);
    setRecord(saved);
  };
  const present = record?.present || {};
  const presentCount = cls ? cls.students.filter((s) => present[s.id]).length : 0;

  return (
    <div>
      <div className="card">
        <div className="row-2">
          <div><div className="field-label">Class</div><ClassPicker classes={classes} value={classId} onChange={setClassId} /></div>
          <div><div className="field-label">Date</div><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        </div>
      </div>
      {cls && (
        <div className="card">
          <div className="card-title-row"><div className="card-title" style={{ marginBottom: 0 }}>Attendance</div><div className="card-sub">{presentCount}/{cls.students.length} present</div></div>
          {cls.students.map((s) => (
            <label key={s.id} className={`attendance-row ${present[s.id] ? "present" : "absent"}`}>
              <span>{s.name}</span>
              <input type="checkbox" checked={!!present[s.id]} onChange={() => toggle(s.id)} />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- correction ---------- */

function CorrectionPanel({ userId, classes }) {
  const [classId, setClassId] = useState(classes[0]?.id || "");
  useEffect(() => { if (!classId && classes[0]) setClassId(classes[0].id); }, [classes, classId]);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState(""); const [type, setType] = useState("CW"); const [date, setDate] = useState(todayKey());
  const [records, setRecords] = useState([]);
  const cls = classes.find((c) => c.id === classId);

  const load = useCallback(async () => { if (classId) setRecords(await db.fetchCorrectionRecords(userId, classId)); }, [userId, classId]);
  useEffect(() => { load(); }, [load]);

  const createRecord = async () => {
    if (!title.trim() || !cls) return;
    await db.createCorrectionRecord(userId, classId, date, title, type);
    setTitle(""); setCreating(false); load();
  };
  const cycle = async (record, studentId) => {
    const cur = record.marks[studentId] || "blank";
    const next = CORRECTION_CODES[(CORRECTION_CODES.indexOf(cur) + 1) % CORRECTION_CODES.length];
    const marks = { ...record.marks, [studentId]: next };
    await db.updateCorrectionMarks(record.id, marks);
    setRecords((prev) => prev.map((r) => r.id === record.id ? { ...r, marks } : r));
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
              <select className="input" value={type} onChange={(e) => setType(e.target.value)}><option value="CW">CW</option><option value="HW">HW</option></select>
            </div>
            <input type="date" className="input" style={{ marginTop: 8 }} value={date} onChange={(e) => setDate(e.target.value)} />
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button className="btn btn-ghost" onClick={() => setCreating(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={createRecord}>Create</button>
            </div>
          </>
        )}
      </div>
      {cls && records.map((r) => (
        <div className="card" key={r.id}>
          <div className="card-title-row">
            <div><div className="card-title" style={{ marginBottom: 0 }}>{r.title} <span className="badge-mini">{r.type}</span></div><div className="card-sub mono">{r.date}</div></div>
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
  const [records, setRecords] = useState([]);
  const cls = classes.find((c) => c.id === classId);

  const load = useCallback(async () => { if (classId) setRecords(await db.fetchPerformanceRecords(userId, classId)); }, [userId, classId]);
  useEffect(() => { load(); }, [load]);

  const createRecord = async () => {
    if (!title.trim() || !cls) return;
    await db.createPerformanceRecord(userId, classId, title, testType, Number(maxMarks));
    setTitle(""); setCreating(false); load();
  };
  const setMark = async (record, studentId, val) => {
    const marks = { ...record.marks, [studentId]: val === "" ? null : Number(val) };
    await db.updatePerformanceMarks(record.id, marks);
    setRecords((prev) => prev.map((r) => r.id === record.id ? { ...r, marks } : r));
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
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button className="btn btn-ghost" onClick={() => setCreating(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={createRecord}>Create</button>
            </div>
          </>
        )}
      </div>
      {cls && records.map((r) => (
        <div className="card" key={r.id}>
          <div className="card-title-row">
            <div><div className="card-title" style={{ marginBottom: 0 }}>{r.title} <span className="badge-mini">{r.test_type}</span></div><div className="card-sub">Out of {r.max_marks} \u00b7 Class avg {average(r)}</div></div>
            <button className="btn btn-icon" onClick={() => removeRecord(r.id)}><Trash2 size={13} /></button>
          </div>
          {cls.students.map((s) => (
            <div className="marks-row" key={s.id}>
              <span>{s.name}</span>
              <input type="number" className="input marks-input" max={r.max_marks} value={r.marks[s.id] ?? ""} onChange={(e) => setMark(r, s.id, e.target.value)} placeholder="\u2013" />
            </div>
          ))}
        </div>
      ))}
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
          { value: "classes", label: "Classes", icon: Users },
        ]}
        value={sub} onChange={setSub}
      />
      {sub === "planner" && <PlannerPanel userId={userId} classes={classes} />}
      {sub === "attendance" && <AttendancePanel userId={userId} classes={classes} />}
      {sub === "correction" && <CorrectionPanel userId={userId} classes={classes} />}
      {sub === "performance" && <PerformancePanel userId={userId} classes={classes} />}
      {sub === "classes" && <ClassesPanel userId={userId} classes={classes} reloadClasses={reloadClasses} />}
    </div>
  );
}

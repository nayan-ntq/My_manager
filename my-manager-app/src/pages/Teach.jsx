import React, { useEffect, useState, useCallback } from "react";
import { Plus, X, UserPlus, ClipboardList, ClipboardCheck, Check, BarChart3, Users, ChevronRight, ChevronDown, ChevronLeft, UserX, CalendarClock, Building2, ShieldCheck, Star, Filter, BookOpen } from "lucide-react";
import { Segmented } from "../components/Shared";
import PhotoImportButton from "../components/PhotoImportButton";
import CsvReviewSheet from "../components/CsvReviewSheet";
import ConceptTable from "../components/ConceptTable";
import PlannerImportReviewSheet from "../components/PlannerImportReviewSheet";
import HistorySheet from "../components/HistorySheet";
import CorrectionRegisterTable from "../components/CorrectionRegisterTable";
import ConceptQuickSheet from "../components/ConceptQuickSheet";
import { parseCSV, matchStudentName } from "../lib/visionImport";
import { CORRECTION_CODES, CORRECTION_MARKS, CORRECTION_TITLES, CONCEPT_TAGS, CONCEPT_TAG_TITLES, DEFAULT_CORRECTION_TYPES, DEFAULT_TEST_TYPES, CORRECTION_CONCEPT_STATUSES, CORRECTION_CONCEPT_TITLES, CORRECTION_CONCEPT_NEEDS_VALUE, MEDIUM_OPTIONS } from "../lib/constants";
import GridMark from "../components/GridMark";
import ConfirmDelete from "../components/ConfirmDelete";
import { toast } from "../components/Toast";
import * as db from "../lib/db";
import * as school from "../lib/school";
import AdminPanel from "../components/AdminPanel";
import SignoffPanel from "../components/SignoffPanel";

function todayKey() { return new Date().toISOString().slice(0, 10); }

/* ---------- classes ---------- */

function ClassEditSheet({ cls, onClose, onSave, onDelete }) {
  const [name, setName] = useState(cls.name);
  const [subject, setSubject] = useState(cls.subject || "");
  const [grade, setGrade] = useState(cls.grade || "");

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2 className="sheet-title">Edit class</h2>
          <button type="button" className="btn btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="field-label">Class name</div>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <div className="row-2">
          <div><div className="field-label">Subject</div><input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
          <div><div className="field-label">Grade</div><input className="input" placeholder="e.g. 6" value={grade} onChange={(e) => setGrade(e.target.value)} /></div>
        </div>
        <div className="sheet-actions">
          <ConfirmDelete onConfirm={() => { onDelete(); onClose(); }} size={14} />
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={() => name.trim() && onSave({ name: name.trim(), subject: subject.trim() || null, grade: grade.trim() || null })}>Save</button>
        </div>
      </div>
    </div>
  );
}

function StudentEditSheet({ student, onClose, onSave, onDelete }) {
  const [name, setName] = useState(student.name);
  const [rollNo, setRollNo] = useState(student.roll_no || "");
  const [contact, setContact] = useState(student.contact || "");
  const [notes, setNotes] = useState(student.notes || "");

  const save = () => {
    if (!name.trim()) return;
    onSave({ name: name.trim(), roll_no: rollNo.trim() || null, contact: contact.trim() || null, notes: notes.trim() || null });
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2 className="sheet-title">Edit student</h2>
          <button type="button" className="btn btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="field-label">Name</div>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <div className="row-2">
          <div><div className="field-label">Roll no.</div><input className="input" value={rollNo} onChange={(e) => setRollNo(e.target.value)} /></div>
          <div><div className="field-label">Contact</div><input className="input" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Phone or email" /></div>
        </div>
        <div className="field-label">Notes</div>
        <textarea className="input textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything worth remembering about this student" />
        <div className="sheet-actions">
          <ConfirmDelete onConfirm={() => { onDelete(); onClose(); }} size={14} />
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={save}>Save</button>
        </div>
      </div>
    </div>
  );
}

function ClassesPanel({ userId, classes, reloadClasses }) {
  const [name, setName] = useState(""); const [subject, setSubject] = useState(""); const [grade, setGrade] = useState("");
  const [studentInput, setStudentInput] = useState({});
  const [editingStudent, setEditingStudent] = useState(null);
  const [editingClass, setEditingClass] = useState(null);
  const [rosterImport, setRosterImport] = useState(null); // { classId, csv }

  const addClass = async () => {
    if (!name.trim()) return;
    await db.createClass(userId, name, subject, grade);
    setName(""); setSubject(""); setGrade(""); reloadClasses();
    toast("Class added");
  };
  const addStudent = async (classId) => {
    const val = (studentInput[classId] || "").trim();
    if (!val) return;
    const cls = classes.find((c) => c.id === classId);
    await db.addStudent(userId, classId, val, cls.students.length);
    setStudentInput({ ...studentInput, [classId]: "" });
    reloadClasses();
  };
  const removeStudent = async (id) => { await db.removeStudent(id); reloadClasses(); toast("Student removed"); };
  const saveStudent = async (id, patch) => {
    await db.updateStudent(id, patch);
    setEditingStudent(null);
    reloadClasses();
    toast("Student updated");
  };
  const removeClass = async (id) => { await db.deleteClass(id); reloadClasses(); toast("Class deleted"); };
  const saveClass = async (id, patch) => { await db.updateClass(id, patch); setEditingClass(null); reloadClasses(); toast("Class updated"); };

  const importRoster = async (classId, rows) => {
    const cls = classes.find((c) => c.id === classId);
    let position = cls.students.length;
    for (const row of rows) {
      const rowName = row.name?.trim();
      if (!rowName) continue;
      await db.addStudent(userId, classId, rowName, position++, row.roll_no ? { roll_no: row.roll_no.trim() } : undefined);
    }
    await db.createImportLog(userId, "roster", cls.name, rosterImport.csv, rows.length);
    setRosterImport(null);
    reloadClasses();
    toast(`Imported ${rows.length} students`);
  };

  return (
    <div>
      <div className="card">
        <div className="card-title">New class</div>
        <div className="row-2">
          <input className="input" placeholder="Class name (e.g. 6B - Maths)" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="input" placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <input className="input" style={{ marginTop: 8 }} placeholder="Grade (e.g. 6) - groups sections together for a shared concept list later" value={grade} onChange={(e) => setGrade(e.target.value)} />
        <button className="btn btn-primary" style={{ marginTop: 10 }} onClick={addClass}><Plus size={14} /> Add class</button>
      </div>
      {classes.map((c) => (
        <div className="card" key={c.id}>
          <div className="card-title-row">
            <div style={{ cursor: "pointer" }} onClick={() => setEditingClass(c)}><div className="card-title" style={{ marginBottom: 0 }}>{c.name}</div><div className="card-sub">{c.subject}  |  {c.students.length} students</div></div>
            <ConfirmDelete onConfirm={() => removeClass(c.id)} size={14} />
          </div>
          <div className="student-chip-wrap">
            {c.students.map((s) => (
              <button type="button" className="student-chip student-chip-editable" key={s.id} onClick={() => setEditingStudent(s)}>
                {s.name}{s.roll_no ? ` (${s.roll_no})` : ""}
              </button>
            ))}
          </div>
          <div className="row-2" style={{ marginTop: 10 }}>
            <input className="input" placeholder="Add student name" value={studentInput[c.id] || ""} onChange={(e) => setStudentInput({ ...studentInput, [c.id]: e.target.value })} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addStudent(c.id))} />
            <button type="button" className="btn btn-ghost" onClick={() => addStudent(c.id)}><UserPlus size={14} /></button>
          </div>
          <div style={{ marginTop: 8 }}>
            <PhotoImportButton kind="roster" onResult={({ csv }) => setRosterImport({ classId: c.id, csv })} label="Import roster from photo" />
          </div>
        </div>
      ))}
      {editingStudent && (
        <StudentEditSheet
          student={editingStudent}
          onClose={() => setEditingStudent(null)}
          onSave={(patch) => saveStudent(editingStudent.id, patch)}
          onDelete={() => removeStudent(editingStudent.id)}
        />
      )}
      {editingClass && (
        <ClassEditSheet
          cls={editingClass}
          onClose={() => setEditingClass(null)}
          onSave={(patch) => saveClass(editingClass.id, patch)}
          onDelete={() => removeClass(editingClass.id)}
        />
      )}
      {rosterImport && (
        <CsvReviewSheet
          title="Import roster"
          csv={rosterImport.csv}
          columns={["name", "roll_no"]}
          onClose={() => setRosterImport(null)}
          onConfirm={(rows) => importRoster(rosterImport.classId, rows)}
        />
      )}
    </div>
  );
}

function ClassPicker({ classes, value, onChange }) {
  if (classes.length === 0) return <div className="empty">Add a class first, in the Classes tab.</div>;
  return <select className="input" value={value || ""} onChange={(e) => onChange(e.target.value)}>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>;
}

/* ---------- planner ---------- */

/** Repeatable list of {text, medium, important} rows - used for both Classwork (from
 *  Methodology) and Homework (from Assignment) on a planner entry. */
function ConceptItemList({ label, items, onChange }) {
  const addRow = () => onChange([...items, { text: "", medium: "", important: false }]);
  const updateRow = (i, patch) => onChange(items.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  const removeRow = (i) => onChange(items.filter((_, idx) => idx !== i));

  return (
    <div style={{ marginTop: 14 }}>
      <div className="field-label" style={{ marginTop: 0 }}>{label}</div>
      {items.map((it, i) => (
        <div key={i} className="concept-item-row">
          <input className="input" placeholder="Question / concept" value={it.text} onChange={(e) => updateRow(i, { text: e.target.value })} />
          <select className="input concept-item-medium" value={it.medium} onChange={(e) => updateRow(i, { medium: e.target.value })}>
            <option value="">Medium...</option>
            {MEDIUM_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <button type="button" className={`btn btn-icon concept-item-star ${it.important ? "on" : ""}`} title="Mark important" onClick={() => updateRow(i, { important: !it.important })}><Star size={13} fill={it.important ? "currentColor" : "none"} /></button>
          <button type="button" className="btn btn-icon" onClick={() => removeRow(i)}><X size={13} /></button>
        </div>
      ))}
      <button type="button" className="chip-btn" onClick={addRow}><Plus size={12} /> Add {label.toLowerCase()}</button>
    </div>
  );
}

function PlannerEntryEditSheet({ entry, onClose, onSave }) {
  const [form, setForm] = useState({
    chapter_number: entry.chapter_number || "", chapter: entry.chapter || "",
    objectives: entry.objectives || "", methodology: entry.methodology || "", resources: entry.resources || "",
    assignment: entry.assignment || "", reflection: entry.reflection || "",
    classworkItems: entry.classwork_items?.length ? entry.classwork_items : (entry.concepts || []).map((t) => ({ text: t, medium: "", important: false })),
    homeworkItems: entry.homework_items?.length ? entry.homework_items : (entry.exercise_list || []).map((t) => ({ text: t, medium: "", important: false })),
  });

  const save = () => {
    if (!form.chapter.trim()) return;
    const clean = (items) => items.map((it) => ({ ...it, text: it.text.trim() })).filter((it) => it.text);
    onSave({
      chapter_number: form.chapter_number.trim() || null, chapter: form.chapter,
      objectives: form.objectives, methodology: form.methodology, resources: form.resources,
      assignment: form.assignment, reflection: form.reflection,
      classwork_items: clean(form.classworkItems), homework_items: clean(form.homeworkItems),
      concepts: clean(form.classworkItems).map((it) => it.text), exercise_list: clean(form.homeworkItems).map((it) => it.text),
    });
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2 className="sheet-title">Edit planner entry</h2>
          <button type="button" className="btn btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="row-2">
          <div><div className="field-label">Chapter number</div><input className="input" value={form.chapter_number} onChange={(e) => setForm({ ...form, chapter_number: e.target.value })} /></div>
          <div><div className="field-label">Chapter name</div><input className="input" value={form.chapter} onChange={(e) => setForm({ ...form, chapter: e.target.value })} /></div>
        </div>
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
        <ConceptItemList label="Classwork" items={form.classworkItems} onChange={(items) => setForm({ ...form, classworkItems: items })} />
        <ConceptItemList label="Homework" items={form.homeworkItems} onChange={(items) => setForm({ ...form, homeworkItems: items })} />
        <div className="sheet-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={save}>Save</button>
        </div>
      </div>
    </div>
  );
}

function PlannerPanel({ userId, classes, mySchool }) {
  const [classId, setClassId] = useState(classes[0]?.id || "");
  useEffect(() => { if (!classId && classes[0]) setClassId(classes[0].id); }, [classes, classId]);
  const [date, setDate] = useState(todayKey());
  const [form, setForm] = useState({ chapter_number: "", chapter: "", objectives: "", methodology: "", resources: "", assignment: "", reflection: "", classworkItems: [], homeworkItems: [] });
  const [entries, setEntries] = useState([]);
  const [chapterNumbers, setChapterNumbers] = useState([]);
  const [syllabusChapters, setSyllabusChapters] = useState([]);
  const [autoFilled, setAutoFilled] = useState(false);
  const [importReview, setImportReview] = useState(null); // array of extracted entries, pre-confirm
  const [editingEntry, setEditingEntry] = useState(null);
  const cls = classes.find((c) => c.id === classId);

  const load = useCallback(async () => {
    if (!classId) return;
    const [entryRows, numbers] = await Promise.all([db.fetchPlannerEntries(userId, classId), db.fetchChapterNumbers(userId, classId)]);
    setEntries(entryRows); setChapterNumbers(numbers);
  }, [userId, classId]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!cls?.grade) { setSyllabusChapters([]); return; }
    db.fetchSyllabus(mySchool.id, cls.grade).then(setSyllabusChapters).catch(() => setSyllabusChapters([]));
  }, [mySchool.id, cls?.grade]);

  const onChapterNumberBlur = async () => {
    if (!form.chapter_number.trim() || form.chapter.trim()) return; // don't clobber a manually-typed name
    const match = await db.fetchChapterNameForNumber(userId, classId, form.chapter_number);
    if (match) {
      setForm((f) => ({
        ...f,
        chapter: match.chapter || f.chapter,
        classworkItems: f.classworkItems.length ? f.classworkItems : (match.classwork_items?.length ? match.classwork_items : (match.concepts || []).map((t) => ({ text: t, medium: "", important: false }))),
        homeworkItems: f.homeworkItems.length ? f.homeworkItems : (match.homework_items?.length ? match.homework_items : (match.exercise_list || []).map((t) => ({ text: t, medium: "", important: false }))),
      }));
      setAutoFilled(true);
      return;
    }
    // no history for this number yet - fall back to the syllabus's name for it, if any
    const syllabusMatch = syllabusChapters.find((c) => c.chapter_number === form.chapter_number.trim());
    if (syllabusMatch) {
      setForm((f) => ({ ...f, chapter: syllabusMatch.chapter_name }));
      setAutoFilled(true);
    }
  };

  const applyPhotoImport = ({ data }) => {
    setImportReview(data.entries && data.entries.length ? data.entries : [data]);
  };

  const confirmPlannerImport = async (rows) => {
    let created = 0;
    const touchedClasses = new Set();
    for (const row of rows) {
      if (!row.classId || (!row.chapter?.trim() && !row.chapter_number?.trim())) continue;
      await db.createPlannerEntry(userId, row.classId, row.date, {
        chapter_number: row.chapter_number, chapter: row.chapter || "Untitled lesson",
        objectives: row.objectives, methodology: row.methodology, resources: row.resources,
        assignment: row.assignment, reflection: row.reflection, concepts: row.concepts,
        exercise_list: row.exercise_list, classwork_items: row.classwork_items, homework_items: row.homework_items,
      });
      created++; touchedClasses.add(row.classId);
    }
    const classNames = [...touchedClasses].map((id) => classes.find((c) => c.id === id)?.name).filter(Boolean).join(", ");
    await db.createImportLog(userId, "planner", classNames, JSON.stringify(rows.map((r) => r.date)), rows.length);
    setImportReview(null);
    load();
    toast(`Imported ${created} lesson${created === 1 ? "" : "s"}${touchedClasses.size > 1 ? ` across ${touchedClasses.size} classes` : ""}`);
  };

  const save = async () => {
    if (!classId || !form.chapter.trim()) return;
    const clean = (items) => items.map((it) => ({ ...it, text: it.text.trim() })).filter((it) => it.text);
    const classworkClean = clean(form.classworkItems), homeworkClean = clean(form.homeworkItems);
    const payload = {
      chapter_number: form.chapter_number.trim() || null,
      chapter: form.chapter, objectives: form.objectives, methodology: form.methodology,
      resources: form.resources, assignment: form.assignment, reflection: form.reflection,
      classwork_items: classworkClean, homework_items: homeworkClean,
      concepts: classworkClean.map((it) => it.text), exercise_list: homeworkClean.map((it) => it.text),
    };
    await db.createPlannerEntry(userId, classId, date, payload);
    setForm({ chapter_number: "", chapter: "", objectives: "", methodology: "", resources: "", assignment: "", reflection: "", classworkItems: [], homeworkItems: [] });
    setAutoFilled(false);
    load();
    toast("Planner entry saved");
  };
  const remove = async (id) => { await db.deletePlannerEntry(id); load(); };
  const saveEntry = async (id, patch) => { await db.updatePlannerEntry(id, patch); setEditingEntry(null); load(); toast("Planner entry updated"); };
  const submitSignoff = async (id) => { await school.submitForSignoff(id); load(); toast("Sent for sign-off"); };

  return (
    <div>
      <div className="card">
        <div className="card-title-row">
          <div className="card-title" style={{ marginBottom: 0 }}>Daily / weekly planner entry</div>
          <PhotoImportButton kind="planner" context={{ classHint: classes.find((c) => c.id === classId)?.name, allClassNames: classes.map((c) => c.name) }} onResult={applyPhotoImport} />
        </div>
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
            <datalist id="chapter-numbers">{[...new Set([...chapterNumbers, ...syllabusChapters.map((c) => c.chapter_number).filter(Boolean)])].map((n) => <option key={n} value={n} />)}</datalist>
          </div>
          <div>
            <div className="field-label">Chapter name</div>
            <input className="input" placeholder="e.g. Fractions" value={form.chapter} onChange={(e) => setForm({ ...form, chapter: e.target.value })} />
          </div>
        </div>
        {autoFilled && <div className="autofill-hint">Filled in from a previous entry for chapter {form.chapter_number}  -  edit anything as needed.</div>}
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
        <ConceptItemList label="Classwork" items={form.classworkItems} onChange={(items) => setForm({ ...form, classworkItems: items })} />
        <ConceptItemList label="Homework" items={form.homeworkItems} onChange={(items) => setForm({ ...form, homeworkItems: items })} />
        <button className="btn btn-primary" style={{ marginTop: 12, width: "100%" }} onClick={save}><Plus size={14} /> Save entry</button>
      </div>
      {entries.map((e) => (
        <div className="card planner-entry" key={e.id}>
          <div className="card-title-row">
            <div className="card-sub mono">{e.date}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {e.signoff_status && e.signoff_status !== "none" && (
                <span className={`badge-mini signoff-${e.signoff_status}`}>
                  {e.signoff_status === "pending" ? "Awaiting sign-off" : e.signoff_status === "approved" ? "Approved" : "Sent back"}
                </span>
              )}
              <ConfirmDelete onConfirm={() => remove(e.id)} size={13} />
            </div>
          </div>
          <div onClick={() => setEditingEntry(e)} style={{ cursor: "pointer" }}>
            <div className="planner-field"><b>{e.chapter_number ? `Ch ${e.chapter_number}: ` : ""}{e.chapter}</b></div>
            {e.objectives && <div className="planner-field"><span className="planner-label">Objectives:</span> {e.objectives}</div>}
            {e.methodology && <div className="planner-field"><span className="planner-label">Methodology:</span> {e.methodology}</div>}
            {e.assignment && <div className="planner-field"><span className="planner-label">Assignment:</span> {e.assignment}</div>}
            {e.reflection && <div className="planner-field"><span className="planner-label">Reflection:</span> {e.reflection}</div>}
            {e.classwork_items?.length > 0 && (
              <div className="planner-field"><span className="planner-label">Classwork:</span> {e.classwork_items.map((it, i) => (
                <span key={i}>{i > 0 && ", "}{it.important && <Star size={10} style={{ verticalAlign: -1 }} fill="currentColor" />}{it.text}{it.medium && ` (${it.medium})`}</span>
              ))}</div>
            )}
            {e.homework_items?.length > 0 && (
              <div className="planner-field"><span className="planner-label">Homework:</span> {e.homework_items.map((it, i) => (
                <span key={i}>{i > 0 && ", "}{it.important && <Star size={10} style={{ verticalAlign: -1 }} fill="currentColor" />}{it.text}{it.medium && ` (${it.medium})`}</span>
              ))}</div>
            )}
            {e.signoff_status === "rejected" && e.signoff_note && <div className="planner-field" style={{ color: "#E8556B" }}><span className="planner-label">Note:</span> {e.signoff_note}</div>}
          </div>
          {e.photos?.length > 0 && <div className="photo-strip" style={{ marginTop: 8 }}>{e.photos.map((p, i) => <div className="photo-thumb photo-thumb-view" key={i}><img src={p} alt="" /></div>)}</div>}
          {(!e.signoff_status || e.signoff_status === "none" || e.signoff_status === "rejected") && (
            <button type="button" className="chip-btn" style={{ marginTop: 10 }} onClick={() => submitSignoff(e.id)}>Submit for sign-off</button>
          )}
        </div>
      ))}
      {importReview && (
        <PlannerImportReviewSheet
          entries={importReview}
          classes={classes}
          defaultClassId={classId}
          onClose={() => setImportReview(null)}
          onConfirm={confirmPlannerImport}
        />
      )}
      {editingEntry && (
        <PlannerEntryEditSheet
          entry={editingEntry}
          onClose={() => setEditingEntry(null)}
          onSave={(patch) => saveEntry(editingEntry.id, patch)}
        />
      )}
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
      {cls && isDayOff && <div className="card"><div className="empty">Marked as a day off  -  no attendance for {date}.</div></div>}
      {cls && !isDayOff && (
        <div className="card">
          <div className="card-title-row"><div className="card-title" style={{ marginBottom: 0 }}>Attendance</div><div className="card-sub">{presentCount}/{cls.students.length} present  |  everyone present by default</div></div>
          {cls.students.map((s) => (
            <label key={s.id} className={`attendance-row ${isPresent(s.id) ? "present" : "absent"}`}>
              <span>{s.name}</span>
              <input type="checkbox" checked={!isPresent(s.id)} onChange={() => toggleAbsent(s.id)} />
            </label>
          ))}
          <div className="legend">checkbox marks a student absent  -  unchecked means present</div>
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
        {loading ? <div className="card-sub">Loading...</div> : rows.length === 0 ? (
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

/** Splits methodology/assignment prose into candidate suggestion chips. */
function splitToSuggestions(text) {
  if (!text) return [];
  return [...new Set(text.split(/[\n,;]+/).map((s) => s.trim()).filter((s) => s.length > 1))];
}

/** Add/remove entries in a school-wide preset list (checking types / exam types) - shared by every class. */
function TypeListEditor({ title, items, onSave, onClose }) {
  const [list, setList] = useState(items);
  const [input, setInput] = useState("");
  const add = () => { const v = input.trim(); if (v && !list.includes(v)) setList([...list, v]); setInput(""); };
  const remove = (i) => setList(list.filter((_, idx) => idx !== i));

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2 className="sheet-title">{title}</h2>
          <button type="button" className="btn btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="card-sub" style={{ marginBottom: 10 }}>Shared across every class in your school - any teacher or admin can edit this list.</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {list.map((t, i) => (
            <span key={t} className="chip-btn" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              {t}
              <button type="button" onClick={() => remove(i)} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 0, display: "flex" }}><X size={11} /></button>
            </span>
          ))}
          {list.length === 0 && <div className="card-sub">No types yet - add one below.</div>}
        </div>
        <div className="row-2">
          <input className="input" placeholder="e.g. Classwork" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())} />
          <button type="button" className="btn btn-ghost" onClick={add}><Plus size={14} /></button>
        </div>
        <div className="sheet-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={() => onSave(list)} disabled={list.length === 0}>Save</button>
        </div>
      </div>
    </div>
  );
}

/** Admin-only editor for exam types + each one's passing marks - unlike checking types,
 *  teachers can select from this list but not change it. */
function ExamTypeEditor({ items, onSave, onClose }) {
  const [list, setList] = useState(items);
  const [name, setName] = useState("");
  const [passingMarks, setPassingMarks] = useState("");
  const add = () => {
    const v = name.trim();
    if (!v || list.some((t) => t.name === v)) return;
    setList([...list, { name: v, passingMarks: passingMarks === "" ? null : Number(passingMarks) }]);
    setName(""); setPassingMarks("");
  };
  const remove = (i) => setList(list.filter((_, idx) => idx !== i));
  const updatePassing = (i, val) => setList(list.map((t, idx) => idx === i ? { ...t, passingMarks: val === "" ? null : Number(val) } : t));

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2 className="sheet-title">Exam types</h2>
          <button type="button" className="btn btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="card-sub" style={{ marginBottom: 10 }}>Shared across every class in your school. Only admins can edit this list; teachers pick from it.</div>
        {list.map((t, i) => (
          <div key={t.name} className="row-2" style={{ marginBottom: 8, alignItems: "center" }}>
            <div className="input" style={{ display: "flex", alignItems: "center" }}>{t.name}</div>
            <div style={{ display: "flex", gap: 6, flex: 1 }}>
              <input className="input" type="number" placeholder="Passing marks" value={t.passingMarks ?? ""} onChange={(e) => updatePassing(i, e.target.value)} />
              <button type="button" className="btn btn-icon" onClick={() => remove(i)}><X size={13} /></button>
            </div>
          </div>
        ))}
        {list.length === 0 && <div className="card-sub" style={{ marginBottom: 8 }}>No exam types yet - add one below.</div>}
        <div className="row-2" style={{ marginTop: 6 }}>
          <input className="input" placeholder="e.g. CT" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="input" type="number" placeholder="Passing marks" value={passingMarks} onChange={(e) => setPassingMarks(e.target.value)} />
        </div>
        <button type="button" className="chip-btn" style={{ marginTop: 8 }} onClick={add}><Plus size={12} /> Add type</button>
        <div className="sheet-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={() => onSave(list)} disabled={list.length === 0}>Save</button>
        </div>
      </div>
    </div>
  );
}

function CorrectionRecordEditSheet({ record, correctionTypes, chapterNumbers, onClose, onSave }) {
  const [title, setTitle] = useState(record.title);
  const [type, setType] = useState(record.type);
  const [date, setDate] = useState(record.date);
  const [chapterNumber, setChapterNumber] = useState(record.chapter_number || "");
  const [conceptsInput, setConceptsInput] = useState((record.concepts || []).join(", "));

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2 className="sheet-title">Edit record</h2>
          <button type="button" className="btn btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="field-label">Title</div>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        <div className="field-label">Type</div>
        <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
          {!correctionTypes.includes(type) && <option value={type}>{type}</option>}
          {correctionTypes.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <div className="field-label">Date</div>
        <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        <div className="field-label">Chapter number</div>
        <input className="input" list="chapter-numbers-edit" value={chapterNumber} onChange={(e) => setChapterNumber(e.target.value)} />
        <datalist id="chapter-numbers-edit">{chapterNumbers.map((n) => <option key={n} value={n} />)}</datalist>
        <div className="field-label">Concepts / questions covered</div>
        <input className="input" value={conceptsInput} onChange={(e) => setConceptsInput(e.target.value)} />
        <div className="sheet-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={() => title.trim() && type.trim() && onSave({
            title: title.trim(), type: type.trim(), date, chapter_number: chapterNumber.trim() || null,
            concepts: conceptsInput.split(",").map((s) => s.trim()).filter(Boolean),
          })}>Save</button>
        </div>
      </div>
    </div>
  );
}

function ConceptValueSheet({ prompt, onClose, onSave }) {
  const [dateVal, setDateVal] = useState(new Date().toISOString().slice(0, 10));
  const [textVal, setTextVal] = useState("");
  const isDate = prompt.needsValue === "date";

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2 className="sheet-title">{isDate ? "Extend to a new date" : "Add a remark"}</h2>
          <button type="button" className="btn btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="card-sub" style={{ marginBottom: 10 }}>{prompt.studentName} - {prompt.concept}</div>
        {isDate ? (
          <>
            <div className="field-label">New date</div>
            <input type="date" className="input" value={dateVal} onChange={(e) => setDateVal(e.target.value)} autoFocus />
          </>
        ) : (
          <>
            <div className="field-label">Remark</div>
            <input className="input" placeholder="e.g. forgot notebook" value={textVal} onChange={(e) => setTextVal(e.target.value)} autoFocus />
          </>
        )}
        <div className="sheet-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={() => onSave(isDate ? { next_date: dateVal } : { remark: textVal.trim() })}>Save</button>
        </div>
      </div>
    </div>
  );
}

function CorrectionPanel({ userId, classes, mySchool }) {
  const [classId, setClassId] = useState(classes[0]?.id || "");
  useEffect(() => { if (!classId && classes[0]) setClassId(classes[0].id); }, [classes, classId]);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState(""); const [type, setType] = useState(""); const [date, setDate] = useState(todayKey());
  const [chapterNumber, setChapterNumber] = useState("");
  const [conceptsInput, setConceptsInput] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [records, setRecords] = useState([]);
  const [correctionTypes, setCorrectionTypes] = useState(mySchool?.correctionTypes?.length ? mySchool.correctionTypes : DEFAULT_CORRECTION_TYPES);
  const [editingTypes, setEditingTypes] = useState(false);
  const [chapterNumbers, setChapterNumbers] = useState([]);
  const [incomplete, setIncomplete] = useState([]);
  const [showIncomplete, setShowIncomplete] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [showMore, setShowMore] = useState(false);
  const [marksImport, setMarksImport] = useState(null); // { record, csv }
  const [editingRecord, setEditingRecord] = useState(null);
  const [valuePrompt, setValuePrompt] = useState(null); // { record, concept, studentId, studentName, status, needsValue }
  const [historyView, setHistoryView] = useState(null); // { recordId, studentId, studentName, concept }
  const [recordDetail, setRecordDetail] = useState(null);
  const [conceptQuick, setConceptQuick] = useState(null); // { record, studentId }
  const cls = classes.find((c) => c.id === classId);

  const load = useCallback(async () => {
    if (!classId) return;
    const [recs, numbers] = await Promise.all([
      db.fetchCorrectionRecords(userId, classId), db.fetchChapterNumbers(userId, classId),
    ]);
    setRecords(recs);
    setChapterNumbers(numbers);
  }, [userId, classId]);
  useEffect(() => { load(); }, [load]);

  const saveTypes = async (list) => {
    await school.updateSchoolTypeLists(mySchool.id, { correctionTypes: list });
    setCorrectionTypes(list);
    setEditingTypes(false);
    toast("Checking types updated");
  };

  const loadIncomplete = useCallback(async () => {
    if (!classId || !cls) return;
    const studentsById = Object.fromEntries(cls.students.map((s) => [s.id, s.name]));
    setIncomplete(await db.fetchIncompleteTasks(userId, classId, studentsById));
  }, [userId, classId, cls]);
  useEffect(() => { if (showIncomplete) loadIncomplete(); }, [showIncomplete, loadIncomplete]);

  const refreshSuggestions = async (chapterNum, typeText) => {
    if (!chapterNum?.trim()) { setSuggestions([]); return; }
    const match = await db.fetchChapterNameForNumber(userId, classId, chapterNum);
    if (!match) { setSuggestions([]); return; }
    const isHomework = /home/i.test(typeText);
    const isClasswork = /class/i.test(typeText);
    const source = isHomework ? match.assignment : isClasswork ? match.methodology : `${match.methodology || ""}\n${match.assignment || ""}`;
    // exercises and free-text suggestions are tracked in the exact same concept format, so merge them
    setSuggestions([...(match.exercise_list || []), ...splitToSuggestions(source)]);
    const combined = [...(match.concepts || []), ...(match.exercise_list || [])];
    if (!conceptsInput.trim() && combined.length) setConceptsInput(combined.join(", "));
  };

  const addSuggestion = (s) => {
    const existing = conceptsInput.split(",").map((x) => x.trim()).filter(Boolean);
    if (existing.includes(s)) return;
    setConceptsInput([...existing, s].join(", "));
  };

  const createRecord = async () => {
    if (!title.trim() || !type.trim() || !cls) return;
    const concepts = conceptsInput.split(",").map((c) => c.trim()).filter(Boolean);
    await db.createCorrectionRecord(userId, classId, date, title, type.trim(), chapterNumber.trim() || null, concepts, []);
    setTitle(""); setType(""); setChapterNumber(""); setConceptsInput(""); setSuggestions([]); setCreating(false); setShowMore(false);
    load();
    toast("Correction record created");
  };
  const cycle = async (record, studentId) => {
    const cur = record.marks[studentId] || "blank";
    const next = CORRECTION_CODES[(CORRECTION_CODES.indexOf(cur) + 1) % CORRECTION_CODES.length];
    const marks = { ...record.marks, [studentId]: next };
    await db.updateCorrectionMarks(userId, record.id, marks, studentId, next);
    setRecords((prev) => prev.map((r) => r.id === record.id ? { ...r, marks } : r));
    if (showIncomplete) loadIncomplete();
  };
  const bulkMarkStatus = async (record, code, studentIds) => {
    const marks = { ...record.marks };
    for (const sid of studentIds) marks[sid] = code;
    await db.updateCorrectionMarks(userId, record.id, marks, null, null); // bulk: skip per-row logging noise, current state still updates
    setRecords((prev) => prev.map((r) => r.id === record.id ? { ...r, marks } : r));
    if (showIncomplete) loadIncomplete();
    toast(`Marked whole class: ${CORRECTION_TITLES[code]}`);
  };
  const importCorrectionMarks = async (record, rows) => {
    const marks = { ...record.marks };
    const validCodes = new Set(CORRECTION_CODES);
    let matched = 0;
    for (const row of rows) {
      const student = matchStudentName(row.student_name || "", cls.students);
      const code = (row.status || "").trim().toLowerCase();
      if (student && validCodes.has(code)) { marks[student.id] = code; matched++; }
    }
    await db.updateCorrectionMarks(userId, record.id, marks, null, null);
    await db.createImportLog(userId, "correction", record.title, marksImport.csv, rows.length);
    setRecords((prev) => prev.map((r) => r.id === record.id ? { ...r, marks } : r));
    setMarksImport(null);
    toast(`Matched ${matched} of ${rows.length} students`);
  };
  const setConceptStatus = async (record, concept, studentId, status, extra) => {
    if (CORRECTION_CONCEPT_NEEDS_VALUE[status] && !extra) {
      const studentName = cls.students.find((s) => s.id === studentId)?.name || "";
      setValuePrompt({ record, concept, studentId, studentName, status, needsValue: CORRECTION_CONCEPT_NEEDS_VALUE[status] });
      return;
    }
    const conceptMarks = await db.updateCorrectionConceptMark(userId, record.id, record.concept_marks || {}, studentId, concept, status, extra);
    setRecords((prev) => prev.map((r) => r.id === record.id ? { ...r, concept_marks: conceptMarks } : r));
  };
  const confirmValuePrompt = async (extra) => {
    await setConceptStatus(valuePrompt.record, valuePrompt.concept, valuePrompt.studentId, valuePrompt.status, extra);
    setValuePrompt(null);
  };
  const bulkMarkConceptStatus = async (record, concept, status, studentIds) => {
    const conceptMarks = await db.bulkSetCorrectionConceptMark(userId, record.id, record.concept_marks || {}, studentIds, concept, status);
    setRecords((prev) => prev.map((r) => r.id === record.id ? { ...r, concept_marks: conceptMarks } : r));
    toast(`Marked whole class: ${CORRECTION_CONCEPT_TITLES[status]}`);
  };
  const markTaskDone = async (task) => {
    const record = records.find((r) => r.id === task.recordId);
    const marks = { ...(record ? record.marks : task.marks), [task.studentId]: "done" };
    await db.updateCorrectionMarks(userId, task.recordId, marks, task.studentId, "done");
    setRecords((prev) => prev.map((r) => r.id === task.recordId ? { ...r, marks } : r));
    setIncomplete((prev) => prev.filter((t) => !(t.recordId === task.recordId && t.studentId === task.studentId)));
    toast(`Marked ${task.studentName} done`);
  };
  const removeRecord = async (id) => { await db.deleteCorrectionRecord(id); load(); toast("Record deleted"); };
  const saveRecordMeta = async (id, patch) => { await db.updateCorrectionRecord(id, patch); setEditingRecord(null); load(); toast("Record updated"); };

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
              <select className="input" value={type} onChange={(e) => { setType(e.target.value); refreshSuggestions(chapterNumber, e.target.value); }}>
                <option value="">Type...</option>
                {correctionTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <button type="button" className="chip-btn" style={{ marginTop: 8 }} onClick={() => setEditingTypes(true)}>Edit checking types</button>
            <input type="date" className="input" style={{ marginTop: 8 }} value={date} onChange={(e) => setDate(e.target.value)} />
            <button type="button" className="more-details-toggle" onClick={() => setShowMore(!showMore)}>
              {showMore ? <ChevronDown size={13} /> : <ChevronRight size={13} />} {showMore ? "Hide chapter & concepts" : "Link a chapter & concepts (optional)"}
            </button>
            {showMore && (
              <div className="more-details-body">
                <div className="field-label">Chapter number (optional  -  pulls suggestions from the Planner)</div>
                <input className="input" list="chapter-numbers-correction" value={chapterNumber}
                  onChange={(e) => setChapterNumber(e.target.value)} onBlur={() => refreshSuggestions(chapterNumber, type)} />
                <datalist id="chapter-numbers-correction">{chapterNumbers.map((n) => <option key={n} value={n} />)}</datalist>
                <div className="field-label">Concepts / questions covered</div>
                <input className="input" placeholder="Comma-separated, or tap a suggestion below" value={conceptsInput} onChange={(e) => setConceptsInput(e.target.value)} />
                {suggestions.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                    {suggestions.map((s) => <button type="button" key={s} className="chip-btn" onClick={() => addSuggestion(s)}>{s}</button>)}
                  </div>
                )}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button className="btn btn-ghost" onClick={() => { setCreating(false); setShowMore(false); }}>Cancel</button>
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
                  <div className="card-sub">{t.title} <span className="badge-mini">{t.type}</span>  |  <span className="mono">{t.date}</span></div>
                </div>
                <button className="btn btn-done" onClick={() => markTaskDone(t)}><Check size={13} /> Done</button>
              </div>
            ))
          )}
        </div>
      )}

      {cls && records.length > 0 && (
        <div className="card" style={{ padding: "12px 0 16px" }}>
          <div className="card-title" style={{ padding: "0 16px" }}>Correction register</div>
          <CorrectionRegisterTable
            students={cls.students}
            records={records}
            onCycleStatus={cycle}
            onOpenConceptQuick={(record, studentId) => setConceptQuick({ record, studentId })}
            onOpenRecordDetail={(record) => setRecordDetail(record)}
          />
          <div className="legend" style={{ padding: "0 16px" }}>tap a cell to cycle status  |  tap the dot to flag which topics  |  tap a column header for full details</div>
        </div>
      )}
      {conceptQuick && (
        <ConceptQuickSheet
          record={records.find((r) => r.id === conceptQuick.record.id) || conceptQuick.record}
          student={cls.students.find((s) => s.id === conceptQuick.studentId)}
          getStatus={(concept) => {
            const rec = records.find((r) => r.id === conceptQuick.record.id) || conceptQuick.record;
            const entry = rec.concept_marks?.[conceptQuick.studentId]?.[concept];
            return (typeof entry === "string" ? entry : entry?.status) || "blank";
          }}
          onSetStatus={(concept, status) => setConceptStatus(conceptQuick.record, concept, conceptQuick.studentId, status)}
          onClose={() => setConceptQuick(null)}
        />
      )}
      {recordDetail && cls && (
        <div className="overlay" onClick={() => setRecordDetail(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            {(() => {
              const r = records.find((rec) => rec.id === recordDetail.id) || recordDetail;
              const isOpen = true;
              return (
                <>
                  <div className="sheet-head">
                    <h2 className="sheet-title">{r.title} <span className="badge-mini">{r.type}</span></h2>
                    <button type="button" className="btn btn-icon" onClick={() => setRecordDetail(null)}><X size={16} /></button>
                  </div>
                  <div className="card-sub mono" style={{ marginBottom: 4 }}>{r.date}{r.chapter_number ? `  |  Ch ${r.chapter_number}` : ""}</div>
                  {r.concepts?.length > 0 && <div className="card-sub" style={{ marginBottom: 10 }}>Covers: {r.concepts.join(", ")}</div>}
                  <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                    <button className="btn btn-ghost" onClick={() => { setRecordDetail(null); setEditingRecord(r); }}>Edit details</button>
                    <ConfirmDelete onConfirm={() => { removeRecord(r.id); setRecordDetail(null); }} size={14} />
                  </div>
                  <div className="bulk-mark-row" style={{ marginBottom: 8 }}>
                    <span className="bulk-mark-label">Mark all:</span>
                    {CORRECTION_CODES.filter((c) => c !== "blank").map((code) => (
                      <button key={code} type="button" className="bulk-mark-btn" title={CORRECTION_TITLES[code]}
                        onClick={() => bulkMarkStatus(r, code, cls.students.map((s) => s.id))}>
                        <GridMark mark={CORRECTION_MARKS[code]} size={12} />
                      </button>
                    ))}
                    <PhotoImportButton kind="correction" context={{ students: cls.students.map((s) => s.name) }} onResult={({ csv }) => setMarksImport({ record: r, csv })} label="From photo" />
                  </div>
                  {(r.concepts || []).length > 0 && (
                    <ConceptTable
                      students={cls.students}
                      concepts={r.concepts}
                      tagOptions={CORRECTION_CONCEPT_STATUSES.map((t) => ({ value: t, label: CORRECTION_CONCEPT_TITLES[t] }))}
                      getTag={(sid, c) => {
                        const entry = r.concept_marks?.[sid]?.[c];
                        return (typeof entry === "string" ? entry : entry?.status) || "blank";
                      }}
                      onSetTag={(sid, c, status) => setConceptStatus(r, c, sid, status)}
                      onBulkSet={(c, status) => bulkMarkConceptStatus(r, c, status, cls.students.map((s) => s.id))}
                      extraLabel={(sid, c) => {
                        const entry = r.concept_marks?.[sid]?.[c];
                        if (!entry || typeof entry === "string") return null;
                        if (entry.status === "next_date" && entry.next_date) return `-> ${entry.next_date}`;
                        if (entry.status === "remark" && entry.remark) return entry.remark;
                        return null;
                      }}
                      onViewHistory={(sid, c) => setHistoryView({ recordId: r.id, studentId: sid, studentName: cls.students.find((s) => s.id === sid)?.name || "", concept: c })}
                    />
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}
      {marksImport && (
        <CsvReviewSheet
          title="Import correction marks"
          csv={marksImport.csv}
          columns={["student_name", "status"]}
          onClose={() => setMarksImport(null)}
          onConfirm={(rows) => importCorrectionMarks(marksImport.record, rows)}
        />
      )}
      {editingRecord && (
        <CorrectionRecordEditSheet
          record={editingRecord}
          correctionTypes={correctionTypes}
          chapterNumbers={chapterNumbers}
          onClose={() => setEditingRecord(null)}
          onSave={(patch) => saveRecordMeta(editingRecord.id, patch)}
        />
      )}
      {valuePrompt && (
        <ConceptValueSheet
          prompt={valuePrompt}
          onClose={() => setValuePrompt(null)}
          onSave={confirmValuePrompt}
        />
      )}
      {historyView && (
        <HistorySheet
          recordId={historyView.recordId}
          studentId={historyView.studentId}
          studentName={historyView.studentName}
          concept={historyView.concept}
          onClose={() => setHistoryView(null)}
        />
      )}
      {editingTypes && (
        <TypeListEditor title="Checking types" items={correctionTypes} onClose={() => setEditingTypes(false)} onSave={saveTypes} />
      )}
    </div>
  );
}

/* ---------- performance ---------- */

function statSummary(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const counts = {};
  for (const v of values) counts[v] = (counts[v] || 0) + 1;
  const maxCount = Math.max(...Object.values(counts));
  const modeVals = maxCount > 1 ? Object.keys(counts).filter((k) => counts[k] === maxCount) : null;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return { mean: +mean.toFixed(1), median, mode: modeVals ? modeVals.join(", ") : " - ", stdDev: +Math.sqrt(variance).toFixed(1) };
}

/** Compares each student's most recent test % against their average on earlier tests, for this class's records. */
function computeImprovingStudents(records, studentsById) {
  const chronological = [...records].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const byStudent = {};
  for (const r of chronological) {
    for (const [sid, mark] of Object.entries(r.marks || {})) {
      if (mark === null || mark === undefined || (r.absent || {})[sid]) continue;
      (byStudent[sid] = byStudent[sid] || []).push((mark / r.max_marks) * 100);
    }
  }
  const results = [];
  for (const [sid, pctSeries] of Object.entries(byStudent)) {
    if (pctSeries.length < 2) continue;
    const latest = pctSeries[pctSeries.length - 1];
    const priorAvg = pctSeries.slice(0, -1).reduce((a, b) => a + b, 0) / (pctSeries.length - 1);
    results.push({ studentId: sid, name: studentsById[sid] || "Unknown", latest: +latest.toFixed(1), priorAvg: +priorAvg.toFixed(1), delta: +(latest - priorAvg).toFixed(1) });
  }
  return results.sort((a, b) => b.delta - a.delta);
}

function PerformanceRecordEditSheet({ record, testTypes, onClose, onSave }) {
  const [title, setTitle] = useState(record.title);
  const [testType, setTestType] = useState(record.test_type);
  const [maxMarks, setMaxMarks] = useState(record.max_marks);
  const [chapterCount, setChapterCount] = useState(record.chapter_count ?? "");
  const [exercises, setExercises] = useState(record.exercises || "");
  const [conceptsInput, setConceptsInput] = useState((record.concepts || []).join(", "));
  const presetPassingMarks = testTypes.find((t) => t.name === testType)?.passingMarks;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2 className="sheet-title">Edit test record</h2>
          <button type="button" className="btn btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="field-label">Title</div>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        <div className="field-label">Test type</div>
        <select className="input" value={testType} onChange={(e) => setTestType(e.target.value)}>
          {!testTypes.some((t) => t.name === testType) && <option value={testType}>{testType}</option>}
          {testTypes.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
        </select>
        <div className="row-2">
          <div><div className="field-label">Max marks</div><input type="number" className="input" value={maxMarks} onChange={(e) => setMaxMarks(e.target.value)} /></div>
          <div><div className="field-label">Passing marks</div><div className="input" style={{ color: "#9c9488" }}>{presetPassingMarks ?? "Not set by admin"}</div></div>
        </div>
        <div className="field-label">Number of chapters</div>
        <input type="number" className="input" value={chapterCount} onChange={(e) => setChapterCount(e.target.value)} />
        <div className="field-label">Exercises</div>
        <input className="input" value={exercises} onChange={(e) => setExercises(e.target.value)} />
        <div className="field-label">Concepts covered</div>
        <input className="input" value={conceptsInput} onChange={(e) => setConceptsInput(e.target.value)} />
        <div className="sheet-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={() => title.trim() && onSave({
            title: title.trim(), test_type: testType.trim(), max_marks: Number(maxMarks),
            passing_marks: presetPassingMarks ?? null,
            chapter_count: chapterCount === "" ? null : Number(chapterCount),
            exercises: exercises.trim() || null,
            concepts: conceptsInput.split(",").map((s) => s.trim()).filter(Boolean),
          })}>Save</button>
        </div>
      </div>
    </div>
  );
}

function PerformancePanel({ userId, classes, mySchool }) {
  const [classId, setClassId] = useState(classes[0]?.id || "");
  useEffect(() => { if (!classId && classes[0]) setClassId(classes[0].id); }, [classes, classId]);
  const [creating, setCreating] = useState(false);
  const [testTypes, setTestTypes] = useState(mySchool?.testTypes?.length ? mySchool.testTypes : DEFAULT_TEST_TYPES);
  const isAdmin = mySchool?.role === "school_admin" || mySchool?.role === "super_admin";
  const [title, setTitle] = useState(""); const [testType, setTestType] = useState(testTypes[0]?.name || ""); const [maxMarks, setMaxMarks] = useState(20);
  const [editingTypes, setEditingTypes] = useState(false);
  const presetPassingMarks = testTypes.find((t) => t.name === testType)?.passingMarks;
  const [chapterCount, setChapterCount] = useState("");
  const [exercises, setExercises] = useState("");
  const [conceptsInput, setConceptsInput] = useState("");
  const [records, setRecords] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [showTrends, setShowTrends] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [marksImport, setMarksImport] = useState(null); // { record, csv }
  const [editingRecord, setEditingRecord] = useState(null);
  const [syllabusChapters, setSyllabusChapters] = useState([]);
  const cls = classes.find((c) => c.id === classId);

  useEffect(() => {
    if (!cls?.grade) { setSyllabusChapters([]); return; }
    db.fetchSyllabus(mySchool.id, cls.grade).then(setSyllabusChapters).catch(() => setSyllabusChapters([]));
  }, [mySchool.id, cls?.grade]);

  const addConceptFromSyllabus = (text) => {
    const existing = conceptsInput.split(",").map((x) => x.trim()).filter(Boolean);
    if (existing.includes(text)) return;
    setConceptsInput([...existing, text].join(", "));
  };

  const saveTestTypes = async (list) => {
    await school.updateSchoolTypeLists(mySchool.id, { testTypes: list });
    setTestTypes(list);
    setEditingTypes(false);
    toast("Exam types updated");
  };

  const load = useCallback(async () => {
    if (!classId) return;
    setRecords(await db.fetchPerformanceRecords(userId, classId));
  }, [userId, classId]);
  useEffect(() => { load(); }, [load]);

  const createRecord = async () => {
    if (!title.trim() || !cls) return;
    let concepts = conceptsInput.split(",").map((c) => c.trim()).filter(Boolean);
    if (concepts.length === 0) {
      concepts = await db.fetchPlannerChapters(userId, classId); // fall back to everything logged in the planner
    }
    await db.createPerformanceRecord(userId, classId, title, testType, Number(maxMarks), chapterCount ? Number(chapterCount) : null, exercises.trim() || null, concepts, presetPassingMarks ?? null);
    setTitle(""); setChapterCount(""); setExercises(""); setConceptsInput(""); setCreating(false); setShowMore(false);
    load();
    toast("Test record created");
  };
  const setMark = async (record, studentId, val) => {
    const marks = { ...record.marks, [studentId]: val === "" ? null : Number(val) };
    await db.updatePerformanceMarks(record.id, marks);
    setRecords((prev) => prev.map((r) => r.id === record.id ? { ...r, marks } : r));
  };
  const toggleAbsent = async (record, studentId) => {
    const isAbsent = !(record.absent || {})[studentId];
    const { absent, marks } = await db.setPerformanceAbsent(record.id, record.absent || {}, record.marks, studentId, isAbsent);
    setRecords((prev) => prev.map((r) => r.id === record.id ? { ...r, absent, marks } : r));
  };
  const cycleConceptTag = async (record, concept, studentId, directTag) => {
    const tag = directTag || CONCEPT_TAGS[(CONCEPT_TAGS.indexOf(record.concept_marks?.[studentId]?.[concept] || "blank") + 1) % CONCEPT_TAGS.length];
    const conceptMarks = await db.updateConceptMark(record.id, record.concept_marks || {}, studentId, concept, tag);
    setRecords((prev) => prev.map((r) => r.id === record.id ? { ...r, concept_marks: conceptMarks } : r));
  };
  const bulkMarkConceptTag = async (record, concept, tag, studentIds) => {
    const conceptMarks = await db.bulkSetConceptMark(record.id, record.concept_marks || {}, studentIds, concept, tag);
    setRecords((prev) => prev.map((r) => r.id === record.id ? { ...r, concept_marks: conceptMarks } : r));
    toast(`Marked whole class: ${CONCEPT_TAG_TITLES[tag]}`);
  };
  const removeRecord = async (id) => { await db.deletePerformanceRecord(id); load(); toast("Test record deleted"); };
  const saveRecordMeta = async (id, patch) => { await db.updatePerformanceRecord(id, patch); setEditingRecord(null); load(); toast("Test record updated"); };
  const importPerformanceMarks = async (record, rows) => {
    const marks = { ...record.marks };
    let matched = 0;
    for (const row of rows) {
      const student = matchStudentName(row.student_name || "", cls.students);
      const val = parseFloat(row.marks);
      if (student && !isNaN(val)) { marks[student.id] = val; matched++; }
    }
    await db.updatePerformanceMarks(record.id, marks);
    await db.createImportLog(userId, "performance", record.title, marksImport.csv, rows.length);
    setRecords((prev) => prev.map((r) => r.id === record.id ? { ...r, marks } : r));
    setMarksImport(null);
    toast(`Matched ${matched} of ${rows.length} students`);
  };

  const statsFor = (r) => {
    const vals = Object.entries(r.marks).filter(([sid]) => !(r.absent || {})[sid]).map(([, v]) => v).filter((v) => v !== null && v !== undefined);
    return statSummary(vals);
  };
  const passInfo = (r) => {
    if (r.passing_marks == null) return null;
    const vals = Object.entries(r.marks).filter(([sid]) => !(r.absent || {})[sid]).map(([, v]) => v).filter((v) => v !== null && v !== undefined);
    if (!vals.length) return null;
    const passCount = vals.filter((v) => v >= r.passing_marks).length;
    return { passCount, total: vals.length };
  };

  const improving = cls ? computeImprovingStudents(records, Object.fromEntries(cls.students.map((s) => [s.id, s.name]))) : [];

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
              <select className="input" value={testType} onChange={(e) => setTestType(e.target.value)}>
                <option value="">Type...</option>
                {testTypes.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
              </select>
            </div>
            {testType && <div className="card-sub" style={{ marginTop: 6 }}>Passing marks: {presetPassingMarks ?? "not set by admin"}</div>}
            {isAdmin && <button type="button" className="chip-btn" style={{ marginTop: 8 }} onClick={() => setEditingTypes(true)}>Edit exam types</button>}
            <div className="field-label">Max marks</div>
            <input type="number" className="input" value={maxMarks} onChange={(e) => setMaxMarks(e.target.value)} />
            <button type="button" className="more-details-toggle" onClick={() => setShowMore(!showMore)}>
              {showMore ? <ChevronDown size={13} /> : <ChevronRight size={13} />} {showMore ? "Hide extra details" : "Chapters & concepts (optional)"}
            </button>
            {showMore && (
              <div className="more-details-body">
                <div className="field-label">Number of chapters involved</div>
                <input type="number" min="0" className="input" placeholder="e.g. 2" value={chapterCount} onChange={(e) => setChapterCount(e.target.value)} />
                <div className="field-label">Exercises (optional)</div>
                <input className="input" placeholder="e.g. Ex 3.1, 3.2" value={exercises} onChange={(e) => setExercises(e.target.value)} />
                <div className="field-label">Concepts covered (optional, comma-separated)</div>
                <input className="input" placeholder="Leave blank to pull every concept logged in the Planner for this class" value={conceptsInput} onChange={(e) => setConceptsInput(e.target.value)} />
                {syllabusChapters.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                    {syllabusChapters.map((c) => <button type="button" key={c.id} className="chip-btn" onClick={() => addConceptFromSyllabus(c.chapter_name)}>{c.chapter_number ? `Ch ${c.chapter_number}: ` : ""}{c.chapter_name}</button>)}
                  </div>
                )}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button className="btn btn-ghost" onClick={() => { setCreating(false); setShowMore(false); }}>Cancel</button>
              <button className="btn btn-primary" onClick={createRecord}>Create</button>
            </div>
          </>
        )}
      </div>

      {cls && improving.length > 0 && (
        <div className="card">
          <button className="expand-toggle" style={{ paddingTop: 0 }} onClick={() => setShowTrends(!showTrends)}>
            {showTrends ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Improving / slipping students
          </button>
          {showTrends && improving.map((s) => (
            <div className="marks-row" key={s.studentId}>
              <span>{s.name}</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: s.delta >= 0 ? "#2FA88F" : "#E8556B" }}>
                {s.delta >= 0 ? "+" : ""}{s.delta}% <span style={{ color: "#9c9488", fontWeight: 500 }}>({s.priorAvg}% {"->"} {s.latest}%)</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {cls && records.map((r) => {
        const isOpen = !!expanded[r.id];
        const stats = statsFor(r);
        const pass = passInfo(r);
        return (
          <div className="card" key={r.id}>
            <div className="card-title-row">
              <div style={{ cursor: "pointer" }} onClick={() => setEditingRecord(r)}>
                <div className="card-title" style={{ marginBottom: 0 }}>{r.title} <span className="badge-mini">{r.test_type}</span></div>
                <div className="card-sub">Out of {r.max_marks}{r.passing_marks != null ? `  |  pass mark ${r.passing_marks}` : ""}{r.chapter_count ? `  |  ${r.chapter_count} chapters` : ""}</div>
                {stats && (
                  <div className="card-sub">
                    Mean {stats.mean}  |  Median {stats.median}  |  Mode {stats.mode}  |  SD {stats.stdDev}
                    {pass && <>  |  {pass.passCount}/{pass.total} passed</>}
                  </div>
                )}
                {r.exercises && <div className="card-sub">Exercises: {r.exercises}</div>}
              </div>
              <ConfirmDelete onConfirm={() => removeRecord(r.id)} size={13} />
            </div>
            <div style={{ marginBottom: 8 }}>
              <PhotoImportButton kind="performance" context={{ students: cls.students.map((s) => s.name) }} onResult={({ csv }) => setMarksImport({ record: r, csv })} label="Import marks from photo" />
            </div>
            {cls.students.map((s) => {
              const isAbsent = !!(r.absent || {})[s.id];
              return (
                <div className="marks-row" key={s.id}>
                  <span>{s.name}</span>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    {!isAbsent && (
                      <input type="number" className="input marks-input" max={r.max_marks} value={r.marks[s.id] ?? ""} onChange={(e) => setMark(r, s.id, e.target.value)} placeholder="-" />
                    )}
                    <button className={`btn btn-icon absent-toggle ${isAbsent ? "on" : ""}`} onClick={() => toggleAbsent(r, s.id)}>AB</button>
                  </div>
                </div>
              );
            })}
            {(r.concepts || []).length > 0 && (
              <>
                <button className="expand-toggle" onClick={() => setExpanded({ ...expanded, [r.id]: !isOpen })}>
                  {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Concept breakdown
                </button>
                {isOpen && (
                  <ConceptTable
                    students={cls.students}
                    concepts={r.concepts}
                    tagOptions={CONCEPT_TAGS.map((t) => ({ value: t, label: CONCEPT_TAG_TITLES[t] }))}
                    getTag={(sid, c) => r.concept_marks?.[sid]?.[c] || "blank"}
                    onSetTag={(sid, c, tag) => cycleConceptTag(r, c, sid, tag)}
                    onBulkSet={(c, tag) => bulkMarkConceptTag(r, c, tag, cls.students.map((s) => s.id))}
                  />
                )}
              </>
            )}
          </div>
        );
      })}
      {marksImport && (
        <CsvReviewSheet
          title="Import test marks"
          csv={marksImport.csv}
          columns={["student_name", "marks"]}
          onClose={() => setMarksImport(null)}
          onConfirm={(rows) => importPerformanceMarks(marksImport.record, rows)}
        />
      )}
      {editingRecord && (
        <PerformanceRecordEditSheet
          record={editingRecord}
          testTypes={testTypes}
          onClose={() => setEditingRecord(null)}
          onSave={(patch) => saveRecordMeta(editingRecord.id, patch)}
        />
      )}
      {editingTypes && isAdmin && (
        <ExamTypeEditor items={testTypes} onClose={() => setEditingTypes(false)} onSave={saveTestTypes} />
      )}
    </div>
  );
}

/* ---------- shell ---------- */

/* ---------- timetable ---------- */

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function SlotEditSheet({ slot, classes, onClose, onSave, onDelete }) {
  const [dayOfWeek, setDayOfWeek] = useState(slot.day_of_week);
  const [classId, setClassId] = useState(slot.class_id);
  const [startTime, setStartTime] = useState(slot.start_time?.slice(0, 5) || "09:00");
  const [endTime, setEndTime] = useState(slot.end_time?.slice(0, 5) || "");
  const [label, setLabel] = useState(slot.label || "");

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2 className="sheet-title">Edit slot</h2>
          <button type="button" className="btn btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="field-label">Day</div>
        <select className="input" value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))}>
          {DAY_LABELS.map((d, i) => <option key={d} value={i}>{d}</option>)}
        </select>
        <div className="field-label">Class</div>
        <ClassPicker classes={classes} value={classId} onChange={setClassId} />
        <div className="row-2">
          <div><div className="field-label">Start time</div><input type="time" className="input" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div>
          <div><div className="field-label">End time (optional)</div><input type="time" className="input" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></div>
        </div>
        <div className="field-label">Label (optional)</div>
        <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} />
        <div className="sheet-actions">
          <ConfirmDelete onConfirm={() => { onDelete(); onClose(); }} size={14} />
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={() => onSave({ day_of_week: dayOfWeek, class_id: classId, start_time: startTime, end_time: endTime || null, label: label.trim() || null })}>Save</button>
        </div>
      </div>
    </div>
  );
}

function TimetablePanel({ userId, classes }) {
  const [slots, setSlots] = useState([]);
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [classId, setClassId] = useState(classes[0]?.id || "");
  useEffect(() => { if (!classId && classes[0]) setClassId(classes[0].id); }, [classes, classId]);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("");
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingSlot, setEditingSlot] = useState(null);
  const [ttImport, setTtImport] = useState(null); // csv string

  const load = useCallback(async () => { setSlots(await db.fetchTimetable(userId)); }, [userId]);
  useEffect(() => { load(); }, [load]);

  const addSlot = async () => {
    if (!classId) return;
    await db.createTimetableSlot(userId, classId, dayOfWeek, startTime, endTime || null, label.trim() || null, slots.length);
    setLabel(""); setCreating(false);
    load();
    toast("Timetable slot added");
  };
  const removeSlot = async (id) => { await db.deleteTimetableSlot(id); load(); toast("Slot removed"); };
  const saveSlot = async (id, patch) => { await db.updateTimetableSlot(id, patch); setEditingSlot(null); load(); toast("Slot updated"); };

  const importTimetable = async (rows) => {
    let imported = 0;
    for (const row of rows) {
      const day = parseInt(row.day_of_week, 10);
      if (isNaN(day) || day < 0 || day > 6 || !row.start_time) continue;
      const cls = classes.find((c) => c.name.toLowerCase().trim() === (row.class_name || "").toLowerCase().trim())
        || classes.find((c) => c.name.toLowerCase().includes((row.class_name || "").toLowerCase().trim()));
      if (!cls) continue;
      await db.createTimetableSlot(userId, cls.id, day, row.start_time, row.end_time || null, row.label || null, slots.length + imported);
      imported++;
    }
    await db.createImportLog(userId, "timetable", "Weekly timetable", ttImport, rows.length);
    setTtImport(null);
    load();
    toast(`Imported ${imported} of ${rows.length} slots`);
  };

  const byDay = DAY_LABELS.map((_, i) => slots.filter((s) => s.day_of_week === i));

  return (
    <div>
      <div className="card">
        <div className="card-title-row">
          <div className="card-title" style={{ marginBottom: 0 }}>Weekly timetable</div>
          <PhotoImportButton kind="timetable" onResult={({ csv }) => setTtImport(csv)} label="Import from photo" />
        </div>
        {!creating ? (
          <button className="btn btn-primary" style={{ marginTop: 10 }} onClick={() => setCreating(true)}><Plus size={14} /> Add slot</button>
        ) : (
          <>
            <div className="field-label">Day</div>
            <select className="input" value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))}>
              {DAY_LABELS.map((d, i) => <option key={d} value={i}>{d}</option>)}
            </select>
            <div className="field-label">Class</div>
            <ClassPicker classes={classes} value={classId} onChange={setClassId} />
            <div className="row-2">
              <div><div className="field-label">Start time</div><input type="time" className="input" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div>
              <div><div className="field-label">End time (optional)</div><input type="time" className="input" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></div>
            </div>
            <div className="field-label">Label (optional)</div>
            <input className="input" placeholder="e.g. Period 3" value={label} onChange={(e) => setLabel(e.target.value)} />
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button className="btn btn-ghost" onClick={() => setCreating(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addSlot}>Add</button>
            </div>
          </>
        )}
      </div>

      <div className="card">
        {byDay.every((d) => d.length === 0) ? (
          <div className="card-sub">No timetable slots yet. Add one above, or import a photo of your timetable.</div>
        ) : DAY_LABELS.map((day, i) => byDay[i].length > 0 && (
          <div key={day}>
            <div className="timetable-day-header">{day}</div>
            {byDay[i].map((s) => (
              <div className="timetable-slot-row" key={s.id}>
                <div style={{ cursor: "pointer" }} onClick={() => setEditingSlot(s)}>
                  <span className="mono" style={{ fontSize: 12.5, fontWeight: 700 }}>{s.start_time?.slice(0, 5)}{s.end_time ? ` - ${s.end_time.slice(0, 5)}` : ""}</span>
                  {" "}{s.classes?.name || "Unknown class"}{s.label ? ` (${s.label})` : ""}
                </div>
                <ConfirmDelete onConfirm={() => removeSlot(s.id)} size={13} />
              </div>
            ))}
          </div>
        ))}
      </div>

      {ttImport && (
        <CsvReviewSheet
          title="Import timetable"
          csv={ttImport}
          columns={["day_of_week", "start_time", "end_time", "class_name", "label"]}
          onClose={() => setTtImport(null)}
          onConfirm={importTimetable}
        />
      )}
      {editingSlot && (
        <SlotEditSheet
          slot={editingSlot}
          classes={classes}
          onClose={() => setEditingSlot(null)}
          onSave={(patch) => saveSlot(editingSlot.id, patch)}
          onDelete={() => removeSlot(editingSlot.id)}
        />
      )}
    </div>
  );
}

/* ---------- shell ---------- */

/** Date-wise / chapter-wise filterable browsing list of every classwork & homework item logged in
 *  the Planner for a class - the "exhaustive list" view, read-only here (edit happens in Planner). */
function ConceptsPanel({ userId, classes }) {
  const [classId, setClassId] = useState(classes[0]?.id || "");
  useEffect(() => { if (!classId && classes[0]) setClassId(classes[0].id); }, [classes, classId]);
  const [items, setItems] = useState([]);
  const [typeFilter, setTypeFilter] = useState("all"); // all | classwork | homework
  const [chapterFilter, setChapterFilter] = useState("");
  const [importantOnly, setImportantOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [chapterNumbers, setChapterNumbers] = useState([]);

  const load = useCallback(async () => {
    if (!classId) return;
    const [rows, numbers] = await Promise.all([db.fetchClassworkHomework(userId, classId), db.fetchChapterNumbers(userId, classId)]);
    setItems(rows); setChapterNumbers(numbers);
  }, [userId, classId]);
  useEffect(() => { load(); }, [load]);

  const filtered = items.filter((it) =>
    (typeFilter === "all" || it.type === typeFilter) &&
    (!chapterFilter || it.chapterNumber === chapterFilter) &&
    (!importantOnly || it.important) &&
    (!search.trim() || it.text.toLowerCase().includes(search.trim().toLowerCase()))
  );

  return (
    <div>
      <div className="card">
        <div className="field-label" style={{ marginTop: 0 }}>Class</div>
        <ClassPicker classes={classes} value={classId} onChange={setClassId} />
        <div className="cwhw-filter-row" style={{ marginTop: 10 }}>
          <select className="input" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">All types</option>
            <option value="classwork">Classwork</option>
            <option value="homework">Homework</option>
          </select>
          <select className="input" value={chapterFilter} onChange={(e) => setChapterFilter(e.target.value)}>
            <option value="">All chapters</option>
            {chapterNumbers.map((n) => <option key={n} value={n}>Ch {n}</option>)}
          </select>
        </div>
        <div className="cwhw-filter-row">
          <input className="input" placeholder="Search text..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <button type="button" className={`chip-btn ${importantOnly ? "active" : ""}`} style={importantOnly ? { background: "#F2790C", color: "#fff", borderColor: "transparent" } : undefined} onClick={() => setImportantOnly(!importantOnly)}>
            <Star size={12} fill={importantOnly ? "currentColor" : "none"} /> Important
          </button>
        </div>
      </div>
      <div className="card">
        {filtered.length === 0 ? (
          <div className="card-sub">Nothing matches - items come from what you log in the Planner's Classwork/Homework lists.</div>
        ) : filtered.map((it, i) => (
          <div className="cwhw-item-row" key={i}>
            <span className="cwhw-item-text">
              {it.important && <Star size={12} color="#F2790C" fill="#F2790C" />}
              {it.text}
            </span>
            <span className="cwhw-item-meta">
              <span className={`cwhw-type-chip ${it.type}`}>{it.type === "classwork" ? "CW" : "HW"}</span>
              {it.medium && <span>{it.medium}</span>}
              {it.chapterNumber && <span>Ch {it.chapterNumber}</span>}
              <span className="mono">{it.date}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Canonical per-grade chapter list (shared across every section of that grade), plus
 *  "folder work" for supplementary material the school itself hands out. Manual entry
 *  or photo import (camera/library via PhotoImportButton -> CsvReviewSheet). */
function SyllabusPanel({ userId, classes, mySchool }) {
  const grades = [...new Set(classes.map((c) => c.grade).filter(Boolean))];
  const [grade, setGrade] = useState(grades[0] || "");
  useEffect(() => { if (!grade && grades[0]) setGrade(grades[0]); }, [grades, grade]);
  const [chapters, setChapters] = useState([]);
  const [chapterNumber, setChapterNumber] = useState("");
  const [chapterName, setChapterName] = useState("");
  const [kind, setKind] = useState("syllabus");
  const [csvImport, setCsvImport] = useState(null); // csv string

  const load = useCallback(async () => {
    if (!grade) return;
    setChapters(await db.fetchSyllabus(mySchool.id, grade));
  }, [mySchool.id, grade]);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!chapterName.trim()) return;
    await db.createSyllabusChapter(mySchool.id, userId, grade, { chapter_number: chapterNumber.trim(), chapter_name: chapterName.trim(), kind }, chapters.length);
    setChapterNumber(""); setChapterName(""); load();
    toast("Chapter added");
  };
  const remove = async (id) => { await db.deleteSyllabusChapter(id); load(); toast("Chapter removed"); };
  const importChapters = async (rows) => {
    const valid = rows.filter((r) => r.chapter_name?.trim());
    await db.bulkCreateSyllabusChapters(mySchool.id, userId, grade, valid, chapters.length);
    setCsvImport(null); load();
    toast(`Imported ${valid.length} chapters`);
  };

  if (grades.length === 0) {
    return <div className="card"><div className="empty-state-text">Set a Grade on your classes (Teach {'\u2192'} Classes) to use a shared syllabus across sections.</div></div>;
  }

  return (
    <div>
      <div className="card">
        <div className="card-title-row">
          <div className="field-label" style={{ marginTop: 0 }}>Grade</div>
          <PhotoImportButton kind="syllabus" onResult={({ csv }) => setCsvImport(csv)} label="Import chapters" />
        </div>
        <select className="input" value={grade} onChange={(e) => setGrade(e.target.value)}>
          {grades.map((g) => <option key={g} value={g}>Grade {g}</option>)}
        </select>
        <div className="card-sub" style={{ marginTop: 8 }}>Shared by every class with this grade - sections don't duplicate the list.</div>
      </div>
      <div className="card">
        <div className="card-title">Add a chapter</div>
        <div className="row-2">
          <input className="input" placeholder="Number (optional)" value={chapterNumber} onChange={(e) => setChapterNumber(e.target.value)} />
          <input className="input" placeholder="Chapter / unit name" value={chapterName} onChange={(e) => setChapterName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())} />
        </div>
        <div className="cat-select" style={{ marginTop: 8 }}>
          <button type="button" className={`cat-opt ${kind === "syllabus" ? "active" : ""}`} style={{ color: kind === "syllabus" ? "#F2790C" : undefined }} onClick={() => setKind("syllabus")}>Syllabus</button>
          <button type="button" className={`cat-opt ${kind === "folder_work" ? "active" : ""}`} style={{ color: kind === "folder_work" ? "#8B7FC7" : undefined }} onClick={() => setKind("folder_work")}>Folder work</button>
        </div>
        <button type="button" className="btn btn-primary" style={{ marginTop: 10, width: "100%" }} onClick={add}><Plus size={14} /> Add</button>
      </div>
      <div className="card">
        <div className="card-title">Chapter list</div>
        {chapters.length === 0 ? <div className="card-sub">No chapters yet for this grade.</div> : chapters.map((c) => (
          <div className="marks-row" key={c.id}>
            <span>{c.chapter_number ? `Ch ${c.chapter_number}: ` : ""}{c.chapter_name} {c.kind === "folder_work" && <span className="badge-mini" style={{ color: "#8B7FC7", background: "#8B7FC715" }}>Folder work</span>}</span>
            <ConfirmDelete onConfirm={() => remove(c.id)} size={13} />
          </div>
        ))}
      </div>
      {csvImport && (
        <CsvReviewSheet
          title="Import syllabus"
          csv={csvImport}
          columns={["chapter_number", "chapter_name"]}
          onClose={() => setCsvImport(null)}
          onConfirm={importChapters}
        />
      )}
    </div>
  );
}

const TEACH_SECTIONS = [
  { value: "planner", label: "Planner", sub: "Chapters, objectives & concepts", icon: ClipboardList, color: "#F2790C" },
  { value: "concepts", label: "Classwork & Homework", sub: "Every question/concept logged, filterable", icon: Filter, color: "#8B7FC7" },
  { value: "syllabus", label: "Syllabus", sub: "Chapters per grade, shared across sections", icon: BookOpen, color: "#5B7FDB" },
  { value: "attendance", label: "Attendance", sub: "Today's roll call, class by class", icon: ClipboardCheck, color: "#2FA88F" },
  { value: "correction", label: "Correction", sub: "Classwork & homework check-off", icon: Check, color: "#5B7FDB" },
  { value: "performance", label: "Scores", sub: "Tests, marks & concept breakdown", icon: BarChart3, color: "#8B7FC7" },
  { value: "absences", label: "Absences", sub: "Who missed what lesson", icon: UserX, color: "#E8556B" },
  { value: "timetable", label: "Timetable", sub: "Your weekly class schedule", icon: CalendarClock, color: "#D9A441" },
  { value: "classes", label: "Classes", sub: "Rosters, students & sections", icon: Users, color: "#4FB3C4" },
];
// shown only for the roles that need them
const SIGNOFF_SECTION = { value: "signoff", label: "Sign-off", sub: "Review lessons waiting on you", icon: ShieldCheck, color: "#D9A441" };
const ADMIN_SECTION = { value: "admin", label: "School admin", sub: "Structure, people & invites", icon: Building2, color: "#2A2723" };

function TeachHome({ classes, sections, onOpen }) {
  const studentCount = classes.reduce((sum, c) => sum + c.students.length, 0);
  return (
    <div className="page">
      <h2 className="page-title">Teach</h2>
      <div className="card home-summary-card">
        <div className="home-summary-num">{classes.length}</div>
        <div className="home-summary-label">class{classes.length === 1 ? "" : "es"}</div>
        <div className="home-summary-divider" />
        <div className="home-summary-num">{studentCount}</div>
        <div className="home-summary-label">student{studentCount === 1 ? "" : "s"}</div>
      </div>
      <div className="home-list">
        {sections.map((s) => (
          <button type="button" key={s.value} className="home-list-item" onClick={() => onOpen(s.value)}>
            <span className="home-list-icon" style={{ color: s.color, background: `${s.color}17` }}><s.icon size={19} /></span>
            <span className="home-list-text">
              <span className="home-list-title">{s.label}</span>
              <span className="home-list-sub">{s.sub}</span>
            </span>
            <ChevronRight size={17} className="home-list-chevron" />
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Teach({ userId, classes, reloadClasses, school: mySchool }) {
  const [sub, setSub] = useState(null);
  const role = mySchool?.role;
  const canReview = role === "coordinator" || role === "school_admin" || role === "super_admin";
  const canAdmin = role === "school_admin" || role === "super_admin";

  const sections = [
    ...TEACH_SECTIONS,
    ...(canReview ? [SIGNOFF_SECTION] : []),
    ...(canAdmin ? [ADMIN_SECTION] : []),
  ];

  if (!sub) return <TeachHome classes={classes} sections={sections} onOpen={setSub} />;

  const section = sections.find((s) => s.value === sub);
  return (
    <div className="page">
      <button type="button" className="section-back" onClick={() => setSub(null)}>
        <ChevronLeft size={18} /> <span className="section-back-icon" style={{ color: section.color, background: `${section.color}17` }}><section.icon size={15} /></span> {section.label}
      </button>
      {sub === "planner" && <PlannerPanel userId={userId} classes={classes} mySchool={mySchool} />}
      {sub === "concepts" && <ConceptsPanel userId={userId} classes={classes} />}
      {sub === "syllabus" && <SyllabusPanel userId={userId} classes={classes} mySchool={mySchool} />}
      {sub === "attendance" && <AttendancePanel userId={userId} classes={classes} />}
      {sub === "correction" && <CorrectionPanel userId={userId} classes={classes} mySchool={mySchool} />}
      {sub === "performance" && <PerformancePanel userId={userId} classes={classes} mySchool={mySchool} />}
      {sub === "absences" && <AbsencePanel userId={userId} classes={classes} />}
      {sub === "timetable" && <TimetablePanel userId={userId} classes={classes} />}
      {sub === "classes" && <ClassesPanel userId={userId} classes={classes} reloadClasses={reloadClasses} />}
      {sub === "signoff" && canReview && <SignoffPanel schoolId={mySchool.id} userId={userId} />}
      {sub === "admin" && canAdmin && <AdminPanel userId={userId} schoolId={mySchool.id} classes={classes} reloadClasses={reloadClasses} />}
    </div>
  );
}

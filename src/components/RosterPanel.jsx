import React, { useEffect, useState, useCallback } from "react";
import { Plus, X } from "lucide-react";
import ConfirmDelete from "./ConfirmDelete";
import PhotoImportButton from "./PhotoImportButton";
import CsvReviewSheet from "./CsvReviewSheet";
import { toast } from "./Toast";
import * as school from "../lib/school";
import * as db from "../lib/db";

const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true });
const gradeLabel = (n) => (/^\d+$/.test(n) ? `Grade ${n}` : n);

function StudentSheet({ student, onClose, onSave, onDelete }) {
  const [name, setName] = useState(student.name);
  const [rollNo, setRollNo] = useState(student.roll_no || "");
  const [contact, setContact] = useState(student.contact || "");
  const [notes, setNotes] = useState(student.notes || "");
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2 className="sheet-title">Edit student</h2>
          <button type="button" className="btn btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="card-sub" style={{ marginBottom: 8 }}>Changes apply to every subject of this section.</div>
        <div className="field-label">Name</div>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <div className="row-2">
          <div><div className="field-label">Roll no.</div><input className="input" value={rollNo} onChange={(e) => setRollNo(e.target.value)} /></div>
          <div><div className="field-label">Contact</div><input className="input" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Phone or email" /></div>
        </div>
        <div className="field-label">Notes</div>
        <textarea className="input textarea" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div className="sheet-actions">
          <ConfirmDelete onConfirm={() => { onDelete(); onClose(); }} size={14} />
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={() => name.trim() && onSave({ name, roll_no: rollNo, contact, notes })}>Save</button>
        </div>
      </div>
    </div>
  );
}

export default function RosterPanel({ schoolId, role, gradeId }) {
  const [structure, setStructure] = useState(null);
  const [classes, setClasses] = useState([]);
  const [sectionId, setSectionId] = useState("");
  const [name, setName] = useState("");
  const [rollNo, setRollNo] = useState("");
  const [editing, setEditing] = useState(null);
  const [csv, setCsv] = useState(null);

  const load = useCallback(async () => {
    try {
      const [s, c] = await Promise.all([school.fetchStructure(schoolId), db.fetchSchoolClasses(schoolId)]);
      setStructure(s); setClasses(c);
    } catch (err) { toast(err.message || "Couldn't load", "error"); }
  }, [schoolId]);
  useEffect(() => { load(); }, [load]);

  if (!structure) return <div className="card-sub">Loading...</div>;

  const grades = [...structure.grades].sort(byName).filter((g) => role !== "coordinator" || !gradeId || g.id === gradeId);
  const options = [];
  for (const g of grades) for (const s of structure.sections.filter((x) => x.grade_id === g.id).sort(byName)) options.push({ id: s.id, label: `${gradeLabel(g.name)} - Section ${s.name}` });
  const secId = options.find((o) => o.id === sectionId)?.id || options[0]?.id || "";

  const sectionClasses = classes.filter((c) => c.section_id === secId);
  const persons = [];
  const seen = new Set();
  for (const c of sectionClasses) for (const st of c.students || []) {
    if (!seen.has(st.person_id)) { seen.add(st.person_id); persons.push(st); }
  }
  persons.sort((a, b) => a.name.localeCompare(b.name));

  const run = async (fn, okMsg) => {
    try { await fn(); await load(); if (okMsg) toast(okMsg); }
    catch (err) { toast(err.message || "Something went wrong", "error"); }
  };
  const add = () => {
    if (!name.trim()) return;
    const n = name, r = rollNo;
    setName(""); setRollNo("");
    run(() => school.rosterAddStudent(secId, n, r), "Student added");
  };
  const importRows = async (rows) => {
    let added = 0;
    for (const row of rows) {
      if (!row.name?.trim()) continue;
      try { await school.rosterAddStudent(secId, row.name, row.roll_no); added++; } catch (err) { toast(err.message, "error"); break; }
    }
    setCsv(null); await load(); toast(`Imported ${added} students`);
  };

  if (options.length === 0) return <div className="card"><div className="card-sub">No sections yet. The admin sets up grades and sections in School admin > Structure.</div></div>;

  return (
    <div>
      <div className="card">
        <div className="field-label" style={{ marginTop: 0 }}>Section</div>
        <select className="input" value={secId} onChange={(e) => setSectionId(e.target.value)}>
          {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        <div className="card-sub" style={{ marginTop: 6 }}>
          {persons.length} student{persons.length === 1 ? "" : "s"}. One roster shared by {sectionClasses.length} subject class{sectionClasses.length === 1 ? "" : "es"}{sectionClasses.length ? ` (${sectionClasses.map((c) => c.subject || c.name).join(", ")})` : ""}.
        </div>
        {sectionClasses.length === 0 ? (
          <div className="card-sub" style={{ marginTop: 8 }}>No class in this section yet. In School admin > Assign, give a teacher one subject for this section first.</div>
        ) : (
          <>
            <div className="row-2" style={{ marginTop: 10 }}>
              <input className="input" placeholder="Student name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
              <input className="input" placeholder="Roll no. (optional)" value={rollNo} onChange={(e) => setRollNo(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
            </div>
            <button type="button" className="btn btn-ghost" style={{ marginTop: 8 }} onClick={add}><Plus size={14} /> Add student</button>
            <div style={{ marginTop: 8 }}>
              <PhotoImportButton kind="roster" onResult={({ csv: text }) => setCsv(text)} label="Import roster from photo" />
            </div>
          </>
        )}
      </div>
      {persons.length > 0 && (
        <div className="card">
          <div className="student-chip-wrap">
            {persons.map((s) => (
              <button type="button" className="student-chip student-chip-editable" key={s.person_id} onClick={() => setEditing(s)}>
                {s.name}{s.roll_no ? ` (${s.roll_no})` : ""}
              </button>
            ))}
          </div>
        </div>
      )}
      {editing && (
        <StudentSheet student={editing} onClose={() => setEditing(null)}
          onSave={(f) => { run(() => school.rosterUpdateStudent(editing.person_id, f), "Student updated"); setEditing(null); }}
          onDelete={() => run(() => school.rosterRemoveStudent(editing.person_id), "Student removed")} />
      )}
      {csv && (
        <CsvReviewSheet title="Import roster" csv={csv} columns={["name", "roll_no"]} onClose={() => setCsv(null)} onConfirm={importRows} />
      )}
    </div>
  );
}

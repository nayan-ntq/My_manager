import React, { useEffect, useState } from "react";
import { X, Plus } from "lucide-react";
import { toast } from "./Toast";
import * as school from "../lib/school";
import * as db from "../lib/db";

const active = { background: "#F2790C", color: "#fff", borderColor: "transparent" };
const chapKey = (c) => `${c.chapter_number || ""}|${c.chapter_name}`;

export default function ExamSyllabusEditor({ exam, gradeName, subjectName, schoolId, canSubmit, onClose, onDone }) {
  const [chapters, setChapters] = useState(exam.syllabus_chapters || []);
  const [concepts, setConcepts] = useState(exam.syllabus_concepts || []);
  const [text, setText] = useState(exam.syllabus_text || "");
  const [syllabus, setSyllabus] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [filter, setFilter] = useState("");
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    db.fetchSyllabus(schoolId, gradeName, subjectName).then(setSyllabus).catch(() => setSyllabus([]));
    school.fetchGradePlan(exam.grade_id, exam.subject_id).then((lectures) => {
      const seen = new Set();
      const out = [];
      for (const l of lectures) {
        for (const it of [...(l.classwork_items || []), ...(l.homework_items || [])]) {
          const t = (it.text || "").trim();
          if (!t) continue;
          const label = it.exercise ? `${it.exercise} ${t}` : t;
          if (!seen.has(label)) { seen.add(label); out.push(label); }
        }
      }
      setSuggestions(out);
    }).catch(() => setSuggestions([]));
  }, [exam.id]);

  const chapOn = (c) => chapters.some((x) => chapKey(x) === chapKey(c));
  const toggleChap = (c) => setChapters(chapOn(c)
    ? chapters.filter((x) => chapKey(x) !== chapKey(c))
    : [...chapters, { chapter_number: c.chapter_number || null, chapter_name: c.chapter_name }]);
  const addConcept = (t) => { const v = t.trim(); if (v && !concepts.includes(v)) setConcepts([...concepts, v]); };
  const shown = suggestions.filter((s) => !concepts.includes(s) && (!filter.trim() || s.toLowerCase().includes(filter.trim().toLowerCase())));

  const save = async (andSubmit) => {
    setBusy(true);
    try {
      await school.saveExamSyllabus(exam.id, chapters, concepts, text);
      if (andSubmit) await school.submitExamSyllabus(exam.id);
      toast(andSubmit ? "Submitted for approval" : "Syllabus saved");
      onDone();
    } catch (err) { toast(err.message || "Couldn't save", "error"); }
    finally { setBusy(false); }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2 className="sheet-title">Exam syllabus</h2>
          <button type="button" className="btn btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="card-sub" style={{ marginBottom: 6 }}>{exam.title}</div>
        {exam.syllabus_status === "approved" && <div className="autofill-hint" style={{ marginTop: 0 }}>This syllabus is approved. Changes you save apply to every section's test straight away.</div>}

        <div className="field-label">Chapters covered</div>
        {syllabus.length === 0 ? <div className="card-sub">No chapters in the Syllabus section for this grade and subject yet.</div> : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {syllabus.map((c) => (
              <button key={c.id} type="button" className="chip-btn" style={chapOn(c) ? active : undefined} onClick={() => toggleChap(c)}>
                {c.chapter_number ? `Ch ${c.chapter_number}: ` : ""}{c.chapter_name}
              </button>
            ))}
          </div>
        )}

        <div className="field-label">Concepts and questions in the exam ({concepts.length})</div>
        {concepts.length === 0 ? <div className="card-sub">Nothing added yet. Tap suggestions from the grade plan below, or type your own.</div> : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {concepts.map((c) => (
              <span key={c} className="chip-btn" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                {c}
                <button type="button" onClick={() => setConcepts(concepts.filter((x) => x !== c))} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 0, display: "flex" }}><X size={11} /></button>
              </span>
            ))}
          </div>
        )}
        <div className="row-2" style={{ marginTop: 8 }}>
          <input className="input" placeholder="Add your own concept or question" value={custom} onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addConcept(custom); setCustom(""); } }} />
          <button type="button" className="btn btn-ghost" onClick={() => { addConcept(custom); setCustom(""); }}><Plus size={14} /> Add</button>
        </div>

        <div className="field-label">From the grade plan (tap to add)</div>
        {suggestions.length === 0 ? <div className="card-sub">The grade plan has no questions yet.</div> : (
          <>
            <input className="input" placeholder="Search..." value={filter} onChange={(e) => setFilter(e.target.value)} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8, maxHeight: 190, overflowY: "auto" }}>
              {shown.map((s) => <button key={s} type="button" className="chip-btn" onClick={() => addConcept(s)}>{s}</button>)}
              {shown.length === 0 && <div className="card-sub">Nothing more to add.</div>}
            </div>
          </>
        )}

        <div className="field-label">Notes for teachers (optional)</div>
        <textarea className="input textarea" placeholder="Anything else teachers should know about this exam's syllabus" value={text} onChange={(e) => setText(e.target.value)} />

        <div className="sheet-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => save(false)}>Save</button>
          {canSubmit && <button type="button" className="btn btn-primary" disabled={busy} onClick={() => save(true)}>Save and submit</button>}
        </div>
      </div>
    </div>
  );
}

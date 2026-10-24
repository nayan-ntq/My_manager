import React, { useState, useEffect } from "react";
import { Plus, X, Star, Check } from "lucide-react";
import { MEDIUM_OPTIONS } from "../lib/constants";
import ConfirmDelete from "./ConfirmDelete";

/** Turns a structured classwork/homework item list into a readable text summary, grouped
 *  by exercise - e.g. "Ex 8.3: B9, B10; Ex 8.4: Q1, Q4" - for anything that still reads
 *  the plain-text methodology/assignment columns (Correction's suggestion chips). */
export function itemsToText(items) {
  if (!items?.length) return "";
  const groups = [];
  for (const it of items) {
    let g = groups.find((g) => g.exercise === (it.exercise || ""));
    if (!g) { g = { exercise: it.exercise || "", texts: [] }; groups.push(g); }
    g.texts.push(it.text);
  }
  return groups.map((g) => g.exercise ? `${g.exercise}: ${g.texts.join(", ")}` : g.texts.join(", ")).join("; ");
}

/** Exercise-group name editor. Edits are buffered locally and only committed on blur/Enter -
 *  committing per keystroke would re-key the whole group on every character (losing focus),
 *  and clearing the name mid-edit would collapse the group into "Ungrouped". */
function ExerciseNameInput({ name, onRename, placeholder = "Exercise name" }) {
  const [draft, setDraft] = useState(name);
  useEffect(() => { setDraft(name); }, [name]);
  const commit = () => {
    const next = draft.trim();
    if (next && next !== name) onRename(name, next);
    else setDraft(name);
  };
  return (
    <input className="input concept-exercise-name" value={draft} placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }} />
  );
}

/** Repeatable list of {text, medium, important} rows - used for both Classwork (from
 *  Methodology) and Homework (from Assignment) on a planner entry. */
/** Classwork/Homework questions nested under their exercise (e.g. "Ex 8.3", "W/S-1") -
 *  within a chapter: Chapter -> Exercise -> Question. Items with no exercise set yet
 *  land in a single "Ungrouped" bucket at the top until given one. */
export function ConceptItemList({ label, items, onChange }) {
  const exercises = [...new Set(items.map((it) => it.exercise || ""))];
  if (!exercises.includes("")) exercises.unshift(""); // always offer an "add new exercise" entry point

  const updateRow = (globalIndex, patch) => onChange(items.map((it, idx) => idx === globalIndex ? { ...it, ...patch } : it));
  const removeRow = (globalIndex) => onChange(items.filter((_, idx) => idx !== globalIndex));
  const addRowToExercise = (exercise) => onChange([...items, { text: "", medium: "", important: false, exercise }]);
  const renameExercise = (oldName, newName) => onChange(items.map((it) => (it.exercise || "") === oldName ? { ...it, exercise: newName } : it));
  const removeGroup = (exercise) => onChange(items.filter((it) => (it.exercise || "") !== exercise));
  const addNewExercise = () => onChange([...items, { text: "", medium: "", important: false, exercise: "New exercise" }]);

  return (
    <div style={{ marginTop: 14 }}>
      <div className="field-label" style={{ marginTop: 0 }}>{label}</div>
      {exercises.filter((ex) => ex || items.some((it) => !it.exercise)).map((ex) => {
        const rowsInGroup = items.map((it, idx) => ({ it, idx })).filter(({ it }) => (it.exercise || "") === ex);
        if (ex === "" && rowsInGroup.length === 0) return null;
        return (
          <div className="concept-exercise-group" key={ex || "_ungrouped"}>
            {ex !== "" ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <ExerciseNameInput name={ex} onRename={renameExercise} />
                <ConfirmDelete onConfirm={() => removeGroup(ex)} size={13} />
              </div>
            ) : (
              <div className="concept-exercise-name concept-exercise-name-placeholder">Ungrouped</div>
            )}
            {rowsInGroup.map(({ it, idx }) => (
              <div key={idx} className="concept-item-row">
                <button type="button" className={`btn btn-icon concept-item-done ${it.done ? "on" : ""}`} title="Mark this question done" onClick={() => updateRow(idx, { done: !it.done })}><Check size={13} /></button>
                <input className="input" placeholder="Question (e.g. Q4, B9, whole)" value={it.text} onChange={(e) => updateRow(idx, { text: e.target.value })} style={it.done ? { textDecoration: "line-through", color: "#9c9488" } : undefined} />
                <select className="input concept-item-medium" value={it.medium} onChange={(e) => updateRow(idx, { medium: e.target.value })}>
                  <option value="">Medium...</option>
                  {MEDIUM_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <button type="button" className={`btn btn-icon concept-item-star ${it.important ? "on" : ""}`} title="Mark important" onClick={() => updateRow(idx, { important: !it.important })}><Star size={13} fill={it.important ? "currentColor" : "none"} /></button>
                <button type="button" className="btn btn-icon" onClick={() => removeRow(idx)}><X size={13} /></button>
              </div>
            ))}
            <button type="button" className="chip-btn" style={{ marginTop: 4 }} onClick={() => addRowToExercise(ex)}><Plus size={11} /> Add question</button>
          </div>
        );
      })}
      <button type="button" className="chip-btn" onClick={addNewExercise}><Plus size={12} /> Add exercise</button>
    </div>
  );
}

export default function PlannerEntryEditSheet({ entry, onClose, onSave, onMarkTaught, hideStatus = false }) {
  const [form, setForm] = useState({
    chapter_number: entry.chapter_number || "", chapter: entry.chapter || "",
    objectives: entry.objectives || "", resources: entry.resources || "",
    classworkItems: entry.classwork_items?.length ? entry.classwork_items : (entry.concepts || []).map((t) => ({ text: t, medium: "", important: false })),
    homeworkItems: entry.homework_items?.length ? entry.homework_items : (entry.exercise_list || []).map((t) => ({ text: t, medium: "", important: false })),
  });

  const save = () => {
    if (!form.chapter.trim()) return;
    const clean = (items) => items.map((it) => ({ ...it, text: it.text.trim() })).filter((it) => it.text);
    const classworkClean = clean(form.classworkItems), homeworkClean = clean(form.homeworkItems);
    onSave({
      chapter_number: form.chapter_number.trim() || null, chapter: form.chapter,
      objectives: form.objectives, methodology: itemsToText(classworkClean), resources: form.resources,
      assignment: itemsToText(homeworkClean),
      classwork_items: classworkClean, homework_items: homeworkClean,
      concepts: classworkClean.map((it) => it.text), exercise_list: homeworkClean.map((it) => it.text),
    });
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2 className="sheet-title">{entry.lecture_number ? `Lecture ${entry.lecture_number}` : "Edit planner entry"}</h2>
          <button type="button" className="btn btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        {!hideStatus && (
          <>
        <div className="field-label" style={{ marginTop: 0 }}>Classwork status</div>
        <div className="cat-select">
          <button type="button" className={`cat-opt ${entry.classwork_status === "completed" ? "active" : ""}`} style={{ color: "#2FA88F" }} onClick={() => onMarkTaught(entry, "classwork", "completed")}>Completed</button>
          <button type="button" className={`cat-opt ${entry.classwork_status === "partial" ? "active" : ""}`} style={{ color: "#F2790C" }} onClick={() => onMarkTaught(entry, "classwork", "partial")}>Partial</button>
          <button type="button" className={`cat-opt ${entry.classwork_status === "advanced" ? "active" : ""}`} style={{ color: "#5B7FDB" }} onClick={() => onMarkTaught(entry, "classwork", "advanced")}>Advanced</button>
          {entry.classwork_status && <button type="button" className="cat-opt" style={{ color: "#9c9488" }} onClick={() => onMarkTaught(entry, "classwork", null)}>Clear</button>}
        </div>
        <div className="field-label">Homework status</div>
        <div className="cat-select">
          <button type="button" className={`cat-opt ${entry.homework_status === "completed" ? "active" : ""}`} style={{ color: "#2FA88F" }} onClick={() => onMarkTaught(entry, "homework", "completed")}>Completed</button>
          <button type="button" className={`cat-opt ${entry.homework_status === "partial" ? "active" : ""}`} style={{ color: "#F2790C" }} onClick={() => onMarkTaught(entry, "homework", "partial")}>Partial</button>
          <button type="button" className={`cat-opt ${entry.homework_status === "advanced" ? "active" : ""}`} style={{ color: "#5B7FDB" }} onClick={() => onMarkTaught(entry, "homework", "advanced")}>Advanced</button>
          {entry.homework_status && <button type="button" className="cat-opt" style={{ color: "#9c9488" }} onClick={() => onMarkTaught(entry, "homework", null)}>Clear</button>}
        </div>
        {entry.taught_date && <div className="card-sub" style={{ marginBottom: 6 }}>Taught {entry.taught_date}</div>}
        <div className="card-sub" style={{ marginBottom: 10 }}>Tick off each question below as you go, to trace exactly how much work got done.</div>
          </>
        )}
        <div className="row-2">
          <div><div className="field-label">Chapter number</div><input className="input" value={form.chapter_number} onChange={(e) => setForm({ ...form, chapter_number: e.target.value })} /></div>
          <div><div className="field-label">Chapter name</div><input className="input" value={form.chapter} onChange={(e) => setForm({ ...form, chapter: e.target.value })} /></div>
        </div>
        <div className="field-label">Learning objectives</div>
        <textarea className="input textarea" value={form.objectives} onChange={(e) => setForm({ ...form, objectives: e.target.value })} />
               <div className="field-label">Resources</div>
        <input className="input" value={form.resources} onChange={(e) => setForm({ ...form, resources: e.target.value })} />
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

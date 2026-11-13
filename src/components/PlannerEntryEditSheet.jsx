import React, { useState, useEffect } from "react";
import { Plus, X, Star, Check } from "lucide-react";
import { MEDIUM_OPTIONS } from "../lib/constants";
import ConfirmDelete from "./ConfirmDelete";

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

function ExerciseNameInput({ name, onRename, placeholder, locked }) {
  const [draft, setDraft] = useState(name);
  useEffect(() => { setDraft(name); }, [name]);
  const commit = () => {
    const next = draft.trim();
    if (next && next !== name) onRename(name, next);
    else setDraft(name);
  };
  return (
    <input className="input concept-exercise-name" value={draft} placeholder={placeholder} readOnly={locked}
      onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }} />
  );
}

export function ConceptItemList({ label, items, onChange, locked = false }) {
  const exercises = [...new Set(items.map((it) => it.exercise || ""))];
  if (!exercises.includes("")) exercises.unshift("");

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
            {locked ? (
              <div className="concept-exercise-name" style={{ padding: "4px 2px 8px" }}>{ex || "Ungrouped"}</div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <ExerciseNameInput name={ex} onRename={renameExercise}
                  placeholder={ex === "" ? "Ungrouped - type a name (e.g. Ex 14.1) to group these" : "Exercise name"} />
                <ConfirmDelete onConfirm={() => removeGroup(ex)} size={13} />
              </div>
            )}
            {rowsInGroup.map(({ it, idx }) => (
              <div key={idx} className="concept-item-row">
                <button type="button" className={`btn btn-icon concept-item-done ${it.done ? "on" : ""}`} title="Mark this question done" onClick={() => updateRow(idx, { done: !it.done })}><Check size={13} /></button>
                <input className="input" placeholder="Question (e.g. Q4, B9, whole)" readOnly={locked} value={it.text} onChange={(e) => updateRow(idx, { text: e.target.value })} style={it.done ? { textDecoration: "line-through", color: "#9c9488" } : undefined} />
                <select className="input concept-item-medium" disabled={locked} value={it.medium} onChange={(e) => updateRow(idx, { medium: e.target.value })}>
                  <option value="">Medium...</option>
                  {MEDIUM_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <button type="button" className={`btn btn-icon concept-item-star ${it.important ? "on" : ""}`} title="Mark important" disabled={locked} onClick={() => updateRow(idx, { important: !it.important })}><Star size={13} fill={it.important ? "currentColor" : "none"} /></button>
                {!locked && <button type="button" className="btn btn-icon" onClick={() => removeRow(idx)}><X size={13} /></button>}
              </div>
            ))}
            {!locked && <button type="button" className="chip-btn" style={{ marginTop: 4 }} onClick={() => addRowToExercise(ex)}><Plus size={11} /> Add question</button>}
          </div>
        );
      })}
      {!locked && <button type="button" className="chip-btn" onClick={addNewExercise}><Plus size={12} /> Add exercise</button>}
    </div>
  );
}

export default function PlannerEntryEditSheet({ entry, onClose, onSave, onMarkTaught, hideStatus = false, lockContent = false }) {
  const [form, setForm] = useState({
    chapter_number: entry.chapter_number || "", chapter: entry.chapter || "",
    objectives: entry.objectives || "", resources: entry.resources || "",
    classworkItems: entry.classwork_items?.length ? entry.classwork_items : (entry.concepts || []).map((t) => ({ text: t, medium: "", important: false })),
    homeworkItems: entry.homework_items?.length ? entry.homework_items : (entry.exercise_list || []).map((t) => ({ text: t, medium: "", important: false })),
  });

  const save = () => {
    // a lecture from the grade plan: only the ticks (and notes) can change
    if (lockContent) {
      onSave({ classwork_items: form.classworkItems, homework_items: form.homeworkItems });
      return;
    }
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

  const statusGroup = (kind, label) => {
    const field = `${kind}_status`;
    return (
      <>
        <div className="field-label" style={kind === "classwork" ? { marginTop: 0 } : undefined}>{label}</div>
        <div className="cat-select">
          <button type="button" className={`cat-opt ${entry[field] === "completed" ? "active" : ""}`} style={{ color: "#2FA88F" }} onClick={() => onMarkTaught(entry, kind, "completed")}>Completed</button>
          <button type="button" className={`cat-opt ${entry[field] === "partial" ? "active" : ""}`} style={{ color: "#F2790C" }} onClick={() => onMarkTaught(entry, kind, "partial")}>Partial</button>
          <button type="button" className={`cat-opt ${entry[field] === "advanced" ? "active" : ""}`} style={{ color: "#5B7FDB" }} onClick={() => onMarkTaught(entry, kind, "advanced")}>Advanced</button>
          {entry[field] && <button type="button" className="cat-opt" style={{ color: "#9c9488" }} onClick={() => onMarkTaught(entry, kind, null)}>Clear</button>}
        </div>
      </>
    );
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2 className="sheet-title">{entry.lecture_number ? `Lecture ${entry.lecture_number}` : "Edit planner entry"}</h2>
          <button type="button" className="btn btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        {lockContent && (
          <div className="autofill-hint" style={{ marginTop: 0, marginBottom: 10 }}>
            This lecture comes from the grade plan. You can tick off questions and mark status. The content is set by the planning incharge.
          </div>
        )}
        {!hideStatus && (
          <>
            {statusGroup("classwork", "Classwork status")}
            {statusGroup("homework", "Homework status")}
            {entry.taught_date && <div className="card-sub" style={{ marginBottom: 6 }}>Taught {entry.taught_date}</div>}
            <div className="card-sub" style={{ marginBottom: 10 }}>Tick off each question below as you go, to trace exactly how much work got done.</div>
          </>
        )}
        <fieldset disabled={lockContent} style={{ border: "none", padding: 0, margin: 0, minWidth: 0 }}>
          <div className="row-2">
            <div><div className="field-label">Chapter number</div><input className="input" value={form.chapter_number} onChange={(e) => setForm({ ...form, chapter_number: e.target.value })} /></div>
            <div><div className="field-label">Chapter name</div><input className="input" value={form.chapter} onChange={(e) => setForm({ ...form, chapter: e.target.value })} /></div>
          </div>
          <div className="field-label">Learning objectives</div>
          <textarea className="input textarea" value={form.objectives} onChange={(e) => setForm({ ...form, objectives: e.target.value })} />
          <div className="field-label">Resources</div>
          <input className="input" value={form.resources} onChange={(e) => setForm({ ...form, resources: e.target.value })} />
        </fieldset>
        <ConceptItemList label="Classwork" items={form.classworkItems} locked={lockContent} onChange={(items) => setForm({ ...form, classworkItems: items })} />
        <ConceptItemList label="Homework" items={form.homeworkItems} locked={lockContent} onChange={(items) => setForm({ ...form, homeworkItems: items })} />
        <div className="sheet-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={save}>Save</button>
        </div>
      </div>
    </div>
  );
}

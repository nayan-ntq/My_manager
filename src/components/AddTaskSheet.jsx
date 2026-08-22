import React, { useState, useEffect } from "react";
import { X, Trash2, Plus } from "lucide-react";
import { CATEGORIES, CATEGORY_ORDER } from "../lib/constants";
import PhotoStrip from "./PhotoStrip";

function blank() {
  return { title: "", category: "professional", time: "09:00", duration: 15, anchored: false, important: false, subtasks: [], exercises: [] };
}

export default function AddTaskSheet({ editingTask, onClose, onSubmit, onDelete }) {
  function toFormShape(t) {
    return {
      title: t.title, category: t.category, time: t.time?.slice(0, 5) || "09:00",
      duration: t.duration, anchored: t.anchored, important: t.important,
      subtasks: (t.subtasks || []).map((s) => ({ title: s.title })),
      exercises: (t.exercises || []).map((e) => ({ name: e.name, photos: e.photos || [], sets: (e.sets || []).map((s) => ({ reps: s.reps, weight: s.weight })) })),
    };
  }
  const [form, setForm] = useState(editingTask ? toFormShape(editingTask) : blank());
  useEffect(() => { setForm(editingTask ? toFormShape(editingTask) : blank()); }, [editingTask]);

  const isGym = form.category === "gym";
  const submit = (e) => { e.preventDefault(); if (!form.title.trim()) return; onSubmit(form); };

  const addSubtaskRow = () => setForm({ ...form, subtasks: [...form.subtasks, { title: "" }] });
  const updateSubtaskRow = (i, title) => setForm({ ...form, subtasks: form.subtasks.map((s, idx) => idx === i ? { title } : s) });
  const removeSubtaskRow = (i) => setForm({ ...form, subtasks: form.subtasks.filter((_, idx) => idx !== i) });

  const addExercise = () => setForm({ ...form, exercises: [...form.exercises, { name: "", sets: [{ reps: "", weight: "" }], photos: [] }] });
  const removeExercise = (i) => setForm({ ...form, exercises: form.exercises.filter((_, idx) => idx !== i) });
  const renameExercise = (i, name) => setForm({ ...form, exercises: form.exercises.map((e, idx) => idx === i ? { ...e, name } : e) });
  const addSet = (i) => setForm({ ...form, exercises: form.exercises.map((e, idx) => idx === i ? { ...e, sets: [...e.sets, { reps: "", weight: "" }] } : e) });
  const removeSet = (i, si) => setForm({ ...form, exercises: form.exercises.map((e, idx) => idx === i ? { ...e, sets: e.sets.filter((_, sidx) => sidx !== si) } : e) });
  const updateSetField = (i, si, field, val) => setForm({ ...form, exercises: form.exercises.map((e, idx) => idx === i ? { ...e, sets: e.sets.map((s, sidx) => sidx === si ? { ...s, [field]: val } : s) } : e) });
  const addExercisePhoto = (i, dataUrl) => setForm({ ...form, exercises: form.exercises.map((e, idx) => idx === i ? { ...e, photos: [...(e.photos || []), dataUrl] } : e) });
  const removeExercisePhoto = (i, pi) => setForm({ ...form, exercises: form.exercises.map((e, idx) => idx === i ? { ...e, photos: (e.photos || []).filter((_, pidx) => pidx !== pi) } : e) });

  return (
    <div className="overlay" onClick={onClose}>
      <form className="sheet" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="sheet-head">
          <h2 className="sheet-title">{editingTask ? "Edit task" : "New task"}</h2>
          <button type="button" className="btn btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="field-label">Title</div>
        <input className="input" placeholder="e.g. Stretch" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
        <div className="field-label">Category</div>
        <div className="cat-select">
          {CATEGORY_ORDER.map((key) => {
            const c = CATEGORIES[key]; const Icon = c.icon;
            return (
              <div key={key} className={`cat-opt ${form.category === key ? "active" : ""}`} style={{ color: form.category === key ? c.color : undefined }} onClick={() => setForm({ ...form, category: key })}>
                <Icon size={16} />{c.label}
              </div>
            );
          })}
        </div>
        <div className="row-2">
          <div><div className="field-label">Time</div><input type="time" className="input" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></div>
          <div><div className="field-label">Duration (min)</div><input type="number" min="5" step="5" className="input" value={form.duration} onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })} /></div>
        </div>
        <div className="toggle-row">
          <div><div className="toggle-label">Locked time</div><div className="toggle-sub">Won't shift when other tasks run late</div></div>
          <div className={`switch ${form.anchored ? "on" : ""}`} onClick={() => setForm({ ...form, anchored: !form.anchored })}><div className="switch-knob" /></div>
        </div>
        <div className="toggle-row">
          <div><div className="toggle-label">Important</div><div className="toggle-sub">Counts toward streak, earns more points</div></div>
          <div className={`switch ${form.important ? "on" : ""}`} onClick={() => setForm({ ...form, important: !form.important })}><div className="switch-knob" /></div>
        </div>

        {isGym ? (
          <>
            <div className="field-label">Exercises</div>
            {form.exercises.map((ex, i) => (
              <div className="exercise-block" key={i}>
                <div className="exercise-head">
                  <input className="input" placeholder="Exercise name" value={ex.name} onChange={(e) => renameExercise(i, e.target.value)} />
                  <button type="button" className="btn btn-icon" onClick={() => removeExercise(i)}><X size={13} /></button>
                </div>
                <div className="set-rows">
                  <div className="set-row set-row-header"><span>Set</span><span>Reps</span><span>Weight (kg)</span><span /></div>
                  {ex.sets.map((s, si) => (
                    <div className="set-row" key={si}>
                      <span className="set-num">{si + 1}</span>
                      <input className="input set-input" type="number" placeholder="0" value={s.reps ?? ""} onChange={(e) => updateSetField(i, si, "reps", e.target.value === "" ? "" : Number(e.target.value))} />
                      <input className="input set-input" type="number" placeholder="0" value={s.weight ?? ""} onChange={(e) => updateSetField(i, si, "weight", e.target.value === "" ? "" : Number(e.target.value))} />
                      <button type="button" className="btn btn-icon" onClick={() => removeSet(i, si)}><X size={12} /></button>
                    </div>
                  ))}
                </div>
                <button type="button" className="chip-btn" onClick={() => addSet(i)}><Plus size={12} /> Add set</button>
                <div className="field-label" style={{ margin: "10px 0 6px" }}>Photos</div>
                <PhotoStrip photos={ex.photos || []} onAdd={(url) => addExercisePhoto(i, url)} onRemove={(pi) => removeExercisePhoto(i, pi)} />
              </div>
            ))}
            <button type="button" className="btn btn-ghost" style={{ width: "100%" }} onClick={addExercise}><Plus size={14} /> Add exercise</button>
          </>
        ) : (
          <>
            <div className="field-label">Subtasks (optional)</div>
            {form.subtasks.map((s, i) => (
              <div key={i} className="row-2" style={{ marginBottom: 8 }}>
                <input className="input" placeholder={`Step ${i + 1}`} value={s.title} onChange={(e) => updateSubtaskRow(i, e.target.value)} />
                <button type="button" className="btn btn-icon" style={{ flex: "0 0 auto" }} onClick={() => removeSubtaskRow(i)}><X size={13} /></button>
              </div>
            ))}
            <button type="button" className="chip-btn" onClick={addSubtaskRow}><Plus size={12} /> Add subtask</button>
          </>
        )}

        <div className="sheet-actions">
          {editingTask && <button type="button" className="btn btn-danger" onClick={() => { onDelete(editingTask.id); onClose(); }}><Trash2 size={14} /></button>}
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary">{editingTask ? "Save" : "Add task"}</button>
        </div>
      </form>
    </div>
  );
}

import React, { useState } from "react";
import { X, Trash2, CalendarClock, Star, Plus } from "lucide-react";
import { matchClassName } from "../lib/visionImport";

/** Compact inline editor for one classwork/homework item list within a single import-review card. */
function ItemListField({ label, items, onChange }) {
  const addRow = () => onChange([...items, { text: "", important: false }]);
  const updateRow = (i, patch) => onChange(items.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  const removeRow = (i) => onChange(items.filter((_, idx) => idx !== i));
  return (
    <div style={{ marginTop: 8 }}>
      <div className="field-label" style={{ margin: "8px 0 4px" }}>{label}</div>
      {items.map((it, i) => (
        <div key={i} style={{ display: "flex", gap: 5, marginBottom: 4 }}>
          <input className="input" style={{ fontSize: 12.5, padding: "7px 9px" }} value={it.text} onChange={(e) => updateRow(i, { text: e.target.value })} />
          <button type="button" className={`btn btn-icon concept-item-star ${it.important ? "on" : ""}`} onClick={() => updateRow(i, { important: !it.important })}><Star size={12} fill={it.important ? "currentColor" : "none"} /></button>
          <button type="button" className="btn btn-icon" onClick={() => removeRow(i)}><X size={12} /></button>
        </div>
      ))}
      <button type="button" className="chip-btn" onClick={addRow}><Plus size={11} /> Add</button>
    </div>
  );
}

/**
 * Shows every lesson entry Gemini extracted from the photo(s) - possibly
 * spanning several dates AND several classes/sections - for review before
 * anything is saved. Each entry is editable (date, class, chapter, concepts)
 * or removable. Confirming creates a planner entry for each row, in the
 * class each row is actually assigned to.
 */
export default function PlannerImportReviewSheet({ entries, classes, defaultClassId, onClose, onConfirm }) {
  const [rows, setRows] = useState(
    entries.map((e, i) => ({
      key: i,
      date: e.date || new Date().toISOString().slice(0, 10),
      classId: matchClassName(e.class_label, classes)?.id || defaultClassId,
      classLabelGuess: e.class_label || null,
      chapter_number: e.chapter_number || "",
      chapter: e.chapter || "",
      objectives: e.objectives || "",
      methodology: e.methodology || "",
      resources: e.resources || "",
      assignment: e.assignment || "",
      reflection: e.reflection || "",
      classworkItems: e.classwork_items?.length ? e.classwork_items : (e.concepts || []).map((t) => ({ text: t, important: false })),
      homeworkItems: e.homework_items?.length ? e.homework_items : (e.exercise_list || []).map((t) => ({ text: t, important: false })),
    }))
  );

  const update = (key, field, value) => setRows((prev) => prev.map((r) => r.key === key ? { ...r, [field]: value } : r));
  const remove = (key) => setRows((prev) => prev.filter((r) => r.key !== key));

  const confirm = () => {
    const clean = (items) => items.map((it) => ({ ...it, text: it.text.trim() })).filter((it) => it.text);
    onConfirm(rows.map((r) => ({
      date: r.date, classId: r.classId, chapter_number: r.chapter_number || null, chapter: r.chapter,
      objectives: r.objectives || null, methodology: r.methodology || null, resources: r.resources || null,
      assignment: r.assignment || null, reflection: r.reflection || null,
      classwork_items: clean(r.classworkItems), homework_items: clean(r.homeworkItems),
      concepts: clean(r.classworkItems).map((it) => it.text), exercise_list: clean(r.homeworkItems).map((it) => it.text),
    })));
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2 className="sheet-title">Import from photo</h2>
          <button type="button" className="btn btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="card-sub" style={{ marginBottom: 12 }}>
          Gemini found {rows.length} lesson{rows.length === 1 ? "" : "s"}. Check the class on each one if your
          photo covered more than one section - review everything else before saving.
        </div>

        {rows.length === 0 ? (
          <div className="empty-state"><div className="empty-state-text">Nothing left to import.</div></div>
        ) : rows.map((r) => (
          <div className="import-review-card" key={r.key}>
            <div className="card-title-row">
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <CalendarClock size={14} color="#F2790C" />
                <input type="date" className="input import-review-date" value={r.date} onChange={(e) => update(r.key, "date", e.target.value)} />
              </div>
              <button type="button" className="btn btn-icon" onClick={() => remove(r.key)}><Trash2 size={13} /></button>
            </div>
            <div className="field-label" style={{ margin: "6px 0 4px" }}>Class</div>
            <select className="input" value={r.classId || ""} onChange={(e) => update(r.key, "classId", e.target.value)}>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {r.classLabelGuess && !classes.some((c) => c.id === r.classId && matchClassName(r.classLabelGuess, classes)?.id === c.id) && (
              <div className="autofill-hint" style={{ marginTop: 6 }}>Photo showed "{r.classLabelGuess}" - couldn't match it to one of your classes exactly, double-check this one.</div>
            )}
            <div className="row-2" style={{ marginTop: 8 }}>
              <input className="input" placeholder="Chapter number" value={r.chapter_number} onChange={(e) => update(r.key, "chapter_number", e.target.value)} />
              <input className="input" placeholder="Chapter name" value={r.chapter} onChange={(e) => update(r.key, "chapter", e.target.value)} />
            </div>
            <ItemListField label="Classwork" items={r.classworkItems} onChange={(items) => update(r.key, "classworkItems", items)} />
            <ItemListField label="Homework" items={r.homeworkItems} onChange={(items) => update(r.key, "homeworkItems", items)} />
          </div>
        ))}

        <div className="sheet-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Discard</button>
          <button type="button" className="btn btn-primary" onClick={confirm} disabled={rows.length === 0}>Import {rows.length} lesson{rows.length === 1 ? "" : "s"}</button>
        </div>
      </div>
    </div>
  );
}

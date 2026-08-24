import React, { useState } from "react";
import { X, Trash2, CalendarClock } from "lucide-react";

/**
 * Shows every lesson entry Gemini extracted from the photo(s) - possibly
 * spanning several dates - for review before anything is saved. Each entry
 * is editable (date, chapter, concepts) or removable. Confirming creates a
 * planner entry AND a matching "teach this" task on Today for each date.
 */
export default function PlannerImportReviewSheet({ entries, onClose, onConfirm }) {
  const [rows, setRows] = useState(
    entries.map((e, i) => ({
      key: i,
      date: e.date || new Date().toISOString().slice(0, 10),
      chapter_number: e.chapter_number || "",
      chapter: e.chapter || "",
      objectives: e.objectives || "",
      methodology: e.methodology || "",
      resources: e.resources || "",
      assignment: e.assignment || "",
      reflection: e.reflection || "",
      concepts: [...(e.concepts || []), ...(e.exercise_list || [])].join(", "),
    }))
  );

  const update = (key, field, value) => setRows((prev) => prev.map((r) => r.key === key ? { ...r, [field]: value } : r));
  const remove = (key) => setRows((prev) => prev.filter((r) => r.key !== key));

  const confirm = () => {
    onConfirm(rows.map((r) => ({
      date: r.date, chapter_number: r.chapter_number || null, chapter: r.chapter,
      objectives: r.objectives || null, methodology: r.methodology || null, resources: r.resources || null,
      assignment: r.assignment || null, reflection: r.reflection || null,
      concepts: r.concepts.split(",").map((s) => s.trim()).filter(Boolean),
      exercise_list: [],
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
          Gemini found {rows.length} lesson{rows.length === 1 ? "" : "s"}. Review dates and details before saving - each
          one becomes a Planner entry, and shows up on Today for that date.
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
            <div className="row-2">
              <input className="input" placeholder="Chapter number" value={r.chapter_number} onChange={(e) => update(r.key, "chapter_number", e.target.value)} />
              <input className="input" placeholder="Chapter name" value={r.chapter} onChange={(e) => update(r.key, "chapter", e.target.value)} />
            </div>
            <input className="input" style={{ marginTop: 8 }} placeholder="Concepts / exercises (comma-separated)" value={r.concepts} onChange={(e) => update(r.key, "concepts", e.target.value)} />
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

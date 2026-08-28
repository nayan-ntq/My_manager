import React, { useState } from "react";
import { ChevronDown, History } from "lucide-react";

/**
 * Concept-wise tracker used by both Correction (understanding) and
 * Performance (accuracy) breakdowns - same shape, different tag sets.
 * Table view: students (sticky left column) x concepts (scrollable columns),
 * one dropdown per cell, plus a "mark all" dropdown per concept column.
 * Student view: pick one student, see all their concepts as a vertical list.
 */
export default function ConceptTable({ students, concepts, getTag, onSetTag, onBulkSet, tagOptions, extraLabel, onViewHistory }) {
  const [view, setView] = useState("table"); // "table" | "student"
  const [selectedStudentId, setSelectedStudentId] = useState(students[0]?.id || "");

  if (concepts.length === 0) return null;

  return (
    <div className="concept-tracker">
      <div className="concept-view-toggle">
        <button type="button" className={`view-toggle-btn ${view === "table" ? "active" : ""}`} onClick={() => setView("table")}>Table view</button>
        <button type="button" className={`view-toggle-btn ${view === "student" ? "active" : ""}`} onClick={() => setView("student")}>Student view</button>
      </div>

      {view === "table" ? (
        <div className="concept-table-scroll">
          <table className="concept-table">
            <thead>
              <tr>
                <th className="concept-table-sticky-col">Student</th>
                {concepts.map((c) => <th key={c}>{c}</th>)}
              </tr>
              <tr className="concept-table-bulk-row">
                <th className="concept-table-sticky-col">Mark all</th>
                {concepts.map((c) => (
                  <th key={c}>
                    <select className="concept-select concept-select-bulk" defaultValue="" onChange={(e) => { if (e.target.value) { onBulkSet(c, e.target.value); e.target.value = ""; } }}>
                      <option value="">Set all...</option>
                      {tagOptions.filter((t) => t.value !== "blank").map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <td className="concept-table-sticky-col concept-table-student-name">{s.name}</td>
                  {concepts.map((c) => (
                    <td key={c}>
                      <select className="concept-select" value={getTag(s.id, c)} onChange={(e) => onSetTag(s.id, c, e.target.value)}>
                        {tagOptions.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                      {extraLabel?.(s.id, c) && <div className="concept-extra-label">{extraLabel(s.id, c)}</div>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="concept-student-view">
          <div className="field-label">Student</div>
          <select className="input" value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)}>
            {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <div className="concept-student-list">
            {concepts.map((c) => (
              <div className="concept-student-row" key={c}>
                <span className="concept-student-row-name">{c}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ textAlign: "right" }}>
                    <select className="concept-select" value={getTag(selectedStudentId, c)} onChange={(e) => onSetTag(selectedStudentId, c, e.target.value)}>
                      {tagOptions.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    {extraLabel?.(selectedStudentId, c) && <div className="concept-extra-label">{extraLabel(selectedStudentId, c)}</div>}
                  </div>
                  {onViewHistory && (
                    <button type="button" className="btn btn-icon" onClick={() => onViewHistory(selectedStudentId, c)} title="View history">
                      <History size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

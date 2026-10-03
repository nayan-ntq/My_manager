import React from "react";
import { Dot } from "lucide-react";
import GridMark from "./GridMark";
import { CORRECTION_MARKS, CORRECTION_TITLES } from "../lib/constants";

function shortDate(d) {
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString([], { day: "numeric", month: "numeric" });
}

/**
 * Register view matching the physical correction book: students down the
 * side (sticky), every correction record as its own scrollable column,
 * tap a cell to cycle its status (minimum-tap default). Records with
 * tracked concepts get a small dot - tap it to quickly flag which topics
 * are incomplete for that student, without leaving the table.
 */
export default function CorrectionRegisterTable({ students, records, onCycleStatus, onOpenConceptQuick, onOpenRecordDetail }) {
  if (records.length === 0) return null;

  return (
    <div className="register-scroll">
      <table className="register-table">
        <thead>
          <tr>
            <th className="register-sticky-col">Student</th>
            {records.map((r) => (
              <th key={r.id} onClick={() => onOpenRecordDetail(r)} className="register-col-header">
                <div className="register-col-type">{r.type}</div>
                <div className="register-col-date mono">{shortDate(r.date)}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {students.map((s) => (
            <tr key={s.id}>
              <td className="register-sticky-col register-student-name">{s.name}</td>
              {records.map((r) => {
                const code = r.marks?.[s.id] || "blank";
                const hasConcepts = (r.concepts || []).length > 0;
                const conceptEntries = r.concept_marks?.[s.id] || {};
                const incompleteCount = Object.values(conceptEntries).filter((e) => (typeof e === "string" ? e : e?.status) === "incomplete").length;
                return (
                  <td key={r.id} className="register-cell-wrap">
                    <button type="button" className={`register-cell code-${code}`} title={CORRECTION_TITLES[code]} onClick={() => onCycleStatus(r, s.id)}>
                      <GridMark mark={CORRECTION_MARKS[code]} size={13} />
                    </button>
                    {hasConcepts && (
                      <button type="button" className={`register-concept-dot ${incompleteCount > 0 ? "has-incomplete" : ""}`} onClick={() => onOpenConceptQuick(r, s.id)} title="Which topics?">
                        {incompleteCount > 0 ? incompleteCount : <Dot size={14} />}
                      </button>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

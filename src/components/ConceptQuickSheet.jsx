import React from "react";
import { X } from "lucide-react";
import GridMark from "./GridMark";
import { CORRECTION_CONCEPT_STATUSES, CORRECTION_CONCEPT_MARKS, CORRECTION_CONCEPT_TITLES } from "../lib/constants";

/**
 * Opens straight from the register table when tapping a student's concept
 * dot. Shows every tracked topic for that record as a single-row chip strip
 * per topic - one tap cycles status, no need to open the full concept table.
 */
export default function ConceptQuickSheet({ record, student, getStatus, onSetStatus, onClose }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2 className="sheet-title">{student.name}</h2>
          <button type="button" className="btn btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="card-sub" style={{ marginBottom: 12 }}>{record.title} - tap a topic to cycle its status</div>
        <div className="quick-concept-list">
          {(record.concepts || []).map((concept) => {
            const status = getStatus(concept);
            return (
              <button
                type="button"
                key={concept}
                className={`quick-concept-row status-${status}`}
                onClick={() => {
                  const next = CORRECTION_CONCEPT_STATUSES[(CORRECTION_CONCEPT_STATUSES.indexOf(status) + 1) % CORRECTION_CONCEPT_STATUSES.length];
                  onSetStatus(concept, next);
                }}
              >
                <span className="quick-concept-name">{concept}</span>
                <span className="quick-concept-mark">
                  <GridMark mark={CORRECTION_CONCEPT_MARKS[status]} size={14} />
                  <span className="quick-concept-label">{CORRECTION_CONCEPT_TITLES[status]}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { CORRECTION_CONCEPT_TITLES, HOMEWORK_QUALITY_TITLES } from "../lib/constants";
import Spinner from "./Spinner";
import * as db from "../lib/db";

function fmt(dt) {
  return new Date(dt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function HistorySheet({ recordId, studentId, studentName, concept, onClose }) {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    db.fetchCorrectionHistory(recordId, studentId, concept).then(setRows);
  }, [recordId, studentId, concept]);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2 className="sheet-title">History</h2>
          <button type="button" className="btn btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="card-sub" style={{ marginBottom: 12 }}>{studentName} - {concept}</div>

        {rows === null ? (
          <Spinner label="Loading history..." />
        ) : rows.length === 0 ? (
          <div className="empty-state"><div className="empty-state-text">No changes recorded yet.</div></div>
        ) : (
          <div className="history-list">
            {rows.map((r, i) => (
              <div className="history-row" key={r.id}>
                <div className="history-row-dot" />
                <div>
                  <div className="history-row-status">
                    {CORRECTION_CONCEPT_TITLES[r.status] || r.status}
                    {r.next_date && <span className="card-sub"> - extended to {r.next_date}</span>}
                    {r.remark && <span className="card-sub"> - "{r.remark}"</span>}
                    {r.quality && <span className="card-sub"> - {HOMEWORK_QUALITY_TITLES[r.quality] || r.quality}{r.rating ? ` (${r.rating}/5)` : ""}</span>}
                  </div>
                  <div className="card-sub mono">{fmt(r.marked_at)}{i === rows.length - 1 ? "  (current)" : ""}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

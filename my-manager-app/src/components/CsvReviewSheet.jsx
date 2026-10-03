import React, { useState } from "react";
import { X } from "lucide-react";
import { parseCSV } from "../lib/visionImport";

/**
 * Shows Gemini's extracted CSV for review before anything is written to the
 * database. The teacher can edit the raw text directly (fix a misread name,
 * drop a row) before confirming.
 */
export default function CsvReviewSheet({ title, csv, columns, onClose, onConfirm }) {
  const [text, setText] = useState(csv);
  const { rows } = parseCSV(text);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2 className="sheet-title">{title}</h2>
          <button type="button" className="btn btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="card-sub" style={{ marginBottom: 10 }}>
          Gemini read {rows.length} row{rows.length === 1 ? "" : "s"}. Review and fix anything before importing - nothing is saved yet.
        </div>
        <textarea className="input textarea csv-textarea" value={text} onChange={(e) => setText(e.target.value)} rows={10} />
        {rows.length > 0 && (
          <div className="csv-preview-table">
            <div className="csv-preview-row csv-preview-header">
              {columns.map((c) => <span key={c}>{c}</span>)}
            </div>
            {rows.slice(0, 8).map((row, i) => (
              <div className="csv-preview-row" key={i}>
                {columns.map((c) => <span key={c}>{row[c.toLowerCase()] || "-"}</span>)}
              </div>
            ))}
            {rows.length > 8 && <div className="card-sub" style={{ padding: "6px 0" }}>+{rows.length - 8} more rows</div>}
          </div>
        )}
        <div className="sheet-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Discard</button>
          <button type="button" className="btn btn-primary" onClick={() => onConfirm(rows)}>Import {rows.length} rows</button>
        </div>
      </div>
    </div>
  );
}

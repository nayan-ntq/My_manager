import React, { useState } from "react";
import { ChevronDown, ChevronRight, ChevronLeft } from "lucide-react";
import { CORRECTION_CODES, CORRECTION_TITLES, CORRECTION_CONCEPT_STATUSES, CORRECTION_CONCEPT_TITLES, HOMEWORK_QUALITY_TAGS, HOMEWORK_QUALITY_TITLES } from "../lib/constants";

export default function CorrectionStudentView({ students, records, isHomeworkRecord, onSetOverall, onSetConcept, onSetQuality }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(students[0]?.id || "");
  const sid = students.some((s) => s.id === selected) ? selected : students[0]?.id;
  const idx = students.findIndex((s) => s.id === sid);
  const go = (i) => { if (students[i]) setSelected(students[i].id); };
  const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date));
  const entryOf = (r, c) => r.concept_marks?.[sid]?.[c];
  const statusOf = (r, c) => { const e = entryOf(r, c); return (typeof e === "string" ? e : e?.status) || "blank"; };

  return (
    <div className="card">
      <button type="button" className="expand-toggle" style={{ paddingTop: 0 }} onClick={() => setOpen(!open)}>
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Student view - all records for one student
      </button>
      {open && sid && (
        <div style={{ marginTop: 10 }}>
          <div className="concept-student-picker">
            <button type="button" className="btn btn-icon" disabled={idx <= 0} onClick={() => go(idx - 1)}><ChevronLeft size={16} /></button>
            <select className="input" value={sid} onChange={(e) => setSelected(e.target.value)}>
              {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <button type="button" className="btn btn-icon" disabled={idx >= students.length - 1} onClick={() => go(idx + 1)}><ChevronRight size={16} /></button>
          </div>
          {sorted.map((r) => (
            <div key={r.id} className="concept-student-header" style={{ marginTop: 10 }}>
              <div className="concept-student-header-row">
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>{r.title} <span className="badge-mini">{r.type}</span></div>
                  <div className="card-sub mono">{r.date}</div>
                </div>
                <select className="concept-select" value={r.marks?.[sid] || "blank"} onChange={(e) => onSetOverall(r, sid, e.target.value)}>
                  {CORRECTION_CODES.map((code) => <option key={code} value={code}>{CORRECTION_TITLES[code]}</option>)}
                </select>
              </div>
              {(r.concepts || []).map((c) => {
                const status = statusOf(r, c);
                return (
                  <div className="concept-student-row" key={c}>
                    <span className="concept-student-row-name">{c}</span>
                    <div style={{ textAlign: "right" }}>
                      <select className="concept-select" value={status} onChange={(e) => onSetConcept(r, c, sid, e.target.value)}>
                        {CORRECTION_CONCEPT_STATUSES.map((t) => <option key={t} value={t}>{CORRECTION_CONCEPT_TITLES[t]}</option>)}
                      </select>
                      {isHomeworkRecord(r) && status === "done" && (
                        <select className="concept-select concept-select-quality" value={entryOf(r, c)?.quality || "accurate"} onChange={(e) => onSetQuality(r, c, sid, e.target.value)}>
                          {HOMEWORK_QUALITY_TAGS.map((t) => <option key={t} value={t}>{HOMEWORK_QUALITY_TITLES[t]}</option>)}
                        </select>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

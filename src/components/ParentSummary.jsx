import React, { useEffect, useState } from "react";
import { X, Printer } from "lucide-react";
import Spinner from "./Spinner";
import * as school from "../lib/school";

const pctOf = (v, max) => (max ? Math.round((v / max) * 100) : 0);
const avg = (a) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null);
const dateOf = (r) => r.exam_date || (r.created_at || "").slice(0, 10);
const WEAK = { gap: "Concept gap", application: "Application gap", silly: "Silly mistakes" };

function Bar({ pct, classPct, color }) {
  return (
    <div style={{ position: "relative", height: 10, background: "#F1ECE3", borderRadius: 6, WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
      <div style={{ width: `${Math.min(100, pct)}%`, height: "100%", background: color, borderRadius: 6 }} />
      {classPct != null && <div style={{ position: "absolute", left: `${Math.min(100, classPct)}%`, top: -2, width: 2, height: 14, background: "#2A2723" }} />}
    </div>
  );
}

function compute(d) {
  const sid = (classId) => d.idByClass[classId];
  const subjectOf = (classId) => { const c = d.classes.find((x) => x.id === classId); return c?.subject || c?.name || "Subject"; };

  // attendance is copied to every subject class, so use the class with the most records
  const byClass = {};
  for (const a of d.attendance) if (!a.is_day_off) (byClass[a.class_id] = byClass[a.class_id] || []).push(a);
  const best = Object.values(byClass).sort((a, b) => b.length - a.length)[0] || [];
  const stuId = best.length ? sid(best[0].class_id) : null;
  const presentDays = best.filter((a) => (a.present || {})[stuId] !== false).length;
  const attendance = best.length ? { present: presentDays, total: best.length, pct: Math.round((presentDays / best.length) * 100) } : null;

  const subjects = {};
  const concepts = {};
  for (const r of d.performance) {
    const me = sid(r.class_id);
    const sub = subjectOf(r.class_id);
    const entry = (subjects[sub] = subjects[sub] || { tests: [] });
    if (!(r.absent || {})[me] && r.marks?.[me] != null) {
      const others = Object.entries(r.marks || {}).filter(([k, v]) => !(r.absent || {})[k] && v != null).map(([, v]) => pctOf(v, r.max_marks));
      entry.tests.push({ title: r.title, type: r.test_type, date: dateOf(r), marks: r.marks[me], max: r.max_marks, pct: pctOf(r.marks[me], r.max_marks), classPct: avg(others) });
    }
    for (const c of r.concepts || []) {
      const tag = r.concept_marks?.[me]?.[c];
      if (!tag || tag === "blank") continue;
      const k = `${sub}|${c}`;
      const t = (concepts[k] = concepts[k] || { subject: sub, concept: c, accurate: 0, gap: 0, application: 0, silly: 0 });
      if (t[tag] !== undefined) t[tag]++;
    }
  }
  for (const s of Object.values(subjects)) { s.tests.sort((a, b) => a.date.localeCompare(b.date)); s.avg = avg(s.tests.map((t) => t.pct)); }
  const all = Object.values(concepts);
  const weak = all.filter((c) => c.gap + c.application + c.silly > 0).sort((a, b) => (b.gap * 3 + b.application * 2 + b.silly) - (a.gap * 3 + a.application * 2 + a.silly)).slice(0, 6);
  const strong = all.filter((c) => c.accurate > 0 && c.gap + c.application + c.silly === 0).sort((a, b) => b.accurate - a.accurate).slice(0, 6);

  const work = { classwork: { done: 0, total: 0, open: 0 }, homework: { done: 0, total: 0, open: 0 } };
  for (const r of d.correction) {
    const code = r.marks?.[sid(r.class_id)];
    if (!code || code === "blank" || code === "ab") continue;
    const w = work[/home/i.test(r.type || "") ? "homework" : "classwork"];
    w.total++;
    if (code === "done") w.done++;
    if (code === "ic" || code === "ns") w.open++;
  }
  return { attendance, subjects, weak, strong, work };
}

export default function ParentSummary({ student, cls, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    school.fetchParentSummaryData(student.id).then((d) => setData(compute(d))).catch((e) => setError(e.message || "Couldn't load"));
  }, [student.id]);

  const sec = { marginTop: 16 };
  const h = { fontSize: 12.5, fontWeight: 800, color: "#7a7266", textTransform: "uppercase", letterSpacing: "0.02em", marginBottom: 8 };
  const today = new Date().toLocaleDateString([], { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet ps-print" onClick={(e) => e.stopPropagation()} style={{ maxHeight: "92vh" }}>
        <div className="sheet-head ps-hide-print">
          <h2 className="sheet-title">Parent summary</h2>
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" className="btn btn-ghost" style={{ padding: "7px 11px" }} onClick={() => window.print()}><Printer size={14} /> Print / PDF</button>
            <button type="button" className="btn btn-icon" onClick={onClose}><X size={16} /></button>
          </div>
        </div>

        <div style={{ borderBottom: "2px solid #F2790C", paddingBottom: 8, marginTop: 6 }}>
          <div style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 22, fontWeight: 700 }}>{student.name}</div>
          <div className="card-sub">{student.roll_no ? `Roll no. ${student.roll_no} - ` : ""}{cls?.name || ""} - Progress summary - {today}</div>
        </div>

        {error && <div className="auth-error">{error}</div>}
        {!data && !error && <Spinner label="Preparing summary..." />}
        {data && (
          <>
            <div style={sec}>
              <div style={h}>Attendance</div>
              {data.attendance
                ? <div style={{ fontSize: 14 }}><b>{data.attendance.pct}%</b> - present {data.attendance.present} of {data.attendance.total} working days</div>
                : <div className="card-sub">No attendance recorded yet.</div>}
            </div>

            <div style={sec}>
              <div style={h}>Test scores</div>
              {Object.keys(data.subjects).length === 0 ? <div className="card-sub">No test results yet.</div> : Object.entries(data.subjects).map(([name, s]) => (
                <div key={name} style={{ marginBottom: 14, breakInside: "avoid" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 14 }}>
                    <span>{name}</span><span>{s.avg != null ? `Average ${s.avg}%` : "-"}</span>
                  </div>
                  {s.tests.length === 0 ? <div className="card-sub">No marks yet.</div> : s.tests.map((t, i) => (
                    <div key={i} style={{ marginTop: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                        <span>{t.title} <span className="card-sub">({t.date})</span></span>
                        <span><b>{t.marks}/{t.max}</b> ({t.pct}%){t.classPct != null ? ` - class ${t.classPct}%` : ""}</span>
                      </div>
                      <Bar pct={t.pct} classPct={t.classPct} color={t.pct >= 60 ? "#2FA88F" : t.pct >= 40 ? "#F2790C" : "#E8556B"} />
                    </div>
                  ))}
                </div>
              ))}
              {Object.keys(data.subjects).length > 0 && <div className="card-sub">The dark line on each bar marks the class average.</div>}
            </div>

            <div style={sec}>
              <div style={h}>Concepts</div>
              {data.strong.length === 0 && data.weak.length === 0 ? <div className="card-sub">Concept details appear once tests are tagged.</div> : (
                <>
                  {data.strong.length > 0 && <div style={{ fontSize: 13, marginBottom: 6 }}><b style={{ color: "#2FA88F" }}>Doing well:</b> {data.strong.map((c) => `${c.concept} (${c.subject})`).join(", ")}</div>}
                  {data.weak.length > 0 && (
                    <div style={{ fontSize: 13 }}>
                      <b style={{ color: "#E8556B" }}>Needs more practice:</b>
                      {data.weak.map((c) => {
                        const kind = c.gap ? WEAK.gap : c.application ? WEAK.application : WEAK.silly;
                        return <div key={c.subject + c.concept}>- {c.concept} ({c.subject}) - {kind}</div>;
                      })}
                    </div>
                  )}
                </>
              )}
            </div>

            <div style={sec}>
              <div style={h}>Classwork and homework</div>
              {["classwork", "homework"].map((k) => {
                const w = data.work[k];
                return (
                  <div key={k} style={{ fontSize: 13.5, marginBottom: 4 }}>
                    <b>{k === "classwork" ? "Classwork" : "Homework"}:</b>{" "}
                    {w.total ? `${w.done} of ${w.total} checked as done${w.open ? `, ${w.open} incomplete or not submitted` : ""}` : "nothing checked yet"}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { X, TrendingUp, TrendingDown } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";
import * as db from "../lib/db";
import * as school from "../lib/school";
import Spinner from "./Spinner";
import { CORRECTION_TITLES, CORRECTION_CONCEPT_TITLES, HOMEWORK_QUALITY_TITLES } from "../lib/constants";

const SKILLS = [
  { key: "accurate", label: "Accurate", color: "#2FA88F" },
  { key: "application", label: "Application gap", color: "#5B7FDB" },
  { key: "silly", label: "Silly mistake", color: "#F2790C" },
  { key: "gap", label: "Concept gap", color: "#E8556B" },
];
const SKILL_BY_KEY = Object.fromEntries(SKILLS.map((s) => [s.key, s]));
const HW_TO_SKILL = { accurate: "accurate", application_gap: "application", silly_mistake: "silly", concept_gap: "gap" };
const CODE_COLORS = { done: "#2FA88F", ab: "#E8556B", ic: "#F2790C", ns: "#8B7FC7", blank: "#9c9488" };

const dateOf = (r) => r.exam_date || (r.created_at || "").slice(0, 10);
const shortDate = (s) => new Date(s + "T00:00:00").toLocaleDateString([], { day: "numeric", month: "short" });
const monthLabel = (k) => new Date(k + "-01T00:00:00").toLocaleDateString([], { month: "short", year: "2-digit" });
const kindOf = (type) => (/home/i.test(type || "") ? "homework" : /class/i.test(type || "") ? "classwork" : "other");
const avg = (arr) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null);

/**
 * One child across every subject: scores by test date (bars), skills, concepts, attendance and
 * classwork/homework history. Subject chips narrow it to a single subject.
 */
export default function StudentProfile({ student, cls, showTeacherName, onClose }) {
  const [loading, setLoading] = useState(true);
  const [classesInfo, setClassesInfo] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [performance, setPerformance] = useState([]);
  const [correction, setCorrection] = useState([]);
  const [scope, setScope] = useState("all");
  const [histFilter, setHistFilter] = useState("all");
  const [openRow, setOpenRow] = useState(null);
  const [showAllConcepts, setShowAllConcepts] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      let sib = [];
      try { sib = student.person_id ? await school.fetchStudentSiblings(student.person_id) : []; } catch (e) { sib = []; }
      if (!sib.some((s) => s.class_id === cls.id)) sib.push({ id: student.id, class_id: cls.id, classes: { id: cls.id, name: cls.name, subject: cls.subject } });
      const parts = await Promise.all(sib.map(async (s) => {
        const [a, p, c] = await Promise.all([
          db.fetchAttendanceForClassAll(s.class_id), db.fetchPerformanceRecordsForClassAll(s.class_id), db.fetchCorrectionRecordsForClassAll(s.class_id),
        ]);
        const subject = s.classes?.subject || s.classes?.name || "Class";
        const tag = (r) => ({ ...r, _sid: s.id, _subject: subject, _classId: s.class_id });
        return { info: { classId: s.class_id, label: subject }, a: a.map(tag), p: p.map(tag), c: c.map(tag) };
      }));
      setClassesInfo(parts.map((x) => x.info));
      setAttendance(parts.flatMap((x) => x.a)); setPerformance(parts.flatMap((x) => x.p)); setCorrection(parts.flatMap((x) => x.c));
      setLoading(false);
    })();
  }, [student.id, cls.id]);

  const inScope = (r) => scope === "all" || r._classId === scope;
  const multi = classesInfo.length > 1;

  // ---- attendance ----
  const att = attendance.filter((a) => inScope(a) && !a.is_day_off);
  const presentOf = (a) => (a.present || {})[a._sid] !== false;
  const attendanceRate = att.length ? Math.round((att.filter(presentOf).length / att.length) * 100) : null;
  const attByMonth = {};
  for (const a of att) {
    const k = a.date.slice(0, 7);
    const m = (attByMonth[k] = attByMonth[k] || { present: 0, total: 0 });
    m.total++; if (presentOf(a)) m.present++;
  }
  const attendanceBars = Object.keys(attByMonth).sort().map((k) => ({ month: monthLabel(k), Attendance: Math.round((attByMonth[k].present / attByMonth[k].total) * 100) }));

  // ---- scores by test date ----
  const scoreRows = performance
    .filter((r) => inScope(r) && !(r.absent || {})[r._sid] && r.marks?.[r._sid] != null)
    .map((r) => {
      const others = Object.entries(r.marks || {}).filter(([sid, v]) => !(r.absent || {})[sid] && v != null).map(([, v]) => v);
      const mine = r.marks[r._sid];
      const d = dateOf(r);
      return {
        title: r.title, subject: r._subject, date: d, label: shortDate(d), marks: mine, max: r.max_marks,
        "This student": Math.round((mine / r.max_marks) * 100),
        "Class average": others.length ? Math.round((others.reduce((a, b) => a + b, 0) / others.length / r.max_marks) * 100) : null,
        rank: 1 + others.filter((v) => v > mine).length, of: others.length,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  const avgScore = avg(scoreRows.map((r) => r["This student"]));
  const latest = scoreRows.length ? scoreRows[scoreRows.length - 1] : null;
  const latestVsPrior = scoreRows.length >= 2 ? latest["This student"] - scoreRows[scoreRows.length - 2]["This student"] : null;
  const subjectBars = [];
  if (multi && scope === "all") {
    const subs = [...new Set(scoreRows.map((r) => r.subject))];
    for (const s of subs) {
      const rows = scoreRows.filter((r) => r.subject === s);
      subjectBars.push({ subject: s, "This student": avg(rows.map((r) => r["This student"])), "Class average": avg(rows.map((r) => r["Class average"]).filter((v) => v != null)) });
    }
  }

  // ---- skills and concepts, every entry dated ----
  const entries = [];
  const keyOf = (concept, subject) => (multi && scope === "all" ? `${concept} - ${subject}` : concept);
  for (const r of performance.filter(inScope)) {
    for (const [concept, tag] of Object.entries(r.concept_marks?.[r._sid] || {})) {
      if (SKILL_BY_KEY[tag]) entries.push({ concept: keyOf(concept, r._subject), skill: tag, date: dateOf(r), title: r.title });
    }
  }
  for (const r of correction.filter(inScope)) {
    for (const [concept, e] of Object.entries(r.concept_marks?.[r._sid] || {})) {
      const skill = typeof e === "object" && e ? HW_TO_SKILL[e.quality] : null;
      if (skill) entries.push({ concept: keyOf(concept, r._subject), skill, date: r.date, title: r.title });
    }
  }
  entries.sort((a, b) => a.date.localeCompare(b.date));
  const skillCounts = Object.fromEntries(SKILLS.map((s) => [s.key, entries.filter((e) => e.skill === s.key).length]));
  const skillTotal = entries.length;
  const byConcept = {};
  for (const e of entries) (byConcept[e.concept] = byConcept[e.concept] || []).push(e);
  const concepts = Object.entries(byConcept).map(([concept, list]) => {
    const accurate = list.filter((e) => e.skill === "accurate").length;
    return { concept, list, total: list.length, accurate, pct: accurate / list.length, recent: list.slice(-6) };
  });
  const weakestFirst = [...concepts].sort((a, b) => a.pct - b.pct || b.total - a.total);
  const shownConcepts = showAllConcepts ? weakestFirst : weakestFirst.slice(0, 8);
  const conceptBars = [...concepts].sort((a, b) => b.total - a.total).slice(0, 10).map((c) => {
    const row = { concept: c.concept.length > 16 ? `${c.concept.slice(0, 15)}...` : c.concept };
    for (const s of SKILLS) row[s.label] = c.list.filter((e) => e.skill === s.key).length;
    return row;
  });

  // ---- classwork / homework ----
  const workByMonth = {};
  for (const r of correction.filter(inScope)) {
    const code = r.marks?.[r._sid] || "blank";
    if (code === "blank") continue;
    const k = r.date.slice(0, 7);
    const m = (workByMonth[k] = workByMonth[k] || { done: 0, notDone: 0 });
    if (code === "done") m.done++; else m.notDone++;
  }
  const workBars = Object.keys(workByMonth).sort().map((k) => ({ month: monthLabel(k), Done: workByMonth[k].done, "Not done": workByMonth[k].notDone }));
  const history = correction.filter((r) => inScope(r) && (histFilter === "all" || kindOf(r.type) === histFilter)).sort((a, b) => b.date.localeCompare(a.date));
  const checkedAll = correction.filter((r) => inScope(r) && (r.marks?.[r._sid] || "blank") !== "blank");
  const doneAll = checkedAll.filter((r) => r.marks[r._sid] === "done").length;

  const Chart = ({ children, height = 190 }) => <div style={{ width: "100%", height }}><ResponsiveContainer>{children}</ResponsiveContainer></div>;
  const axis = { fontSize: 10, fill: "#9c9488" };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} style={{ maxHeight: "92vh" }}>
        <div className="sheet-head">
          <h2 className="sheet-title">{student.name}</h2>
          <button type="button" className="btn btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="card-sub" style={{ marginBottom: 10 }}>
          {student.roll_no ? `Roll no. ${student.roll_no} - ` : ""}{cls.name}{showTeacherName ? ` - ${cls.ownerName || "another teacher"}` : ""}
        </div>

        {loading ? <Spinner label="Loading profile..." /> : (
          <>
            {multi && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                <button type="button" className="chip-btn" style={scope === "all" ? { background: "#F2790C", color: "#fff", borderColor: "transparent" } : undefined} onClick={() => setScope("all")}>All subjects</button>
                {classesInfo.map((c) => (
                  <button key={c.classId} type="button" className="chip-btn" style={scope === c.classId ? { background: "#F2790C", color: "#fff", borderColor: "transparent" } : undefined} onClick={() => setScope(c.classId)}>{c.label}</button>
                ))}
              </div>
            )}

            <div className="stat-grid">
              <div className="stat-card"><div className="stat-num">{attendanceRate ?? " - "}{attendanceRate !== null && "%"}</div><div className="stat-label">Attendance</div></div>
              <div className="stat-card">
                <div className="stat-num" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  {latest ? `${latest["This student"]}%` : " - "}
                  {latestVsPrior !== null && (latestVsPrior >= 0 ? <TrendingUp size={15} color="#2FA88F" /> : <TrendingDown size={15} color="#E8556B" />)}
                </div>
                <div className="stat-label">Latest test</div>
              </div>
              <div className="stat-card"><div className="stat-num">{avgScore ?? " - "}{avgScore !== null && "%"}</div><div className="stat-label">Average score</div></div>
              <div className="stat-card"><div className="stat-num">{checkedAll.length ? `${doneAll}/${checkedAll.length}` : " - "}</div><div className="stat-label">Work done</div></div>
            </div>

            <div className="card">
              <div className="card-title">Scores by test date</div>
              {scoreRows.length === 0 ? <div className="card-sub">No test scores yet.</div> : (
                <>
                  <Chart>
                    <BarChart data={scoreRows}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ECE6DE" />
                      <XAxis dataKey="label" tick={axis} />
                      <YAxis domain={[0, 100]} tick={axis} width={28} />
                      <Tooltip formatter={(v, n) => [`${v}%`, n]} labelFormatter={(l, p) => (p && p[0] ? `${p[0].payload.title} - ${p[0].payload.subject} (${p[0].payload.date})` : l)} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="This student" fill="#F2790C" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Class average" fill="#c9c2b6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </Chart>
                  <div style={{ marginTop: 8 }}>
                    {[...scoreRows].reverse().map((r, i) => (
                      <div className="marks-row" key={i}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{r.title}{multi ? <span className="badge-mini">{r.subject}</span> : null}</div>
                          <div className="card-sub mono">{r.date}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontWeight: 800, fontSize: 14 }}>{r.marks}/{r.max} <span className="card-sub">({r["This student"]}%)</span></div>
                          <div className="card-sub">rank {r.rank} of {r.of}{r["Class average"] !== null ? ` - class avg ${r["Class average"]}%` : ""}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {subjectBars.length > 1 && (
              <div className="card">
                <div className="card-title">Average by subject</div>
                <Chart height={170}>
                  <BarChart data={subjectBars}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ECE6DE" />
                    <XAxis dataKey="subject" tick={axis} />
                    <YAxis domain={[0, 100]} tick={axis} width={28} />
                    <Tooltip formatter={(v, n) => [`${v}%`, n]} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="This student" fill="#F2790C" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Class average" fill="#c9c2b6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </Chart>
              </div>
            )}

            <div className="card">
              <div className="card-title">Skills</div>
              {skillTotal === 0 ? <div className="card-sub">Nothing tagged yet. Tag concepts in Scores and homework Correction to build this.</div> : (
                <>
                  <div style={{ display: "flex", height: 14, borderRadius: 7, overflow: "hidden", background: "#F1ECE3" }}>
                    {SKILLS.map((s) => skillCounts[s.key] > 0 && <div key={s.key} title={`${s.label}: ${skillCounts[s.key]}`} style={{ width: `${(skillCounts[s.key] / skillTotal) * 100}%`, background: s.color }} />)}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", marginTop: 8 }}>
                    {SKILLS.map((s) => (
                      <span key={s.key} className="card-sub" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <span style={{ width: 9, height: 9, borderRadius: "50%", background: s.color }} />
                        {s.label} {Math.round((skillCounts[s.key] / skillTotal) * 100)}% ({skillCounts[s.key]})
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="card">
              <div className="card-title">Concepts</div>
              {concepts.length === 0 ? <div className="card-sub">No concept marks yet.</div> : (
                <>
                  <div className="card-sub" style={{ marginBottom: 4 }}>Most attempted concepts, split by how they went.</div>
                  <Chart height={Math.max(120, conceptBars.length * 30 + 50)}>
                    <BarChart data={conceptBars} layout="vertical" margin={{ left: 4, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ECE6DE" />
                      <XAxis type="number" allowDecimals={false} tick={axis} />
                      <YAxis type="category" dataKey="concept" width={96} tick={axis} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {SKILLS.map((s) => <Bar key={s.key} dataKey={s.label} stackId="a" fill={s.color} />)}
                    </BarChart>
                  </Chart>
                  <div className="card-sub" style={{ margin: "10px 0 4px" }}>Weakest first. Dots are the latest attempts, oldest to newest.</div>
                  {shownConcepts.map((c) => (
                    <div className="marks-row" key={c.concept} style={{ alignItems: "flex-start", gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{c.concept}</div>
                        <div className="card-sub">{c.accurate} of {c.total} accurate</div>
                      </div>
                      <div style={{ display: "flex", gap: 4, paddingTop: 4, flexShrink: 0 }}>
                        {c.recent.map((e, i) => <span key={i} title={`${e.title} (${e.date}): ${SKILL_BY_KEY[e.skill].label}`} style={{ width: 11, height: 11, borderRadius: "50%", background: SKILL_BY_KEY[e.skill].color }} />)}
                      </div>
                    </div>
                  ))}
                  {concepts.length > 8 && (
                    <button type="button" className="chip-btn" style={{ marginTop: 8 }} onClick={() => setShowAllConcepts(!showAllConcepts)}>{showAllConcepts ? "Show fewer" : `Show all ${concepts.length}`}</button>
                  )}
                </>
              )}
            </div>

            {attendanceBars.length > 0 && (
              <div className="card">
                <div className="card-title">Attendance by month</div>
                <Chart height={150}>
                  <BarChart data={attendanceBars}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ECE6DE" />
                    <XAxis dataKey="month" tick={axis} />
                    <YAxis domain={[0, 100]} tick={axis} width={28} />
                    <Tooltip formatter={(v) => `${v}%`} />
                    <Bar dataKey="Attendance" fill="#5B7FDB" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </Chart>
              </div>
            )}

            <div className="card">
              <div className="card-title">Classwork and homework</div>
              {workBars.length > 0 && (
                <Chart height={150}>
                  <BarChart data={workBars}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ECE6DE" />
                    <XAxis dataKey="month" tick={axis} />
                    <YAxis allowDecimals={false} tick={axis} width={28} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Done" stackId="w" fill="#2FA88F" />
                    <Bar dataKey="Not done" stackId="w" fill="#E8556B" />
                  </BarChart>
                </Chart>
              )}
              <div className="concept-view-toggle" style={{ marginTop: 10 }}>
                {[["all", "All"], ["classwork", "Classwork"], ["homework", "Homework"]].map(([k, l]) => (
                  <button key={k} type="button" className={`view-toggle-btn ${histFilter === k ? "active" : ""}`} onClick={() => setHistFilter(k)}>{l}</button>
                ))}
              </div>
              {history.length === 0 ? <div className="card-sub">No records yet.</div> : history.map((r) => {
                const code = r.marks?.[r._sid] || "blank";
                const conceptEntries = Object.entries(r.concept_marks?.[r._sid] || {});
                const open = openRow === r.id;
                return (
                  <div key={r.id} style={{ borderBottom: "1px solid #F1ECE3" }}>
                    <button type="button" className="marks-row" style={{ width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }} onClick={() => setOpenRow(open ? null : r.id)}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{r.title} <span className="badge-mini">{r.type}</span>{multi ? <span className="badge-mini">{r._subject}</span> : null}</div>
                        <div className="card-sub mono">{r.date}</div>
                      </div>
                      <span className="badge-mini" style={{ color: CODE_COLORS[code], background: `${CODE_COLORS[code]}15` }}>{CORRECTION_TITLES[code]}</span>
                    </button>
                    {open && (
                      <div style={{ padding: "0 4px 10px" }}>
                        {conceptEntries.length === 0 ? <div className="card-sub">No topic-level marks on this record.</div> : conceptEntries.map(([concept, e]) => {
                          const status = typeof e === "string" ? e : e?.status;
                          const extra = typeof e === "object" && e ? [e.quality ? HOMEWORK_QUALITY_TITLES[e.quality] : null, e.remark ? `"${e.remark}"` : null, e.next_date ? `extended to ${e.next_date}` : null].filter(Boolean).join(" - ") : "";
                          return (
                            <div key={concept} className="card-sub" style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "3px 0" }}>
                              <span>{concept}</span>
                              <span style={{ textAlign: "right" }}>{CORRECTION_CONCEPT_TITLES[status] || "Not marked"}{extra ? ` - ${extra}` : ""}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {student.notes && (
              <div className="card">
                <div className="card-title">Notes</div>
                <div className="card-sub" style={{ fontSize: 13 }}>{student.notes}</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

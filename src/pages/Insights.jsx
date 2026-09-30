import React, { useEffect, useMemo, useState } from "react";
import Spinner from "../components/Spinner";
import * as db from "../lib/db";

function addDays(d, n) { const c = new Date(d); c.setDate(c.getDate() + n); return c; }
function toKey(d) { return d.toISOString().slice(0, 10); }

/**
 * Attendance is "present unless explicitly marked absent" (see the Attendance
 * panel), so present = roster size minus students flagged false. Day-off
 * records are skipped entirely.
 */
function attendancePct(rows, classes) {
  let present = 0, total = 0;
  for (const r of rows) {
    if (r.is_day_off) continue;
    const cls = classes.find((c) => c.id === r.class_id);
    if (!cls) continue;
    total += cls.students.length;
    present += cls.students.filter((s) => (r.present || {})[s.id] !== false).length;
  }
  return total ? Math.round((present / total) * 100) : null;
}

export default function Insights({ userId, classes }) {
  const [attendanceRows, setAttendanceRows] = useState([]);
  const [performanceRows, setPerformanceRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const last7 = useMemo(() => Array.from({ length: 7 }, (_, i) => toKey(addDays(new Date(), -i))).reverse(), []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const from = last7[0], to = last7[last7.length - 1];
        const [attendance, performance] = await Promise.all([
          db.fetchAttendanceRange(userId, from, to),
          db.fetchAllPerformanceRecords(userId),
        ]);
        setAttendanceRows(attendance); setPerformanceRows(performance);
      } finally { setLoading(false); }
    })();
  }, [userId, last7]);

  const studentCount = classes.reduce((sum, c) => sum + c.students.length, 0);
  const attendanceRate = attendancePct(attendanceRows, classes);
  const dayStats = last7.map((day) => ({ day, pct: attendancePct(attendanceRows.filter((r) => r.date === day), classes) }));

  const avgScore = (() => {
    const vals = [];
    for (const r of performanceRows) {
      for (const [sid, v] of Object.entries(r.marks || {})) {
        if (v === null || v === undefined || (r.absent || {})[sid]) continue;
        vals.push((v / r.max_marks) * 100);
      }
    }
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  })();

  if (loading) return <div className="page"><Spinner label="Loading insights..." /></div>;

  return (
    <div className="page">
      <h2 className="page-title">Insights</h2>
      <div className="stat-grid">
        <div className="stat-card"><div className="stat-num">{classes.length}</div><div className="stat-label">Classes</div></div>
        <div className="stat-card"><div className="stat-num">{studentCount}</div><div className="stat-label">Students</div></div>
        <div className="stat-card"><div className="stat-num">{attendanceRate ?? " - "}{attendanceRate !== null && "%"}</div><div className="stat-label">Attendance (7d)</div></div>
        <div className="stat-card"><div className="stat-num">{avgScore ?? " - "}{avgScore !== null && "%"}</div><div className="stat-label">Avg test score</div></div>
      </div>
      <div className="card">
        <div className="card-title">Daily attendance, last 7 days</div>
        <div className="bar-chart">
          {dayStats.map((d) => (
            <div className="bar-chart-col" key={d.day}>
              <div className="bar-chart-bar" style={{ height: `${d.pct ?? 0}%` }} />
              <div className="bar-chart-label">{new Date(d.day + "T00:00:00").toLocaleDateString([], { weekday: "narrow" })}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="card">
        <div className="card-title">Classes</div>
        {classes.length === 0 ? <div className="card-sub">No classes added yet. Add one in Teach, under Classes.</div> : classes.map((c) => (
          <div key={c.id} className="planner-field"><b>{c.name}</b>  -  {c.students.length} students</div>
        ))}
      </div>
    </div>
  );
}

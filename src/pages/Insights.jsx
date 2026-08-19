import React, { useEffect, useMemo, useState } from "react";
import { Flame } from "lucide-react";
import * as db from "../lib/db";

function addDays(d, n) { const c = new Date(d); c.setDate(c.getDate() + n); return c; }
function toKey(d) { return d.toISOString().slice(0, 10); }

export default function Insights({ userId, stats, classes }) {
  const [taskRows, setTaskRows] = useState([]);
  const [attendanceRows, setAttendanceRows] = useState([]);
  const [performanceRows, setPerformanceRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const last7 = useMemo(() => Array.from({ length: 7 }, (_, i) => toKey(addDays(new Date(), -i))).reverse(), []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const from = last7[0], to = last7[last7.length - 1];
      const [tasks, attendance, performance] = await Promise.all([
        db.fetchTasksInRange(userId, from, to),
        db.fetchAttendanceRange(userId, from, to),
        db.fetchAllPerformanceRecords(userId),
      ]);
      setTaskRows(tasks); setAttendanceRows(attendance); setPerformanceRows(performance);
      setLoading(false);
    })();
  }, [userId, last7]);

  const dayStats = last7.map((day) => {
    const dayTasks = taskRows.filter((t) => t.date === day);
    return { day, total: dayTasks.length, done: dayTasks.filter((t) => t.status === "done").length };
  });
  const chartMax = Math.max(1, ...dayStats.map((d) => d.total));
  const consistency = (() => {
    const total = dayStats.reduce((s, d) => s + d.total, 0);
    const done = dayStats.reduce((s, d) => s + d.done, 0);
    return total ? Math.round((done / total) * 100) : 0;
  })();

  const attendanceRate = (() => {
    if (!attendanceRows.length) return null;
    let presentCount = 0, totalCount = 0;
    for (const r of attendanceRows) {
      const cls = classes.find((c) => c.id === r.class_id);
      if (!cls) continue;
      totalCount += cls.students.length;
      presentCount += Object.values(r.present).filter(Boolean).length;
    }
    return totalCount ? Math.round((presentCount / totalCount) * 100) : null;
  })();

  const avgScore = (() => {
    const vals = [];
    for (const r of performanceRows) for (const v of Object.values(r.marks)) if (v !== null && v !== undefined) vals.push((v / r.max_marks) * 100);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  })();

  if (loading) return <div className="page"><div className="empty">Loading insights\u2026</div></div>;

  return (
    <div className="page">
      <h2 className="page-title">Insights</h2>
      <div className="stat-grid">
        <div className="stat-card"><div className="stat-num orange"><Flame size={17} style={{ marginBottom: -3 }} /> {stats.streak}</div><div className="stat-label">Streak</div></div>
        <div className="stat-card"><div className="stat-num">{consistency}%</div><div className="stat-label">Task consistency</div></div>
        <div className="stat-card"><div className="stat-num">{attendanceRate ?? "\u2014"}{attendanceRate !== null && "%"}</div><div className="stat-label">Class attendance (7d)</div></div>
        <div className="stat-card"><div className="stat-num">{avgScore ?? "\u2014"}{avgScore !== null && "%"}</div><div className="stat-label">Avg test score</div></div>
      </div>
      <div className="card">
        <div className="card-title">Weekly task completion</div>
        <div className="bar-chart">
          {dayStats.map((d) => (
            <div className="bar-chart-col" key={d.day}>
              <div className="bar-chart-bar" style={{ height: `${(d.done / chartMax) * 100}%` }} />
              <div className="bar-chart-label">{new Date(d.day + "T00:00:00").toLocaleDateString([], { weekday: "narrow" })}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="card">
        <div className="card-title">Classes</div>
        {classes.length === 0 ? <div className="card-sub">No classes added yet.</div> : classes.map((c) => (
          <div key={c.id} className="planner-field"><b>{c.name}</b> \u2014 {c.students.length} students</div>
        ))}
      </div>
    </div>
  );
}

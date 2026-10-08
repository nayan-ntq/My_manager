import React, { useEffect, useState } from "react";
import { X, TrendingUp, TrendingDown } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import * as db from "../lib/db";
import Spinner from "./Spinner";
import { CORRECTION_TITLES } from "../lib/constants";

/**
 * A single student's progress: attendance rate, a test-score trend graph, and a
 * correction completion tally. showTeacherName surfaces which teacher's class this
 * is (admin/coordinator "full view" - cross-teacher attribution); teachers viewing
 * their own student never see that line since it's redundant for them.
 */
export default function StudentProfile({ student, cls, showTeacherName, onClose }) {
  const [loading, setLoading] = useState(true);
  const [attendance, setAttendance] = useState([]);
  const [performance, setPerformance] = useState([]);
  const [correction, setCorrection] = useState([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [a, p, c] = await Promise.all([
        db.fetchAttendanceForClassAll(cls.id),
        db.fetchPerformanceRecordsForClassAll(cls.id),
        db.fetchCorrectionRecordsForClassAll(cls.id),
      ]);
      setAttendance(a); setPerformance(p); setCorrection(c);
      setLoading(false);
    })();
  }, [cls.id]);

  const workingDays = attendance.filter((a) => !a.is_day_off);
  const presentCount = workingDays.filter((a) => (a.present || {})[student.id] !== false).length;
  const attendanceRate = workingDays.length ? Math.round((presentCount / workingDays.length) * 100) : null;

  const scoreTrend = performance
    .filter((r) => !(r.absent || {})[student.id] && r.marks[student.id] != null)
    .map((r) => ({ title: r.title, pct: Math.round((r.marks[student.id] / r.max_marks) * 100), date: r.created_at }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const latestVsPrior = scoreTrend.length >= 2 ? scoreTrend[scoreTrend.length - 1].pct - scoreTrend[scoreTrend.length - 2].pct : null;

  const correctionTally = { blank: 0, done: 0, ab: 0, ic: 0, ns: 0 };
  for (const r of correction) {
    const code = r.marks?.[student.id] || "blank";
    if (code in correctionTally) correctionTally[code]++;
  }

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
            <div className="stat-grid">
              <div className="stat-card"><div className="stat-num">{attendanceRate ?? " - "}{attendanceRate !== null && "%"}</div><div className="stat-label">Attendance</div></div>
              <div className="stat-card">
                <div className="stat-num" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  {scoreTrend.length ? `${scoreTrend[scoreTrend.length - 1].pct}%` : " - "}
                  {latestVsPrior !== null && (latestVsPrior >= 0
                    ? <TrendingUp size={15} color="#2FA88F" />
                    : <TrendingDown size={15} color="#E8556B" />)}
                </div>
                <div className="stat-label">Latest test score</div>
              </div>
            </div>

            {scoreTrend.length > 1 && (
              <div className="card">
                <div className="card-title">Score trend</div>
                <div style={{ width: "100%", height: 160 }}>
                  <ResponsiveContainer>
                    <LineChart data={scoreTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ECE6DE" />
                      <XAxis dataKey="title" tick={{ fontSize: 10, fill: "#9c9488" }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#9c9488" }} width={28} />
                      <Tooltip formatter={(v) => `${v}%`} />
                      <Line type="monotone" dataKey="pct" stroke="#F2790C" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            <div className="card">
              <div className="card-title">Correction record (classwork & homework)</div>
              {correction.length === 0 ? <div className="card-sub">No correction records logged yet for this class.</div> : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {Object.entries(correctionTally).filter(([, n]) => n > 0).map(([code, n]) => (
                    <span key={code} className="badge-mini" style={{ fontSize: 11.5, padding: "4px 9px" }}>{CORRECTION_TITLES[code]}: {n}</span>
                  ))}
                </div>
              )}
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

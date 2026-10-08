import React, { useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import Spinner from "../components/Spinner";
import StudentProfile from "../components/StudentProfile";
import { Segmented } from "../components/Shared";
import * as db from "../lib/db";
import * as school from "../lib/school";
import { computeWorkingDays } from "../lib/terms";

function addDays(d, n) { const c = new Date(d); c.setDate(c.getDate() + n); return c; }
function toKey(d) { return d.toISOString().slice(0, 10); }
function fmtAgo(dateStr) {
  if (!dateStr) return "No activity yet";
  const days = Math.floor((Date.now() - new Date(dateStr)) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

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

/** One class's roster, roll-number ordered, each student tappable into their profile.
 *  Shows attendance% and syllabus coverage% for the class as a whole. */
function ClassDrilldown({ cls, showTeacherName, onOpenStudent }) {
  const [attendance, setAttendance] = useState([]);
  const [syllabus, setSyllabus] = useState([]);
  const [plannerChapterNumbers, setPlannerChapterNumbers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [a, p] = await Promise.all([db.fetchAttendanceForClassAll(cls.id), db.fetchPlannerEntriesForClassAll(cls.id)]);
      setAttendance(a);
      setPlannerChapterNumbers([...new Set(p.map((e) => e.chapter_number).filter(Boolean))]);
      if (cls.grade && cls.subject) setSyllabus(await db.fetchSyllabus(cls.school_id, cls.grade, cls.subject));
      setLoading(false);
    })();
  }, [cls.id]);

  const workingDays = attendance.filter((a) => !a.is_day_off);
  const classAttendanceRate = workingDays.length
    ? Math.round((workingDays.reduce((sum, a) => sum + cls.students.filter((s) => (a.present || {})[s.id] !== false).length, 0) / (workingDays.length * cls.students.length)) * 100)
    : null;
  const syllabusCount = syllabus.filter((s) => s.kind === "syllabus").length;
  const coveredCount = syllabus.filter((s) => s.kind === "syllabus" && plannerChapterNumbers.includes(s.chapter_number)).length;

  if (loading) return <Spinner label="Loading class..." />;

  return (
    <div>
      <div className="stat-grid">
        <div className="stat-card"><div className="stat-num">{classAttendanceRate ?? " - "}{classAttendanceRate !== null && "%"}</div><div className="stat-label">Attendance</div></div>
        <div className="stat-card"><div className="stat-num">{syllabusCount ? `${coveredCount}/${syllabusCount}` : " - "}</div><div className="stat-label">Syllabus covered</div></div>
      </div>
      <div className="card">
        <div className="card-title">Students (by roll no.)</div>
        {cls.students.length === 0 ? <div className="card-sub">No students yet.</div> : cls.students.map((s) => (
          <button type="button" key={s.id} className="marks-row" style={{ width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "left" }} onClick={() => onOpenStudent(s, cls)}>
            <span>{s.roll_no ? `${s.roll_no}. ` : ""}{s.name}</span>
            <ChevronRight size={15} color="#9c9488" />
          </button>
        ))}
      </div>
    </div>
  );
}

function ClassesTab({ classesForView, canSeeOtherTeachers }) {
  const [openClassId, setOpenClassId] = useState(null);
  const [openStudent, setOpenStudent] = useState(null); // { student, cls }

  if (classesForView.length === 0) return <div className="card"><div className="card-sub">No classes yet.</div></div>;

  if (!openClassId) {
    return (
      <div className="card">
        {classesForView.map((c) => (
          <button type="button" key={c.id} className="marks-row" style={{ width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "left" }} onClick={() => setOpenClassId(c.id)}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>{c.name}</div>
              <div className="card-sub">{c.students.length} students{canSeeOtherTeachers && c.ownerName ? ` - ${c.ownerName}` : ""}</div>
            </div>
            <ChevronRight size={15} color="#9c9488" />
          </button>
        ))}
      </div>
    );
  }

  const cls = classesForView.find((c) => c.id === openClassId);
  return (
    <div>
      <button type="button" className="section-back" onClick={() => setOpenClassId(null)}>&larr; All classes</button>
      <ClassDrilldown cls={cls} showTeacherName={canSeeOtherTeachers} onOpenStudent={(student, c) => setOpenStudent({ student, cls: c })} />
      {openStudent && <StudentProfile student={openStudent.student} cls={openStudent.cls} showTeacherName={canSeeOtherTeachers} onClose={() => setOpenStudent(null)} />}
    </div>
  );
}

/** Admin/coordinator only: how actively each teacher is using the app. */
function TeachersTab({ schoolId }) {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    (async () => {
      const [members, classes] = await Promise.all([school.fetchSchoolMembers(schoolId), db.fetchSchoolClasses(schoolId)]);
      const teacherMembers = members.filter((m) => m.role === "teacher" || m.role === "coordinator");
      const classIds = classes.map((c) => c.id);
      const activity = await db.fetchActivityForClasses(classIds);
      const classOwner = Object.fromEntries(classes.map((c) => [c.id, c.user_id]));

      const result = teacherMembers.map((m) => {
        const ownClasses = classes.filter((c) => c.user_id === m.user_id);
        const plannerCount = activity.planner.filter((r) => classOwner[r.class_id] === m.user_id).length;
        const correctionCount = activity.correction.filter((r) => classOwner[r.class_id] === m.user_id).length;
        const performanceCount = activity.performance.filter((r) => classOwner[r.class_id] === m.user_id).length;
        const allDates = [...activity.planner, ...activity.correction, ...activity.performance]
          .filter((r) => classOwner[r.class_id] === m.user_id).map((r) => r.created_at).sort();
        return {
          id: m.id, name: m.profiles?.full_name || m.profiles?.email || "Unknown",
          classCount: ownClasses.length, plannerCount, correctionCount, performanceCount,
          lastActive: allDates.length ? allDates[allDates.length - 1] : null,
        };
      });
      setRows(result);
    })();
  }, [schoolId]);

  if (rows === null) return <Spinner label="Loading teachers..." />;
  if (rows.length === 0) return <div className="card"><div className="card-sub">No teachers in this school yet.</div></div>;

  return (
    <div className="card">
      {rows.map((r) => (
        <div className="marks-row" key={r.id} style={{ alignItems: "flex-start" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13.5 }}>{r.name}</div>
            <div className="card-sub">{r.classCount} class{r.classCount === 1 ? "" : "es"} - {r.plannerCount} lessons, {r.correctionCount} corrections, {r.performanceCount} tests logged</div>
          </div>
          <div className="card-sub" style={{ textAlign: "right", flexShrink: 0 }}>{fmtAgo(r.lastActive)}</div>
        </div>
      ))}
    </div>
  );
}

export default function Insights({ userId, classes, school: mySchool }) {
  const [view, setView] = useState("overview");
  const [attendanceRows, setAttendanceRows] = useState([]);
  const [performanceRows, setPerformanceRows] = useState([]);
  const [terms, setTerms] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [schoolClasses, setSchoolClasses] = useState(classes);
  const [loading, setLoading] = useState(true);
  const last7 = useMemo(() => Array.from({ length: 7 }, (_, i) => toKey(addDays(new Date(), -i))).reverse(), []);
  const canReview = mySchool?.role === "coordinator" || mySchool?.role === "school_admin" || mySchool?.role === "super_admin";

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const from = last7[0], to = last7[last7.length - 1];
        const [attendance, performance, termRows, holidayRows] = await Promise.all([
          db.fetchAttendanceRange(userId, from, to),
          db.fetchAllPerformanceRecords(userId),
          mySchool?.id ? db.fetchTerms(mySchool.id) : Promise.resolve([]),
          mySchool?.id ? db.fetchHolidays(mySchool.id) : Promise.resolve([]),
        ]);
        setAttendanceRows(attendance); setPerformanceRows(performance); setTerms(termRows); setHolidays(holidayRows);

        if (canReview && mySchool?.id) {
          const [all, members] = await Promise.all([db.fetchSchoolClasses(mySchool.id), school.fetchSchoolMembers(mySchool.id)]);
          const nameByUser = Object.fromEntries(members.map((m) => [m.user_id, m.profiles?.full_name || m.profiles?.email]));
          setSchoolClasses(all.map((c) => ({ ...c, ownerName: nameByUser[c.user_id] })));
        } else {
          setSchoolClasses(classes);
        }
      } finally { setLoading(false); }
    })();
  }, [userId, last7, mySchool?.id, canReview]);

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
      <Segmented
        options={[
          { value: "overview", label: "Overview" },
          { value: "classes", label: "Classes" },
          ...(canReview ? [{ value: "teachers", label: "Teachers" }] : []),
        ]}
        value={view} onChange={setView}
      />

      {view === "overview" && (
        <>
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
          {terms.length > 0 && (
            <div className="card">
              <div className="card-title">Terms</div>
              {terms.map((t) => {
                const inRangeHolidays = holidays.filter((h) => h.date >= t.start_date && h.date <= t.end_date).map((h) => h.date);
                return (
                  <div className="marks-row" key={t.id}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13.5 }}>{t.name}</div>
                      <div className="card-sub mono">{t.start_date} to {t.end_date}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 800, fontSize: 16, color: "#F2790C" }}>{computeWorkingDays(t, inRangeHolidays)}</div>
                      <div className="card-sub">working days</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {view === "classes" && <ClassesTab classesForView={schoolClasses} canSeeOtherTeachers={canReview} />}
      {view === "teachers" && canReview && mySchool?.id && <TeachersTab schoolId={mySchool.id} />}
    </div>
  );
}

import React, { useEffect, useState, useCallback } from "react";
import { toast } from "./Toast";
import ConfirmDelete from "./ConfirmDelete";
import * as school from "../lib/school";
import * as db from "../lib/db";

const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true });
const gradeLabel = (n) => (/^\d+$/.test(n) ? `Grade ${n}` : n);

export default function AssignmentsPanel({ schoolId }) {
  const [data, setData] = useState(null);
  const [classes, setClasses] = useState([]);
  const [members, setMembers] = useState([]);
  const [classTeachers, setClassTeachers] = useState([]);
  const [busyKey, setBusyKey] = useState(null);

  const load = useCallback(async () => {
    try {
      const [structure, cls, mem, ct] = await Promise.all([
        school.fetchStructure(schoolId), db.fetchSchoolClasses(schoolId), school.fetchSchoolMembers(schoolId), school.fetchClassTeachers(schoolId),
      ]);
      setData(structure); setClasses(cls); setMembers(mem); setClassTeachers(ct);
    } catch (err) { toast(err.message || "Couldn't load assignments", "error"); }
  }, [schoolId]);
  useEffect(() => { load(); }, [load]);

  if (!data) return <div className="card-sub">Loading...</div>;

  const nameOf = (m) => m.profiles?.full_name || m.profiles?.email || "Unknown";
  const nameOfUser = (uid) => { const m = members.find((x) => x.user_id === uid); return m ? nameOf(m) : "Unknown"; };
  const subjectById = Object.fromEntries(data.subjects.map((s) => [s.id, s]));
  const classFor = (secId, subId) =>
    classes.filter((c) => c.section_id === secId && c.subject_id === subId)
      .sort((a, b) => b.students.length - a.students.length)[0] || null;

  const save = async (fn, okMsg) => {
    try { await fn(); await load(); toast(okMsg); }
    catch (err) { toast(err.message || "Couldn't save", "error"); }
  };
  const assign = async (secId, subId, teacherId) => {
    if (!teacherId) return;
    const key = `${secId}-${subId}`;
    setBusyKey(key);
    await save(() => school.assignTeacher(secId, subId, teacherId), "Teacher assigned");
    setBusyKey(null);
  };

  const grades = [...data.grades].sort(byName);
  if (grades.length === 0) {
    return <div className="card"><div className="card-sub">Set up grades, sections and subjects in the Structure tab first.</div></div>;
  }

  return (
    <div>
      <div className="card">
        <div className="card-sub" style={{ lineHeight: 1.5 }}>
          Choose who teaches each subject in each section. Changing a teacher moves that class's students, planner, attendance, corrections and tests to the new teacher. The old teacher's timetable slots for that class are removed. The class teacher and co class teachers can see every subject of their section (read only).
        </div>
      </div>
      {grades.map((g) => {
        const secs = data.sections.filter((s) => s.grade_id === g.id).sort(byName);
        return secs.map((sec) => {
          const subs = data.sectionSubjects.filter((x) => x.section_id === sec.id).map((x) => subjectById[x.subject_id]).filter(Boolean).sort(byName);
          const cts = classTeachers.filter((x) => x.section_id === sec.id);
          const main = cts.find((x) => x.is_main);
          const cos = cts.filter((x) => !x.is_main);
          const rosterSize = Math.max(0, ...classes.filter((c) => c.section_id === sec.id).map((c) => c.students.length));
          const free = members.filter((m) => !cts.some((x) => x.user_id === m.user_id));
          return (
            <div className="card" key={sec.id}>
              <div className="card-title">{gradeLabel(g.name)} - Section {sec.name}</div>
              <div className="card-sub" style={{ marginTop: -6, marginBottom: 8 }}>{rosterSize} student{rosterSize === 1 ? "" : "s"} in this section</div>

              <div className="marks-row">
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>Class teacher</div>
                  <div className="card-sub">Sees all subjects of this section</div>
                </div>
                <select className="input" style={{ padding: "6px 8px", fontSize: 12.5, width: "auto", maxWidth: 170 }}
                  value={main?.user_id || ""}
                  onChange={(e) => e.target.value
                    ? save(() => school.setMainClassTeacher(schoolId, sec.id, e.target.value), "Class teacher set")
                    : save(() => school.removeMainClassTeacher(sec.id), "Class teacher removed")}>
                  <option value="">Not assigned</option>
                  {members.map((m) => <option key={m.user_id} value={m.user_id}>{nameOf(m)}</option>)}
                </select>
              </div>
              {cos.map((c) => (
                <div className="marks-row" key={c.id}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13.5 }}>{nameOfUser(c.user_id)}</div>
                    <div className="card-sub">Co class teacher</div>
                  </div>
                  <ConfirmDelete onConfirm={() => save(() => school.removeClassTeacherUser(sec.id, c.user_id), "Co class teacher removed")} size={13} />
                </div>
              ))}
              <div className="marks-row">
                <div className="card-sub">Add a co class teacher</div>
                <select className="input" style={{ padding: "6px 8px", fontSize: 12.5, width: "auto", maxWidth: 170 }} value=""
                  onChange={(e) => e.target.value && save(() => school.addCoClassTeacher(schoolId, sec.id, e.target.value), "Co class teacher added")}>
                  <option value="">Choose...</option>
                  {free.map((m) => <option key={m.user_id} value={m.user_id}>{nameOf(m)}</option>)}
                </select>
              </div>

              {subs.length === 0 ? <div className="card-sub">No subjects set up for this section (Structure tab).</div> : subs.map((sub) => {
                const cls = classFor(sec.id, sub.id);
                const key = `${sec.id}-${sub.id}`;
                return (
                  <div className="marks-row" key={sub.id}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13.5 }}>{sub.name}</div>
                      <div className="card-sub">{cls ? `${cls.students.length} students` : rosterSize ? `No teacher yet - the ${rosterSize} students are added when you assign one` : "No class created yet"}</div>
                    </div>
                    <select className="input" style={{ padding: "6px 8px", fontSize: 12.5, width: "auto", maxWidth: 170 }}
                      value={cls?.user_id || ""} disabled={busyKey === key} onChange={(e) => assign(sec.id, sub.id, e.target.value)}>
                      {!cls && <option value="">Not assigned</option>}
                      {members.map((m) => <option key={m.user_id} value={m.user_id}>{nameOf(m)}</option>)}
                    </select>
                  </div>
                );
              })}
            </div>
          );
        });
      })}
    </div>
  );
}

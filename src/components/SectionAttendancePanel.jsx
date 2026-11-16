import React, { useEffect, useState, useCallback } from "react";
import { toast } from "./Toast";
import * as db from "../lib/db";
import * as school from "../lib/school";

const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const gradeLabel = (n) => (/^\d+$/.test(n) ? `Grade ${n}` : n);

export default function SectionAttendancePanel({ userId, schoolId, classes }) {
  const [structure, setStructure] = useState(null);
  const [mySections, setMySections] = useState(null);
  const [sectionId, setSectionId] = useState("");
  const [date, setDate] = useState(todayStr());
  const [info, setInfo] = useState(null);
  const [absent, setAbsent] = useState(new Set());
  const [dayOff, setDayOff] = useState(false);
  const [saving, setSaving] = useState(false);
  const [classId, setClassId] = useState(classes[0]?.id || "");
  const [readDate, setReadDate] = useState(todayStr());
  const [record, setRecord] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [s, mine] = await Promise.all([school.fetchStructure(schoolId), school.fetchMyClassTeacherSections(userId)]);
        setStructure(s); setMySections(mine);
        if (mine[0]) setSectionId(mine[0].section_id);
      } catch (err) { setMySections([]); }
    })();
  }, [schoolId, userId]);

  const loadSection = useCallback(async () => {
    if (!sectionId) return;
    try {
      const r = await school.fetchSectionAttendance(sectionId, date);
      setInfo(r); setAbsent(new Set(r.absent)); setDayOff(r.isDayOff);
    } catch (err) { toast(err.message || "Couldn't load attendance", "error"); }
  }, [sectionId, date]);
  useEffect(() => { loadSection(); }, [loadSection]);

  useEffect(() => {
    if (!classId) { setRecord(null); return; }
    db.fetchAttendance(userId, classId, readDate).then(setRecord).catch(() => setRecord(null));
  }, [userId, classId, readDate]);

  const label = (secId) => {
    const sec = structure?.sections.find((x) => x.id === secId);
    const g = sec && structure.grades.find((x) => x.id === sec.grade_id);
    return sec && g ? `${gradeLabel(g.name)} - Section ${sec.name}` : "Section";
  };
  const toggle = (pid) => setAbsent((prev) => { const n = new Set(prev); n.has(pid) ? n.delete(pid) : n.add(pid); return n; });
  const save = async () => {
    setSaving(true);
    try {
      const n = await school.saveSectionAttendance(sectionId, date, [...absent], dayOff);
      toast(`Attendance saved for ${n} subject${n === 1 ? "" : "s"}`);
    } catch (err) { toast(err.message || "Couldn't save", "error"); }
    finally { setSaving(false); }
  };

  const readCls = classes.find((c) => c.id === classId);
  const readAbsent = readCls && record && !record.is_day_off ? readCls.students.filter((s) => (record.present || {})[s.id] === false) : [];

  if (mySections === null) return <div className="card-sub">Loading...</div>;

  return (
    <div>
      {mySections.length > 0 ? (
        <div className="card">
          <div className="card-title">Take attendance - class teacher</div>
          <div className="card-sub" style={{ marginBottom: 8 }}>Tick the students who are absent. This applies to every subject of the section.</div>
          {mySections.length > 1 && (
            <select className="input" value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
              {mySections.map((m) => <option key={m.section_id} value={m.section_id}>{label(m.section_id)}</option>)}
            </select>
          )}
          {mySections.length === 1 && <div style={{ fontWeight: 700, fontSize: 13.5 }}>{label(sectionId)}</div>}
          <div className="field-label">Date</div>
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          <div className="toggle-row">
            <div><div className="toggle-label">Day off</div><div className="toggle-sub">No attendance for this date</div></div>
            <div className={`switch ${dayOff ? "on" : ""}`} onClick={() => setDayOff(!dayOff)}><div className="switch-knob" /></div>
          </div>
          {!info ? <div className="card-sub">Loading...</div> : info.persons.length === 0 ? (
            <div className="card-sub">{info.classCount === 0 ? "No subject class in this section yet - assign a teacher in School admin first." : "No students in this section yet."}</div>
          ) : !dayOff && (
            <>
              <div className="card-sub" style={{ margin: "6px 0" }}>{info.persons.length - absent.size}/{info.persons.length} present</div>
              {info.persons.map((p) => (
                <label key={p.person_id} className={`attendance-row ${absent.has(p.person_id) ? "absent" : "present"}`}>
                  <span>{p.name}{p.roll_no ? ` (${p.roll_no})` : ""}</span>
                  <input type="checkbox" checked={absent.has(p.person_id)} onChange={() => toggle(p.person_id)} />
                </label>
              ))}
              <div className="legend">checkbox marks a student absent - unchecked means present</div>
            </>
          )}
          {info && info.persons.length > 0 && (
            <button type="button" className="btn btn-primary" style={{ marginTop: 12, width: "100%" }} disabled={saving} onClick={save}>{saving ? "Saving..." : "Save attendance"}</button>
          )}
        </div>
      ) : (
        <div className="card"><div className="card-sub">Attendance is taken by each section's class teacher. You can see it below for the classes you teach.</div></div>
      )}

      {classes.length > 0 && (
        <div className="card">
          <div className="card-title">Attendance in my classes (view only)</div>
          <div className="row-2">
            <select className="input" value={classId} onChange={(e) => setClassId(e.target.value)}>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}{c.subject ? ` - ${c.subject}` : ""}</option>)}
            </select>
            <input type="date" className="input" value={readDate} onChange={(e) => setReadDate(e.target.value)} />
          </div>
          {!record ? <div className="card-sub" style={{ marginTop: 8 }}>Not taken for this date yet.</div>
            : record.is_day_off ? <div className="card-sub" style={{ marginTop: 8 }}>Day off.</div>
            : (
              <div style={{ marginTop: 8 }}>
                <div className="card-sub">{readCls.students.length - readAbsent.length}/{readCls.students.length} present</div>
                {readAbsent.length === 0 ? <div className="card-sub">Nobody absent.</div> : readAbsent.map((s) => <div className="marks-row" key={s.id}><span>{s.name}</span><span className="badge-mini" style={{ color: "#E8556B", background: "#E8556B15" }}>Absent</span></div>)}
              </div>
            )}
        </div>
      )}
    </div>
  );
}

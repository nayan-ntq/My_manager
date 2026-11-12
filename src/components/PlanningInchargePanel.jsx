import React, { useEffect, useState, useCallback } from "react";
import { toast } from "./Toast";
import * as school from "../lib/school";

const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true });
const gradeLabel = (n) => (/^\d+$/.test(n) ? `Grade ${n}` : n);

export default function PlanningInchargePanel({ schoolId }) {
  const [data, setData] = useState(null);
  const [incharges, setIncharges] = useState([]);
  const [members, setMembers] = useState([]);

  const load = useCallback(async () => {
    try {
      const [s, inc, mem] = await Promise.all([school.fetchStructure(schoolId), school.fetchIncharges(schoolId), school.fetchSchoolMembers(schoolId)]);
      setData(s); setIncharges(inc); setMembers(mem);
    } catch (err) { toast(err.message || "Couldn't load", "error"); }
  }, [schoolId]);
  useEffect(() => { load(); }, [load]);

  if (!data) return <div className="card-sub">Loading...</div>;

  const nameOf = (m) => m.profiles?.full_name || m.profiles?.email || "Unknown";
  const subjectById = Object.fromEntries(data.subjects.map((s) => [s.id, s]));
  const change = async (gradeId, subjectId, userId) => {
    try {
      if (userId) await school.setIncharge(schoolId, gradeId, subjectId, userId);
      else await school.removeIncharge(gradeId, subjectId);
      await load();
      toast(userId ? "Planning incharge set" : "Planning incharge removed");
    } catch (err) { toast(err.message || "Couldn't save", "error"); }
  };

  const grades = [...data.grades].sort(byName);
  if (grades.length === 0) return <div className="card"><div className="card-sub">Set up grades, sections and subjects in the Structure tab first.</div></div>;

  return (
    <div>
      <div className="card">
        <div className="card-sub" style={{ lineHeight: 1.5 }}>
          One planning incharge per grade and subject. They build that subject's plan and submit it; the coordinator approves it before teachers see it. The same teacher can lead several grades.
        </div>
      </div>
      {grades.map((g) => {
        const secIds = data.sections.filter((s) => s.grade_id === g.id).map((s) => s.id);
        const subs = [...new Set(data.sectionSubjects.filter((x) => secIds.includes(x.section_id)).map((x) => x.subject_id))]
          .map((id) => subjectById[id]).filter(Boolean).sort(byName);
        return (
          <div className="card" key={g.id}>
            <div className="card-title">{gradeLabel(g.name)}</div>
            {subs.length === 0 ? <div className="card-sub">No subjects set up for this grade yet.</div> : subs.map((sub) => {
              const inc = incharges.find((i) => i.grade_id === g.id && i.subject_id === sub.id);
              return (
                <div className="marks-row" key={sub.id}>
                  <span style={{ fontWeight: 700, fontSize: 13.5 }}>{sub.name}</span>
                  <select className="input" style={{ padding: "6px 8px", fontSize: 12.5, width: "auto", maxWidth: 170 }}
                    value={inc?.user_id || ""} onChange={(e) => change(g.id, sub.id, e.target.value)}>
                    <option value="">Not assigned</option>
                    {members.map((m) => <option key={m.user_id} value={m.user_id}>{nameOf(m)}</option>)}
                  </select>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

import React, { useEffect, useState, useCallback } from "react";
import { Plus } from "lucide-react";
import ConfirmDelete from "./ConfirmDelete";
import { toast } from "./Toast";
import * as school from "../lib/school";

const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true });
const gradeLabel = (n) => (/^\d+$/.test(n) ? `Grade ${n}` : n);
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri"]; // Saturday has its own rule below
const SAT_RULES = [
  { v: "working", l: "Saturdays are working days" },
  { v: "all", l: "Every Saturday off" },
  { v: "alt_2_4", l: "2nd and 4th Saturday off" },
  { v: "alt_1_3", l: "1st, 3rd and 5th Saturday off" },
];
const active = { background: "#F2790C", color: "#fff", borderColor: "transparent" };

export default function GradeGroupsPanel({ schoolId }) {
  const [groups, setGroups] = useState(null);
  const [grades, setGrades] = useState([]);
  const [name, setName] = useState("");

  const load = useCallback(async () => {
    try {
      const [g, s] = await Promise.all([school.fetchGradeGroups(schoolId), school.fetchStructure(schoolId)]);
      setGroups(g); setGrades(s.grades);
    } catch (err) { toast(err.message || "Couldn't load", "error"); }
  }, [schoolId]);
  useEffect(() => { load(); }, [load]);

  const run = async (fn, okMsg) => {
    try { await fn(); await load(); if (okMsg) toast(okMsg); }
    catch (err) { toast(/duplicate|unique/i.test(err.message || "") ? "That name already exists" : (err.message || "Something went wrong"), "error"); }
  };
  const add = () => {
    const n = name.trim();
    if (!n) return;
    setName("");
    run(() => school.addGradeGroup(schoolId, n), "Group added");
  };
  const toggleDay = (g, day) => {
    const cur = new Set(g.off_weekdays || []);
    cur.has(day) ? cur.delete(day) : cur.add(day);
    run(() => school.updateGradeGroup(g.id, { off_weekdays: [...cur].sort() }));
  };

  if (!groups) return <div className="card-sub">Loading...</div>;
  const sortedGrades = [...grades].sort(byName);

  return (
    <div>
      <div className="card">
        <div className="card-sub" style={{ lineHeight: 1.5 }}>
          Group grades that share the same weekly off days, for example Lower Secondary and Higher Secondary. Lecture dates follow the group's off days. Grades that are not in a group use the off days set on the Term. Term dates and holidays stay the same for everyone.
        </div>
        <div className="row-2" style={{ marginTop: 10 }}>
          <input className="input" placeholder="e.g. Lower Secondary" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
          <button type="button" className="btn btn-ghost" onClick={add}><Plus size={14} /> Add group</button>
        </div>
      </div>

      {groups.map((g) => (
        <div className="card" key={g.id}>
          <div className="card-title-row">
            <div className="card-title" style={{ marginBottom: 0 }}>{g.name}</div>
            <ConfirmDelete onConfirm={() => run(() => school.deleteGradeGroup(g.id), "Group removed")} size={13} />
          </div>

          <div className="field-label" style={{ marginTop: 0 }}>Weekly off days (Sunday to Friday)</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {DAYS.map((d, i) => (
              <button key={d} type="button" className="chip-btn" style={(g.off_weekdays || []).includes(i) ? active : undefined} onClick={() => toggleDay(g, i)}>{d}</button>
            ))}
          </div>

          <div className="field-label">Saturday</div>
          <select className="input" value={g.saturday_rule} onChange={(e) => run(() => school.updateGradeGroup(g.id, { saturday_rule: e.target.value }))}>
            {SAT_RULES.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
          </select>

          <div className="field-label">Grades in this group</div>
          {sortedGrades.length === 0 ? <div className="card-sub">Add grades in the Structure tab first.</div> : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {sortedGrades.map((gr) => {
                const inThis = gr.group_id === g.id;
                const elsewhere = gr.group_id && !inThis ? groups.find((x) => x.id === gr.group_id)?.name : null;
                return (
                  <button key={gr.id} type="button" className="chip-btn" style={inThis ? active : undefined}
                    title={elsewhere ? `Currently in ${elsewhere}` : undefined}
                    onClick={() => run(() => school.setGradeGroup(gr.id, inThis ? null : g.id))}>
                    {gradeLabel(gr.name)}{elsewhere ? ` (${elsewhere})` : ""}
                  </button>
                );
              })}
            </div>
          )}
          <div className="card-sub" style={{ marginTop: 6 }}>A grade can be in one group. Tapping a grade that is in another group moves it here.</div>
        </div>
      ))}
    </div>
  );
}

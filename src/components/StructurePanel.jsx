import React, { useEffect, useState, useCallback } from "react";
import { Plus } from "lucide-react";
import ConfirmDelete from "./ConfirmDelete";
import { toast } from "./Toast";
import * as school from "../lib/school";

const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true });
const gradeLabel = (n) => (/^\d+$/.test(n) ? `Grade ${n}` : n);
const activeChip = { background: "#F2790C", color: "#fff", borderColor: "transparent" };

export default function StructurePanel({ schoolId }) {
  const [data, setData] = useState(null);
  const [gradeName, setGradeName] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [sectionInputs, setSectionInputs] = useState({});

  const load = useCallback(async () => {
    try { setData(await school.fetchStructure(schoolId)); }
    catch (err) { toast(err.message || "Couldn't load the structure", "error"); }
  }, [schoolId]);
  useEffect(() => { load(); }, [load]);

  const run = async (fn, okMsg) => {
    try { await fn(); await load(); if (okMsg) toast(okMsg); }
    catch (err) {
      const msg = err.message || "";
      toast(/duplicate|unique/i.test(msg) ? "That name already exists" : /foreign key|violates/i.test(msg) ? "Can't remove this - a coordinator is still assigned to it" : (msg || "Something went wrong"), "error");
    }
  };

  if (!data) return <div className="card-sub">Loading...</div>;

  const subjects = [...data.subjects].sort(byName);
  const grades = [...data.grades].sort(byName);
  const sectionsOf = (gid) => data.sections.filter((s) => s.grade_id === gid).sort(byName);
  const sectionHas = (secId, subId) => data.sectionSubjects.some((x) => x.section_id === secId && x.subject_id === subId);

  const addGrade = () => {
    const n = gradeName.trim();
    if (!n) return;
    setGradeName("");
    run(() => school.addGrade(schoolId, n), "Grade added");
  };
  const addSubject = () => {
    const n = subjectName.trim();
    if (!n) return;
    setSubjectName("");
    run(() => school.addSubject(schoolId, n), "Subject added");
  };
  const addSection = (gid) => {
    const n = (sectionInputs[gid] || "").trim().toUpperCase();
    if (!n) return;
    const copyFrom = sectionsOf(gid)[0]?.id;
    setSectionInputs({ ...sectionInputs, [gid]: "" });
    run(() => school.addSection(schoolId, gid, n, copyFrom), "Section added");
  };

  return (
    <div>
      <div className="card">
        <div className="card-title">Subjects</div>
        <div className="card-sub" style={{ marginBottom: 10 }}>Every subject your school teaches. Add each one once.</div>
        {subjects.map((s) => (
          <div className="marks-row" key={s.id}>
            <span>{s.name}</span>
            <ConfirmDelete onConfirm={() => run(() => school.deleteSubject(s.id), "Subject removed")} size={13} />
          </div>
        ))}
        <div className="row-2" style={{ marginTop: 10 }}>
          <input className="input" placeholder="e.g. Mathematics" value={subjectName} onChange={(e) => setSubjectName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addSubject()} />
          <button type="button" className="btn btn-ghost" onClick={addSubject}><Plus size={14} /> Add subject</button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Add a grade</div>
        <div className="row-2">
          <input className="input" placeholder="e.g. 6" value={gradeName} onChange={(e) => setGradeName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addGrade()} />
          <button type="button" className="btn btn-ghost" onClick={addGrade}><Plus size={14} /> Add grade</button>
        </div>
      </div>

      {grades.map((g) => {
        const secs = sectionsOf(g.id);
        const secIds = secs.map((s) => s.id);
        return (
          <div className="card" key={g.id}>
            <div className="card-title-row">
              <div className="card-title" style={{ marginBottom: 0 }}>{gradeLabel(g.name)}</div>
              <ConfirmDelete onConfirm={() => run(() => school.deleteGrade(g.id), "Grade removed")} size={13} />
            </div>

            <div className="field-label" style={{ marginTop: 0 }}>Sections</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {secs.map((sec) => (
                <span key={sec.id} className="chip-btn" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                  {sec.name}
                  <ConfirmDelete onConfirm={() => run(() => school.deleteSection(sec.id), "Section removed")} size={11} />
                </span>
              ))}
              {secs.length === 0 && <div className="card-sub">No sections yet.</div>}
            </div>
            <div className="row-2" style={{ marginTop: 8 }}>
              <input className="input" placeholder="Section (e.g. A)" value={sectionInputs[g.id] || ""}
                onChange={(e) => setSectionInputs({ ...sectionInputs, [g.id]: e.target.value })} onKeyDown={(e) => e.key === "Enter" && addSection(g.id)} />
              <button type="button" className="btn btn-ghost" onClick={() => addSection(g.id)}><Plus size={14} /> Add section</button>
            </div>

            <div className="field-label">Subjects taught in this grade</div>
            {subjects.length === 0 ? (
              <div className="card-sub">Add subjects at the top first.</div>
            ) : secs.length === 0 ? (
              <div className="card-sub">Add a section first.</div>
            ) : (
              <>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {subjects.map((sub) => {
                    const on = secIds.every((id) => sectionHas(id, sub.id));
                    return (
                      <button type="button" key={sub.id} className="chip-btn" style={on ? activeChip : undefined}
                        onClick={() => run(() => school.setSubjectForSections(schoolId, secIds, sub.id, !on))}>
                        {sub.name}
                      </button>
                    );
                  })}
                </div>
                <div className="card-sub" style={{ marginTop: 6 }}>Applies to every section of this grade. A new section copies these automatically.</div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

import React, { useEffect, useState, useCallback } from "react";
import { Plus, X } from "lucide-react";
import ConfirmDelete from "./ConfirmDelete";
import ExamSyllabusEditor from "./ExamSyllabusEditor";
import { toast } from "./Toast";
import { DEFAULT_TEST_TYPES } from "../lib/constants";
import * as school from "../lib/school";

const byName = (a, b) => a.localeCompare(b, undefined, { numeric: true });
const gradeLabel = (n) => (/^\d+$/.test(n) ? `Grade ${n}` : n);
const STATUS = {
  draft: { label: "Syllabus: draft", color: "#9c9488" },
  submitted: { label: "Syllabus: awaiting approval", color: "#D9A441" },
  approved: { label: "Syllabus: approved", color: "#2FA88F" },
};
const active = { background: "#F2790C", color: "#fff", borderColor: "transparent" };

function BasicsSheet({ exam, types, onClose, onSave }) {
  const [title, setTitle] = useState(exam.title);
  const [type, setType] = useState(exam.exam_type);
  const [date, setDate] = useState(exam.exam_date || "");
  const [max, setMax] = useState(exam.max_marks);
  const [passing, setPassing] = useState(exam.passing_marks ?? "");
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2 className="sheet-title">Exam details</h2>
          <button type="button" className="btn btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="card-sub" style={{ marginBottom: 6 }}>Changes apply to every section's test.</div>
        <div className="field-label">Title</div>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="field-label">Exam type</div>
        <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
          {!types.some((t) => t.name === type) && <option value={type}>{type}</option>}
          {types.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
        </select>
        <div className="field-label">Date of exam</div>
        <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        <div className="row-2">
          <div><div className="field-label">Max marks</div><input type="number" className="input" value={max} onChange={(e) => setMax(e.target.value)} /></div>
          <div><div className="field-label">Passing marks</div><input type="number" className="input" value={passing} onChange={(e) => setPassing(e.target.value)} /></div>
        </div>
        <div className="sheet-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={() => title.trim() && onSave({
            title: title.trim(), exam_type: type, exam_date: date || null, max_marks: Number(max) || 20, passing_marks: passing === "" ? null : Number(passing),
          })}>Save</button>
        </div>
      </div>
    </div>
  );
}

export default function ExamsPanel({ userId, schoolId, role, gradeId, testTypes }) {
  const isAdmin = role === "school_admin" || role === "super_admin";
  const isManager = isAdmin || role === "coordinator";
  const types = testTypes?.length ? testTypes : DEFAULT_TEST_TYPES;

  const [structure, setStructure] = useState(null);
  const [exams, setExams] = useState([]);
  const [incharges, setIncharges] = useState([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ pairKey: "", title: "", type: types[0]?.name || "", date: "", max: 20, passing: types[0]?.passingMarks ?? "", sections: [] });
  const [editSyllabus, setEditSyllabus] = useState(null);
  const [editBasics, setEditBasics] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, e, inc] = await Promise.all([school.fetchStructure(schoolId), school.fetchExams(schoolId), school.fetchIncharges(schoolId)]);
      setStructure(s); setExams(e); setIncharges(inc);
    } catch (err) { toast(err.message || "Couldn't load exams", "error"); }
  }, [schoolId]);
  useEffect(() => { load(); }, [load]);

  if (!structure) return <div className="card-sub">Loading...</div>;

  const gradeById = (id) => structure.grades.find((g) => g.id === id);
  const subjectById = (id) => structure.subjects.find((s) => s.id === id);
  const sectionById = (id) => structure.sections.find((s) => s.id === id);
  const inGrade = (gid) => role !== "coordinator" || !gradeId || gid === gradeId;

  // grade + subject pairs the admin or coordinator can create an exam for
  const pairs = [];
  if (isManager) {
    const seen = new Set();
    for (const ss of structure.sectionSubjects) {
      const sec = sectionById(ss.section_id);
      const g = sec && gradeById(sec.grade_id);
      const s = subjectById(ss.subject_id);
      if (!g || !s || !inGrade(g.id)) continue;
      const key = `${g.id}|${s.id}`;
      if (!seen.has(key)) { seen.add(key); pairs.push({ key, grade: g, subject: s }); }
    }
    pairs.sort((a, b) => byName(a.grade.name, b.grade.name) || byName(a.subject.name, b.subject.name));
  }
  const pair = pairs.find((p) => p.key === form.pairKey) || pairs[0] || null;
  const gradeSections = pair
    ? structure.sections.filter((s) => s.grade_id === pair.grade.id && structure.sectionSubjects.some((x) => x.section_id === s.id && x.subject_id === pair.subject.id)).sort((a, b) => byName(a.name, b.name))
    : [];
  const batches = [...new Set(gradeSections.map((s) => s.batch).filter(Boolean))];
  const chosen = form.sections.filter((id) => gradeSections.some((s) => s.id === id));

  const toggleSection = (id) => setForm({ ...form, sections: chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id] });
  const pickBatch = (b) => {
    const ids = gradeSections.filter((s) => s.batch === b).map((s) => s.id);
    const all = ids.every((id) => chosen.includes(id));
    setForm({ ...form, sections: all ? chosen.filter((id) => !ids.includes(id)) : [...new Set([...chosen, ...ids])] });
  };
  const setType = (name) => setForm({ ...form, type: name, passing: types.find((t) => t.name === name)?.passingMarks ?? "" });

  const run = async (fn, okMsg) => {
    try { await fn(); await load(); if (okMsg) toast(okMsg); }
    catch (err) { toast(err.message || "Something went wrong", "error"); }
  };
  const create = async () => {
    if (!pair || !form.title.trim() || chosen.length === 0) { toast("Add a title and choose at least one section", "error"); return; }
    setSaving(true);
    try {
      const r = await school.createExam({
        gradeId: pair.grade.id, subjectId: pair.subject.id, title: form.title.trim(), examType: form.type, examDate: form.date || null,
        maxMarks: Number(form.max) || 20, passingMarks: form.passing === "" ? null : Number(form.passing), sectionIds: chosen,
      });
      setCreating(false);
      setForm({ ...form, title: "", date: "", sections: [] });
      await load();
      const skipped = r?.skipped || [];
      toast(`Exam created for ${r?.created ?? 0} class${r?.created === 1 ? "" : "es"}${skipped.length ? `. Section ${skipped.join(", ")} has no teacher for this subject yet - it gets the test once one is assigned` : ""}`);
    } catch (err) { toast(err.message || "Couldn't create the exam", "error"); }
    finally { setSaving(false); }
  };

  const inchargeOf = (x) => incharges.some((i) => i.user_id === userId && i.grade_id === x.grade_id && i.subject_id === x.subject_id);
  const canSee = (x) => isManager || inchargeOf(x) || x.syllabus_status === "approved";
  const canEditSyllabus = (x) => isAdmin || (role === "coordinator" && inGrade(x.grade_id) && x.syllabus_status !== "approved") || (inchargeOf(x) && x.syllabus_status === "draft");
  const canEditBasics = (x) => isAdmin || (role === "coordinator" && inGrade(x.grade_id) && x.syllabus_status !== "approved");
  const canReview = (x) => isManager && inGrade(x.grade_id) && x.syllabus_status === "submitted";

  const approve = (x) => run(() => school.reviewExamSyllabus(x.id, true), "Syllabus approved - the concepts are now in every section's test");
  const sendBack = (x) => {
    const note = window.prompt("Note for the planning incharge (optional)");
    if (note === null) return;
    run(() => school.reviewExamSyllabus(x.id, false, note), "Sent back to the incharge");
  };

  return (
    <div>
      {isManager && (
        <div className="card">
          {!creating ? (
            pairs.length === 0
              ? <div className="card-sub">Set up grades, sections and subjects in School admin first.</div>
              : <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={14} /> New exam</button>
          ) : (
            <>
              <div className="card-title">New exam</div>
              <div className="field-label" style={{ marginTop: 0 }}>Grade and subject</div>
              <select className="input" value={pair?.key || ""} onChange={(e) => setForm({ ...form, pairKey: e.target.value, sections: [] })}>
                {pairs.map((p) => <option key={p.key} value={p.key}>{gradeLabel(p.grade.name)} - {p.subject.name}</option>)}
              </select>
              <div className="field-label">Title</div>
              <input className="input" placeholder="e.g. Unit Test 2" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              <div className="row-2">
                <div>
                  <div className="field-label">Exam type</div>
                  <select className="input" value={form.type} onChange={(e) => setType(e.target.value)}>
                    {types.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
                  </select>
                </div>
                <div><div className="field-label">Date of exam</div><input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
              </div>
              <div className="row-2">
                <div><div className="field-label">Max marks</div><input type="number" className="input" value={form.max} onChange={(e) => setForm({ ...form, max: e.target.value })} /></div>
                <div><div className="field-label">Passing marks</div><input type="number" className="input" value={form.passing} onChange={(e) => setForm({ ...form, passing: e.target.value })} /></div>
              </div>
              <div className="field-label">Sections taking this exam</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                <button type="button" className="chip-btn" style={chosen.length === gradeSections.length && gradeSections.length ? active : undefined}
                  onClick={() => setForm({ ...form, sections: chosen.length === gradeSections.length ? [] : gradeSections.map((s) => s.id) })}>All sections</button>
                {batches.map((b) => {
                  const ids = gradeSections.filter((s) => s.batch === b).map((s) => s.id);
                  return <button key={b} type="button" className="chip-btn" style={ids.every((id) => chosen.includes(id)) ? active : undefined} onClick={() => pickBatch(b)}>{b} batch</button>;
                })}
                {gradeSections.map((s) => (
                  <button key={s.id} type="button" className="chip-btn" style={chosen.includes(s.id) ? active : undefined} onClick={() => toggleSection(s.id)}>
                    {s.name}{s.batch ? ` (${s.batch})` : ""}
                  </button>
                ))}
              </div>
              {gradeSections.length === 0 && <div className="card-sub">No sections run this subject yet.</div>}
              <div className="sheet-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setCreating(false)}>Cancel</button>
                <button type="button" className="btn btn-primary" disabled={saving} onClick={create}>{saving ? "Creating..." : "Create exam"}</button>
              </div>
            </>
          )}
        </div>
      )}

      {exams.length === 0 ? (
        <div className="card"><div className="card-sub">{isManager ? "No exams yet." : "No exams for your subjects yet. Exams are created by the admin or coordinator."}</div></div>
      ) : exams.map((x) => {
        const g = gradeById(x.grade_id), sub = subjectById(x.subject_id);
        const secNames = (x.exam_sections || []).map((e) => sectionById(e.section_id)?.name).filter(Boolean).sort(byName);
        const st = STATUS[x.syllabus_status] || STATUS.draft;
        const visible = canSee(x);
        return (
          <div className="card" key={x.id}>
            <div className="card-title-row">
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{x.title} <span className="badge-mini">{x.exam_type}</span></div>
                <div className="card-sub">{g ? gradeLabel(g.name) : ""} - {sub?.name} - section{secNames.length === 1 ? "" : "s"} {secNames.join(", ") || "-"}</div>
                <div className="card-sub mono">{x.exam_date || "Date not set"} - out of {x.max_marks}{x.passing_marks != null ? ` - pass ${x.passing_marks}` : ""}</div>
              </div>
              <span className="badge-mini" style={{ color: st.color, background: `${st.color}15` }}>{st.label}</span>
            </div>
            {x.syllabus_note && x.syllabus_status === "draft" && <div className="planner-field" style={{ color: "#E8556B" }}>Sent back: {x.syllabus_note}</div>}
            {visible ? (
              <>
                {(x.syllabus_chapters || []).length > 0 && (
                  <div className="planner-field"><span className="planner-label">Chapters:</span> {x.syllabus_chapters.map((c) => `${c.chapter_number ? `Ch ${c.chapter_number}: ` : ""}${c.chapter_name}`).join(", ")}</div>
                )}
                {(x.syllabus_concepts || []).length > 0 && (
                  <div className="planner-field"><span className="planner-label">Concepts and questions:</span> {x.syllabus_concepts.join(", ")}</div>
                )}
                {x.syllabus_text && <div className="planner-field"><span className="planner-label">Notes:</span> {x.syllabus_text}</div>}
                {!(x.syllabus_chapters || []).length && !(x.syllabus_concepts || []).length && !x.syllabus_text && <div className="card-sub">The syllabus hasn't been filled in yet.</div>}
              </>
            ) : <div className="card-sub">The syllabus will show here once it is approved.</div>}
            <div className="task-actions">
              {canEditSyllabus(x) && <button type="button" className="btn btn-skip" onClick={() => setEditSyllabus(x)}>Edit syllabus</button>}
              {canEditBasics(x) && <button type="button" className="btn btn-skip" onClick={() => setEditBasics(x)}>Details</button>}
              {canReview(x) && (
                <>
                  <button type="button" className="btn btn-done" onClick={() => approve(x)}>Approve</button>
                  <button type="button" className="btn btn-skip" onClick={() => sendBack(x)}>Send back</button>
                </>
              )}
              {isAdmin && <ConfirmDelete onConfirm={() => run(() => school.deleteExam(x.id), "Exam deleted - the test records and their marks are kept")} size={13} />}
            </div>
          </div>
        );
      })}

      {editSyllabus && (
        <ExamSyllabusEditor
          exam={editSyllabus} schoolId={schoolId}
          gradeName={gradeById(editSyllabus.grade_id)?.name || ""} subjectName={subjectById(editSyllabus.subject_id)?.name || ""}
          canSubmit={editSyllabus.syllabus_status === "draft" && (inchargeOf(editSyllabus) || isManager)}
          onClose={() => setEditSyllabus(null)} onDone={async () => { setEditSyllabus(null); await load(); }} />
      )}
      {editBasics && (
        <BasicsSheet exam={editBasics} types={types} onClose={() => setEditBasics(null)}
          onSave={(patch) => { run(() => school.updateExam(editBasics.id, patch), "Exam updated"); setEditBasics(null); }} />
      )}
    </div>
  );
}

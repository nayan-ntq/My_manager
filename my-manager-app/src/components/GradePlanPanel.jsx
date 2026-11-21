import React, { useEffect, useState, useCallback } from "react";
import { Plus, Check, X } from "lucide-react";
import ConfirmDelete from "./ConfirmDelete";
import PlannerEntryEditSheet from "./PlannerEntryEditSheet";
import PhotoImportButton from "./PhotoImportButton";
import { toast } from "./Toast";
import * as school from "../lib/school";

const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true });
const gradeLabel = (n) => (/^\d+$/.test(n) ? `Grade ${n}` : n);
const STATUS = {
  draft: { label: "Draft", color: "#9c9488" },
  submitted: { label: "Awaiting approval", color: "#D9A441" },
  approved: { label: "Approved", color: "#2FA88F" },
};

export default function GradePlanPanel({ userId, schoolId, role, gradeId }) {
  const isManager = role === "coordinator" || role === "school_admin" || role === "super_admin";
  const [structure, setStructure] = useState(null);
  const [incharges, setIncharges] = useState([]);
  const [pairKey, setPairKey] = useState("");
  const [lectures, setLectures] = useState([]);
  const [newNumber, setNewNumber] = useState("");
  const [editing, setEditing] = useState(null);
  const [importRows, setImportRows] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [s, inc] = await Promise.all([school.fetchStructure(schoolId), school.fetchIncharges(schoolId)]);
        setStructure(s); setIncharges(inc);
      } catch (err) { toast(err.message || "Couldn't load", "error"); }
    })();
  }, [schoolId]);

  // which grade + subject plans this person can open
  const pairs = [];
  if (structure) {
    const seen = new Set();
    const gradeById = (id) => structure.grades.find((x) => x.id === id);
    const subjectById = (id) => structure.subjects.find((x) => x.id === id);
    const add = (g, s) => {
      if (!g || !s) return;
      const key = `${g.id}|${s.id}`;
      if (!seen.has(key)) { seen.add(key); pairs.push({ key, grade: g, subject: s }); }
    };
    if (isManager) {
      for (const ss of structure.sectionSubjects) {
        const sec = structure.sections.find((x) => x.id === ss.section_id);
        const g = sec && gradeById(sec.grade_id);
        if (g && (role !== "coordinator" || !gradeId || g.id === gradeId)) add(g, subjectById(ss.subject_id));
      }
    }
    for (const inc of incharges.filter((i) => i.user_id === userId)) add(gradeById(inc.grade_id), subjectById(inc.subject_id));
    pairs.sort((a, b) => byName(a.grade, b.grade) || byName(a.subject, b.subject));
  }
  const pair = pairs.find((p) => p.key === pairKey) || pairs[0] || null;
  const gid = pair?.grade.id, sid = pair?.subject.id;

  const loadLectures = useCallback(async () => {
    if (!gid || !sid) { setLectures([]); return; }
    try { setLectures(await school.fetchGradePlan(gid, sid)); }
    catch (err) { toast(err.message || "Couldn't load the plan", "error"); }
  }, [gid, sid]);
  useEffect(() => { loadLectures(); }, [loadLectures]);

  const isInchargeHere = incharges.some((i) => i.user_id === userId && i.grade_id === gid && i.subject_id === sid);
  const canEdit = (l) => isManager || (isInchargeHere && l.status === "draft");

  const run = async (fn, okMsg) => {
    try {
      const r = await fn();
      await loadLectures();
      if (okMsg) toast(typeof okMsg === "function" ? okMsg(r) : okMsg);
    } catch (err) {
      toast(/duplicate|unique/i.test(err.message || "") ? "That lecture number already exists" : (err.message || "Something went wrong"), "error");
    }
  };
  const addLecture = async () => {
    const n = parseInt(newNumber, 10);
    if (!n || n < 1) return;
    try {
      const row = await school.addPlanLecture(schoolId, gid, sid, n, userId);
      setNewNumber("");
      await loadLectures();
      setEditing(row);
    } catch (err) {
      toast(/duplicate|unique/i.test(err.message || "") ? `Lecture ${n} already exists` : (err.message || "Couldn't add"), "error");
    }
  };
  const saveLecture = async (patch) => {
    // "done" ticks belong to a section's teacher, never to the shared plan
    const strip = (items) => (items || []).map(({ done, ...rest }) => rest);
    await run(() => school.updatePlanLecture(editing.id, {
      chapter_number: patch.chapter_number, chapter: patch.chapter, objectives: patch.objectives, resources: patch.resources,
      classwork_items: strip(patch.classwork_items), homework_items: strip(patch.homework_items),
    }), "Lecture saved");
    setEditing(null);
  };
  const submit = () => run(() => school.submitPlan(gid, sid, null), (n) => `${n} lecture${n === 1 ? "" : "s"} submitted for approval`);
  const approve = (ids) => run(() => school.reviewPlan(ids, true), (n) => `${n} lecture${n === 1 ? "" : "s"} approved and sent to every section`);
  const sendBack = (ids) => {
    const note = window.prompt("Note for the incharge (optional)");
    if (note === null) return;
    run(() => school.reviewPlan(ids, false, note), "Sent back to the incharge");
  };

  // photo import: the section label on the page is ignored; one lecture number = one lecture
  const onPhotoResult = ({ data }) => {
    const entries = data?.entries?.length ? data.entries : data ? [data] : [];
    const byNum = new Map();
    for (const e of entries) {
      const n = parseInt(e.lecture_number, 10);
      if (!n) continue;
      const size = (e.classwork_items || []).length + (e.homework_items || []).length;
      const cur = byNum.get(n);
      if (!cur || size > cur.size) byNum.set(n, { ...e, lecture_number: n, size });
    }
    if (byNum.size === 0) { toast("No lecture numbers found - write 'Lec 12' next to each lesson", "error"); return; }
    setImportRows([...byNum.values()].sort((a, b) => a.lecture_number - b.lecture_number)
      .map((r) => ({ ...r, exists: lectures.some((l) => l.lecture_number === r.lecture_number) })));
  };
  const cleanItems = (items) => (items || []).filter((it) => it?.text?.trim())
    .map((it) => ({ exercise: it.exercise || "", text: it.text.trim(), medium: it.medium || "", important: !!it.important }));
  const confirmImport = async () => {
    let added = 0;
    for (const r of importRows.filter((x) => !x.exists)) {
      try {
        await school.createPlanLecture(schoolId, gid, sid, userId, { ...r, classwork_items: cleanItems(r.classwork_items), homework_items: cleanItems(r.homework_items) });
        added++;
      } catch (err) { /* a lecture number that appeared in the meantime is skipped */ }
    }
    setImportRows(null);
    await loadLectures();
    toast(`${added} lecture${added === 1 ? "" : "s"} imported as drafts`);
  };

  if (!structure) return <div className="card-sub">Loading...</div>;
  if (!pair) return <div className="card"><div className="card-sub">No plans to show yet. An admin or coordinator can make you the planning incharge for a subject.</div></div>;

  const drafts = lectures.filter((l) => l.status === "draft");
  const waiting = lectures.filter((l) => l.status === "submitted");

  return (
    <div>
      <div className="card">
        <div className="field-label" style={{ marginTop: 0 }}>Plan</div>
        <select className="input" value={pair.key} onChange={(e) => setPairKey(e.target.value)}>
          {pairs.map((p) => <option key={p.key} value={p.key}>{gradeLabel(p.grade.name)} - {p.subject.name}</option>)}
        </select>
        <div className="card-sub" style={{ marginTop: 6 }}>
          {isInchargeHere ? "You are the planning incharge. Build the lectures, then submit them for approval." : "Edits you make apply to every section straight away."}
        </div>
        {(isManager || isInchargeHere) && (
          <div className="row-2" style={{ marginTop: 10 }}>
            <input type="number" min="1" className="input" placeholder="Lecture number" value={newNumber} onChange={(e) => setNewNumber(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addLecture()} />
            <button type="button" className="btn btn-ghost" onClick={addLecture}><Plus size={14} /> Add lecture</button>
          </div>
        )}
        {(isManager || isInchargeHere) && (
          <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
            <PhotoImportButton kind="planner" context={{}} onResult={onPhotoResult} label="Import plan from photo" />
          </div>
        )}
        {(isManager || isInchargeHere) && drafts.length > 0 && (
          <button type="button" className="btn btn-primary" style={{ marginTop: 10, width: "100%" }} onClick={submit}>
            Submit {drafts.length} draft lecture{drafts.length === 1 ? "" : "s"} for approval
          </button>
        )}
        {isManager && waiting.length > 0 && (
          <button type="button" className="btn btn-done" style={{ marginTop: 10 }} onClick={() => approve(waiting.map((l) => l.id))}>
            <Check size={13} /> Approve all {waiting.length} waiting
          </button>
        )}
      </div>

      {importRows && (
        <div className="card">
          <div className="card-title">Import from photo</div>
          <div className="card-sub" style={{ marginBottom: 8 }}>
            Found {importRows.length} lecture{importRows.length === 1 ? "" : "s"}. Sections are ignored: this is one plan for the whole grade. They come in as drafts you can still edit.
          </div>
          {importRows.map((r) => (
            <div className="marks-row" key={r.lecture_number}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>
                  Lecture {r.lecture_number}{r.chapter ? ` - ${r.chapter_number ? `Ch ${r.chapter_number}: ` : ""}${r.chapter}` : ""}
                </div>
                <div className="card-sub">{(r.classwork_items || []).length} classwork, {(r.homework_items || []).length} homework{r.exists ? " - already in the plan, will be skipped" : ""}</div>
              </div>
              {!r.exists && <button type="button" className="btn btn-icon" onClick={() => setImportRows(importRows.filter((x) => x.lecture_number !== r.lecture_number))}><X size={13} /></button>}
            </div>
          ))}
          <div className="sheet-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setImportRows(null)}>Discard</button>
            <button type="button" className="btn btn-primary" onClick={confirmImport}>Import {importRows.filter((r) => !r.exists).length} as drafts</button>
          </div>
        </div>
      )}
      {lectures.length === 0 ? (
        <div className="card"><div className="card-sub">No lectures in this plan yet.</div></div>
      ) : lectures.map((l) => {
        const st = STATUS[l.status] || STATUS.draft;
        return (
          <div className="card" key={l.id}>
            <div className="card-title-row">
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>
                  Lecture {l.lecture_number}{l.chapter ? ` - ${l.chapter_number ? `Ch ${l.chapter_number}: ` : ""}${l.chapter}` : ""}
                </div>
                <div className="card-sub">{(l.classwork_items || []).length} classwork, {(l.homework_items || []).length} homework questions</div>
              </div>
              <span className="badge-mini" style={{ color: st.color, background: `${st.color}15` }}>{st.label}</span>
            </div>
            {l.review_note && l.status === "draft" && <div className="planner-field" style={{ color: "#E8556B" }}>Sent back: {l.review_note}</div>}
            <div className="task-actions">
              {canEdit(l) && <button type="button" className="btn btn-skip" onClick={() => setEditing(l)}>Edit</button>}
              {isManager && l.status === "submitted" && (
                <>
                  <button type="button" className="btn btn-done" onClick={() => approve([l.id])}><Check size={13} /> Approve</button>
                  <button type="button" className="btn btn-skip" onClick={() => sendBack([l.id])}><X size={13} /> Send back</button>
                </>
              )}
              {canEdit(l) && <ConfirmDelete onConfirm={() => run(() => school.deletePlanLecture(l.id), "Lecture deleted")} size={13} />}
            </div>
          </div>
        );
      })}
      {editing && <PlannerEntryEditSheet entry={editing} hideStatus onClose={() => setEditing(null)} onSave={saveLecture} />}
    </div>
  );
}

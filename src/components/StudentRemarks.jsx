import React, { useEffect, useState, useCallback } from "react";
import ConfirmDelete from "./ConfirmDelete";
import { toast } from "./Toast";
import * as db from "../lib/db";
import * as school from "../lib/school";

export default function StudentRemarks({ student, cls }) {
  const [me, setMe] = useState(null);
  const [remarks, setRemarks] = useState(null);
  const [options, setOptions] = useState([]);
  const [target, setTarget] = useState("");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const usable = !!student.person_id && !!cls.section_id;

  const load = useCallback(async () => {
    if (!usable) return;
    try {
      const session = await db.getSession();
      const uid = session?.user?.id || null;
      setMe(uid);
      const [list, sib, mySections] = await Promise.all([
        school.fetchRemarks(student.person_id, cls.section_id),
        school.fetchStudentSiblings(student.person_id),
        school.fetchMyClassTeacherSections(uid),
      ]);
      setRemarks(list);
      const opts = sib.filter((s) => s.classes?.user_id === uid).map((s) => ({ value: s.class_id, label: `About ${s.classes?.subject || s.classes?.name}` }));
      if (cls.user_id === uid && !opts.some((o) => o.value === cls.id)) opts.push({ value: cls.id, label: `About ${cls.subject || cls.name}` });
      if (mySections.some((x) => x.section_id === cls.section_id)) opts.push({ value: "overall", label: "Overall (the whole child)" });
      setOptions(opts);
      setTarget((t) => (opts.some((o) => o.value === t) ? t : opts[0]?.value || ""));
    } catch (err) { setRemarks([]); }
  }, [student.person_id, cls.section_id, cls.id]);
  useEffect(() => { load(); }, [load]);

  if (!usable) return null;

  const add = async () => {
    if (!text.trim() || !target) return;
    setSaving(true);
    try {
      await school.addRemark({
        schoolId: cls.school_id, sectionId: cls.section_id, personId: student.person_id,
        classId: target === "overall" ? null : target, kind: target === "overall" ? "overall" : "subject",
        body: text.trim(), authorId: me,
      });
      setText(""); await load(); toast("Remark added");
    } catch (err) { toast(err.message || "Couldn't add the remark", "error"); }
    finally { setSaving(false); }
  };
  const remove = async (id) => {
    try { await school.deleteRemark(id); await load(); toast("Remark deleted"); }
    catch (err) { toast(err.message || "Couldn't delete", "error"); }
  };

  return (
    <div className="card">
      <div className="card-title">Remarks</div>
      {remarks === null ? <div className="card-sub">Loading...</div> : remarks.length === 0 ? <div className="card-sub">No remarks yet.</div> : remarks.map((r) => (
        <div key={r.id} style={{ borderBottom: "1px solid #F1ECE3", padding: "8px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
            <div className="card-sub mono">
              {r.remark_date} - {r.profiles?.full_name || r.profiles?.email || "A teacher"}
              <span className="badge-mini">{r.kind === "overall" ? "Overall" : r.classes?.subject || "Subject"}</span>
            </div>
          </div>
          <div style={{ fontSize: 13.5, marginTop: 3, whiteSpace: "pre-wrap" }}>{r.body}</div>
        </div>
      ))}
      {options.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <select className="input" value={target} onChange={(e) => setTarget(e.target.value)}>
            {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <textarea className="input textarea" style={{ marginTop: 8 }} placeholder="Write a remark..." value={text} onChange={(e) => setText(e.target.value)} />
          <button type="button" className="btn btn-primary" style={{ marginTop: 8 }} disabled={saving || !text.trim()} onClick={add}>{saving ? "Saving..." : "Add remark"}</button>
        </div>
      )}
    </div>
  );
}

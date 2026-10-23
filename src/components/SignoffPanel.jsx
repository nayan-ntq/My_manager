import React, { useEffect, useState, useCallback } from "react";
import { Check, X, Pencil } from "lucide-react";
import { toast } from "./Toast";
import PlannerEntryEditSheet from "./PlannerEntryEditSheet";
import * as school from "../lib/school";
import * as db from "../lib/db";

export default function SignoffPanel({ schoolId, userId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [noteFor, setNoteFor] = useState(null); // entry id currently being rejected with a note
  const [note, setNote] = useState("");
  const [editingRow, setEditingRow] = useState(null);

  const load = useCallback(async () => { setRows(await school.fetchPendingSignoffs(schoolId)); setLoading(false); }, [schoolId]);
  useEffect(() => { load(); }, [load]);

  const approve = async (row) => {
    await school.reviewSignoff(row.id, true, null, userId);
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    toast("Approved");
  };
  const reject = async (row) => {
    await school.reviewSignoff(row.id, false, note.trim() || null, userId);
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    setNoteFor(null); setNote("");
    toast("Sent back to the teacher");
  };

  // A reviewer can fix a plan directly while reviewing it, instead of only approving or bouncing it back.
  const saveEdit = async (patch) => {
    await db.updatePlannerEntry(editingRow.id, patch);
    setRows((prev) => prev.map((r) => r.id === editingRow.id ? { ...r, ...patch } : r));
    setEditingRow(null);
    toast("Plan updated");
  };

  if (loading) return <div className="page"><div className="card-sub">Loading...</div></div>;

  return (
    <div>
      {rows.length === 0 ? (
        <div className="empty-state"><div className="empty-state-text">Nothing waiting for sign-off right now.</div></div>
      ) : rows.map((r) => (
        <div className="card" key={r.id}>
          <div className="card-title-row">
            <div>
              <div className="card-title" style={{ marginBottom: 0 }}>{r.classes?.name || "Class"}</div>
              <div className="card-sub mono">{r.lecture_number ? `Lecture ${r.lecture_number}` : r.date}</div>
            </div>
          </div>
          <div className="planner-field"><b>{r.chapter_number ? `Ch ${r.chapter_number}: ` : ""}{r.chapter}</b></div>
          {r.objectives && <div className="planner-field"><span className="planner-label">Objectives:</span> {r.objectives}</div>}
          {r.methodology && <div className="planner-field"><span className="planner-label">Classwork:</span> {r.methodology}</div>}
          {r.assignment && <div className="planner-field"><span className="planner-label">Homework:</span> {r.assignment}</div>}

          {noteFor === r.id ? (
            <div style={{ marginTop: 10 }}>
              <input className="input" placeholder="Note for the teacher (optional)" value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
              <div className="sheet-actions" style={{ marginTop: 8 }}>
                <button type="button" className="btn btn-ghost" onClick={() => { setNoteFor(null); setNote(""); }}>Cancel</button>
                <button type="button" className="btn btn-danger" onClick={() => reject(r)}>Send back</button>
              </div>
            </div>
          ) : (
            <div className="task-actions">
              <button className="btn btn-done" onClick={() => approve(r)}><Check size={13} /> Approve</button>
              <button className="btn btn-skip" onClick={() => setEditingRow(r)}><Pencil size={13} /> Edit</button>
              <button className="btn btn-skip" onClick={() => setNoteFor(r.id)}><X size={13} /> Send back</button>
            </div>
          )}
        </div>
      ))}
      {editingRow && (
        <PlannerEntryEditSheet entry={editingRow} hideStatus onClose={() => setEditingRow(null)} onSave={saveEdit} />
      )}
    </div>
  );
}

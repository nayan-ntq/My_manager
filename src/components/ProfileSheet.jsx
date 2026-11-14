import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import * as school from "../lib/school";
import * as db from "../lib/db";
import { toast } from "./Toast";

export default function ProfileSheet({ userId, onClose }) {
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [subjectsTaught, setSubjectsTaught] = useState("");
  const [email, setEmail] = useState("");
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState(null);

  useEffect(() => {
    school.fetchMyProfile(userId).then((p) => {
      setFullName(p?.full_name || ""); setSubjectsTaught(p?.subjects_taught || ""); setEmail(p?.email || "");
      setLoading(false);
    });
  }, [userId]);

  const save = async () => {
    await school.updateMyProfile(userId, { fullName, subjectsTaught });
    toast("Profile saved");
    onClose();
  };

  const changePw = async () => {
    setPwError(null);
    if (!curPw) return setPwError("Type your current password");
    if (newPw.length < 8) return setPwError("Use at least 8 characters for the new password");
    if (newPw !== newPw2) return setPwError("The two new passwords don't match");
    setPwBusy(true);
    try {
      await db.changePassword(email, curPw, newPw);
      setCurPw(""); setNewPw(""); setNewPw2("");
      toast("Password changed");
    } catch (err) { setPwError(err.message || "Couldn't change the password"); }
    finally { setPwBusy(false); }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2 className="sheet-title">My profile</h2>
          <button type="button" className="btn btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        {loading ? <div className="card-sub">Loading...</div> : (
          <>
            <div className="field-label" style={{ marginTop: 0 }}>Name</div>
            <input className="input" placeholder="Your name" value={fullName} onChange={(e) => setFullName(e.target.value)} autoFocus />
            <div className="field-label">Email</div>
            <div className="input" style={{ color: "#9c9488" }}>{email}</div>
            <div className="field-label">Subjects you teach</div>
            <input className="input" placeholder="e.g. Maths, Science" value={subjectsTaught} onChange={(e) => setSubjectsTaught(e.target.value)} />
            <div className="card-sub" style={{ marginTop: 6 }}>Visible to your school's admin - helps them know what to assign you before you've set up classes.</div>
            <div className="sheet-actions">
              <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={save}>Save</button>
            </div>

            <div className="card" style={{ marginTop: 18 }}>
              <div className="card-title">Change password</div>
              <div className="field-label" style={{ marginTop: 0 }}>Current password</div>
              <input className="input" type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} autoComplete="current-password" />
              <div className="field-label">New password</div>
              <input className="input" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="At least 8 characters" autoComplete="new-password" />
              <div className="field-label">Type the new one again</div>
              <input className="input" type="password" value={newPw2} onChange={(e) => setNewPw2(e.target.value)} autoComplete="new-password" />
              {pwError && <div className="auth-error">{pwError}</div>}
              <button type="button" className="btn btn-primary" style={{ marginTop: 12, width: "100%" }} disabled={pwBusy} onClick={changePw}>
                {pwBusy ? "Please wait..." : "Change password"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

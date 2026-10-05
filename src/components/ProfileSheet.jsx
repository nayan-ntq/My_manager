import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import * as school from "../lib/school";
import { toast } from "./Toast";

export default function ProfileSheet({ userId, onClose }) {
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [subjectsTaught, setSubjectsTaught] = useState("");
  const [email, setEmail] = useState("");

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
          </>
        )}
      </div>
    </div>
  );
}

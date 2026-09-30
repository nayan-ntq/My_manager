import React, { useState } from "react";
import { createSchoolAndJoin, redeemInvite } from "../lib/school";
import * as db from "../lib/db";

export default function SchoolSetup({ userId, onDone }) {
  const [mode, setMode] = useState("create"); // "create" | "join"
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(null); setLoading(true);
    try {
      const school = mode === "create" ? await createSchoolAndJoin(userId, name) : await redeemInvite(code);
      onDone(school);
    } catch (err) {
      setError(err.message || "Couldn't save your school");
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 6 }}>
          <img src="/icon-192.png" alt="" style={{ width: 64, height: 64 }} />
        </div>
        <div className="top-left" style={{ marginBottom: 14, justifyContent: "center" }}>
          <div>
            <div className="brand-title">Set up your school</div>
            <div className="brand-sub" style={{ textAlign: "center" }}>One-time step</div>
          </div>
        </div>
        <div className="segmented" style={{ marginBottom: 4 }}>
          <button type="button" className={`segmented-btn ${mode === "create" ? "active" : ""}`} onClick={() => { setMode("create"); setError(null); }}>New school</button>
          <button type="button" className={`segmented-btn ${mode === "join" ? "active" : ""}`} onClick={() => { setMode("join"); setError(null); }}>Join with a code</button>
        </div>
        <form onSubmit={submit}>
          {mode === "create" ? (
            <>
              <div className="card-sub" style={{ lineHeight: 1.5, marginTop: 10 }}>
                You'll be set up as this school's admin, so you can invite other teachers and build out its structure afterward.
              </div>
              <div className="field-label">School name</div>
              <input className="input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Gyanayan School" autoFocus />
            </>
          ) : (
            <>
              <div className="card-sub" style={{ lineHeight: 1.5, marginTop: 10 }}>
                Ask your school admin for an invite code.
              </div>
              <div className="field-label">Invite code</div>
              <input className="input mono" required value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. K7QX3M" autoFocus style={{ letterSpacing: "0.08em", textTransform: "uppercase" }} />
            </>
          )}
          {error && <div className="auth-error">{error}</div>}
          <button className="btn btn-primary" style={{ width: "100%", marginTop: 18 }} disabled={loading}>
            {loading ? "Please wait..." : "Continue"}
          </button>
        </form>
        <button type="button" className="auth-switch" onClick={db.signOut}>Sign out</button>
      </div>
    </div>
  );
}

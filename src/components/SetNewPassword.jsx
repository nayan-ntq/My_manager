import React, { useState } from "react";
import * as db from "../lib/db";

export default function SetNewPassword({ onDone }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (pw.length < 8) return setError("Use at least 8 characters");
    if (pw !== pw2) return setError("The two passwords don't match");
    setLoading(true);
    try { await db.setNewPassword(pw); setDone(true); }
    catch (err) { setError(err.message || "Couldn't update the password"); }
    finally { setLoading(false); }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 6 }}>
          <img src="/icon-192.png" alt="" style={{ width: 64, height: 64 }} />
        </div>
        <div className="top-left" style={{ marginBottom: 18, justifyContent: "center" }}>
          <div>
            <div className="brand-title">Set a new password</div>
            <div className="brand-sub" style={{ textAlign: "center" }}>Choose something you'll remember</div>
          </div>
        </div>
        {done ? (
          <>
            <div className="auth-notice">Password updated. You're signed in.</div>
            <button type="button" className="btn btn-primary" style={{ width: "100%", marginTop: 18 }} onClick={onDone}>Continue</button>
          </>
        ) : (
          <form onSubmit={submit}>
            <div className="field-label">New password</div>
            <input className="input" type="password" required minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="At least 8 characters" autoFocus />
            <div className="field-label">Type it again</div>
            <input className="input" type="password" required minLength={8} value={pw2} onChange={(e) => setPw2(e.target.value)} />
            {error && <div className="auth-error">{error}</div>}
            <button className="btn btn-primary" style={{ width: "100%", marginTop: 18 }} disabled={loading}>{loading ? "Please wait..." : "Update password"}</button>
          </form>
        )}
      </div>
    </div>
  );
}

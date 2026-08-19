import React, { useState } from "react";
import * as db from "../lib/db";

export default function Auth() {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(null); setNotice(null); setLoading(true);
    try {
      if (mode === "signup") {
        await db.signUp(email, password);
        setNotice("Account created. If email confirmation is on, check your inbox before signing in.");
        setMode("signin");
      } else {
        await db.signIn(email, password);
      }
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="top-left" style={{ marginBottom: 22 }}>
          <div className="logo-mark"><span className="logo-letter">M</span><span className="logo-bar" /></div>
          <div>
            <div className="brand-title">My Manager</div>
            <div className="brand-sub">Personal + teaching coach</div>
          </div>
        </div>
        <form onSubmit={submit}>
          <div className="field-label">Email</div>
          <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          <div className="field-label">Password</div>
          <input className="input" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" />
          {error && <div className="auth-error">{error}</div>}
          {notice && <div className="auth-notice">{notice}</div>}
          <button className="btn btn-primary" style={{ width: "100%", marginTop: 18 }} disabled={loading}>
            {loading ? "Please wait\u2026" : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>
        <button type="button" className="auth-switch" onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setError(null); setNotice(null); }}>
          {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
        </button>
      </div>
    </div>
  );
}

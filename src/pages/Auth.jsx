import React, { useState } from "react";
import * as db from "../lib/db";

export default function Auth() {
  const [mode, setMode] = useState("signin"); // signin | signup | reset
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const go = (m) => { setMode(m); setError(null); setNotice(null); };

  const submit = async (e) => {
    e.preventDefault();
    setError(null); setNotice(null); setLoading(true);
    try {
      if (mode === "reset") {
        await db.sendPasswordReset(email);
        setNotice("If that email has an account, a reset link is on its way. Check your inbox and spam folder.");
      } else if (mode === "signup") {
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
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 6 }}>
          <img src="/icon-192.png" alt="" style={{ width: 64, height: 64 }} />
        </div>
        <div className="top-left" style={{ marginBottom: 22, justifyContent: "center" }}>
          <div>
            <div className="brand-title">My Manager</div>
            <div className="brand-sub" style={{ textAlign: "center" }}>{mode === "reset" ? "Reset your password" : "Personal + teaching coach"}</div>
          </div>
        </div>
        <form onSubmit={submit}>
          <div className="field-label">Email</div>
          <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          {mode !== "reset" && (
            <>
              <div className="field-label">Password</div>
              <input className="input" type="password" required minLength={mode === "signup" ? 8 : undefined} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === "signup" ? "At least 8 characters" : "Your password"} />
            </>
          )}
          {error && <div className="auth-error">{error}</div>}
          {notice && <div className="auth-notice">{notice}</div>}
          <button className="btn btn-primary" style={{ width: "100%", marginTop: 18 }} disabled={loading}>
            {loading ? "Please wait..." : mode === "signup" ? "Create account" : mode === "reset" ? "Send reset link" : "Sign in"}
          </button>
        </form>
        {mode === "signin" && <button type="button" className="auth-switch" onClick={() => go("reset")}>Forgot password?</button>}
        {mode === "reset" ? (
          <button type="button" className="auth-switch" onClick={() => go("signin")}>Back to sign in</button>
        ) : (
          <button type="button" className="auth-switch" onClick={() => go(mode === "signup" ? "signin" : "signup")}>
            {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
          </button>
        )}
      </div>
    </div>
  );
}

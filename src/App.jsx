import React, { useEffect, useState, useCallback } from "react";
import { LogOut } from "lucide-react";
import BottomNav from "./components/BottomNav";
import Teach from "./pages/Teach";
import Insights from "./pages/Insights";
import Coach from "./pages/Coach";
import Auth from "./pages/Auth";
import SchoolSetup from "./components/SchoolSetup";
import Spinner from "./components/Spinner";
import { ToastHost } from "./components/Toast";
import * as db from "./lib/db";
import { fetchMySchool } from "./lib/school";

export default function App() {
  const [session, setSession] = useState(undefined);
  const [tab, setTab] = useState("teach");
  const [school, setSchool] = useState(null);
  const [classes, setClasses] = useState([]);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    db.getSession().then(setSession);
    const unsub = db.onAuthChange(setSession);
    return unsub;
  }, []);

  const reloadClasses = useCallback(async () => {
    if (!session?.user) return;
    setClasses(await db.fetchClasses(session.user.id));
  }, [session?.user?.id]);

  const bootstrapUser = useCallback(async (userId) => {
    setReady(false); setLoadError(null);
    try {
      const [mySchool, cls] = await Promise.all([fetchMySchool(userId), db.fetchClasses(userId)]);
      setSchool(mySchool); setClasses(cls);
      setReady(true);
    } catch (err) {
      setLoadError(err.message || "Couldn't load your account");
    }
  }, []);

  useEffect(() => {
    if (session?.user) bootstrapUser(session.user.id);
    else { setReady(false); setSchool(null); setClasses([]); }
  }, [session?.user?.id, bootstrapUser]);

  if (session === undefined) return <Spinner fullPage />;
  if (!session) return <Auth />;
  if (loadError) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <div className="auth-error" style={{ marginTop: 0 }}>{loadError}</div>
          <button className="btn btn-primary" style={{ width: "100%", marginTop: 14 }} onClick={() => bootstrapUser(session.user.id)}>Try again</button>
          <button type="button" className="auth-switch" onClick={db.signOut}>Sign out</button>
        </div>
      </div>
    );
  }
  if (!ready) return <Spinner fullPage label="Setting things up..." />;

  const userId = session.user.id;
  if (!school) return <SchoolSetup userId={userId} onDone={setSchool} />;

  return (
    <div className="app-shell">
      <ToastHost />
      <div className="top-bar">
        <div className="top-left">
          <div className="logo-mark"><img src="/icon-192.png" alt="" /></div>
          <div style={{ minWidth: 0 }}>
            <h1 className="brand-title">My Manager</h1>
            <div className="brand-sub" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{school.name}</div>
          </div>
        </div>
        <div className="stats-pill">
          <button className="pill pill-icon-only" onClick={db.signOut} title="Sign out"><LogOut size={13} /></button>
        </div>
      </div>

      <div key={tab} className="page-transition">
        {tab === "teach" && <Teach userId={userId} classes={classes} reloadClasses={reloadClasses} school={school} />}
        {tab === "insights" && <Insights userId={userId} classes={classes} />}
        {tab === "coach" && <Coach userId={userId} school={school} />}
      </div>

      <BottomNav active={tab} onChange={setTab} />
    </div>
  );
}

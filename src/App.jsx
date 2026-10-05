import React, { useEffect, useState, useCallback } from "react";
import { LogOut, UserCircle } from "lucide-react";
import BottomNav from "./components/BottomNav";
import Teach from "./pages/Teach";
import Insights from "./pages/Insights";
import Coach from "./pages/Coach";
import Auth from "./pages/Auth";
import SchoolSetup from "./components/SchoolSetup";
import ProfileSheet from "./components/ProfileSheet";
import Spinner from "./components/Spinner";
import { ToastHost } from "./components/Toast";
import * as db from "./lib/db";
import { fetchMySchool } from "./lib/school";

/** Reads {tab, sub} from the URL hash (#teach/syllabus -> {tab:"teach", sub:"syllabus"}). */
function parseHash() {
  const raw = window.location.hash.replace(/^#\/?/, "");
  const [tab, sub] = raw.split("/");
  return { tab: tab || "teach", sub: sub || null };
}

export default function App() {
  const [session, setSession] = useState(undefined);
  const initial = parseHash();
  const [tab, setTabState] = useState(initial.tab);
  const [teachSub, setTeachSub] = useState(initial.sub);
  const [school, setSchool] = useState(null);
  const [classes, setClasses] = useState([]);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    db.getSession().then(setSession);
    const unsub = db.onAuthChange(setSession);
    return unsub;
  }, []);

  // URL hash drives navigation so refresh lands back on the same screen and the
  // browser's back button steps up one breadcrumb level instead of leaving the app.
  const navigate = useCallback((newTab, newSub = null) => {
    const hash = `#${newTab}${newSub ? "/" + newSub : ""}`;
    if (`#${window.location.hash.replace(/^#/, "")}` !== hash) window.history.pushState(null, "", hash);
    setTabState(newTab); setTeachSub(newSub);
  }, []);

  useEffect(() => {
    if (!window.location.hash) window.history.replaceState(null, "", `#${tab}`);
    const onPopState = () => { const p = parseHash(); setTabState(p.tab); setTeachSub(p.sub); };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []); // eslint-disable-line

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
          <button className="pill pill-icon-only" onClick={() => setShowProfile(true)} title="My profile"><UserCircle size={13} /></button>
          <button className="pill pill-icon-only" onClick={db.signOut} title="Sign out"><LogOut size={13} /></button>
        </div>
      </div>

      <div key={tab} className="page-transition">
        {tab === "teach" && <Teach userId={userId} classes={classes} reloadClasses={reloadClasses} school={school} sub={teachSub} onSubChange={(s) => navigate("teach", s)} />}
        {tab === "insights" && <Insights userId={userId} classes={classes} school={school} />}
        {tab === "coach" && <Coach userId={userId} school={school} />}
      </div>

      <BottomNav active={tab} onChange={(t) => navigate(t, null)} />
      {showProfile && <ProfileSheet userId={userId} onClose={() => setShowProfile(false)} />}
    </div>
  );
}

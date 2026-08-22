import React, { useEffect, useState, useCallback } from "react";
import { Flame, Sparkles } from "lucide-react";
import BottomNav from "./components/BottomNav";
import Today from "./pages/Today";
import Teach from "./pages/Teach";
import Insights from "./pages/Insights";
import Coach from "./pages/Coach";
import Auth from "./pages/Auth";
import Spinner from "./components/Spinner";
import { ToastHost } from "./components/Toast";
import * as db from "./lib/db";

export default function App() {
  const [session, setSession] = useState(undefined);
  const [tab, setTab] = useState("today");
  const [stats, setStats] = useState({ points: 0, streak: 0, longest_streak: 0, last_active_day: null });
  const [classes, setClasses] = useState([]);
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState(new Date());

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
    setReady(false);
    await db.ensureSeeded(userId);
    const [meta, cls] = await Promise.all([db.fetchMeta(userId), db.fetchClasses(userId)]);
    setStats(meta); setClasses(cls);
    setReady(true);
  }, []);

  useEffect(() => { if (session?.user) bootstrapUser(session.user.id); }, [session?.user?.id, bootstrapUser]);

  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 20000);
    return () => clearInterval(iv);
  }, []);

  const handleStatsChange = (patch) => {
    const next = { ...stats, ...patch };
    setStats(next);
    if (session?.user) db.saveMeta(session.user.id, patch);
  };

  if (session === undefined) return <Spinner fullPage />;
  if (!session) return <Auth />;
  if (!ready) return <Spinner fullPage label="Setting things up..." />;

  const userId = session.user.id;

  return (
    <div className="app-shell">
      <ToastHost />
      <div className="top-bar">
        <div className="top-left">
          <div className="logo-mark"><span className="logo-letter">M</span><span className="logo-bar" /></div>
          <div>
            <h1 className="brand-title">My Manager</h1>
            <div className="brand-sub">{now.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}</div>
          </div>
        </div>
        <div className="stats-pill">
          <div className="pill"><Flame size={13} color="#F2790C" /> {stats.streak}</div>
          <div className="pill"><Sparkles size={13} color="#F2790C" /> {stats.points}</div>
          <button className="pill" onClick={db.signOut}>Sign out</button>
        </div>
      </div>

      {tab === "today" && <Today userId={userId} stats={stats} onStatsChange={handleStatsChange} now={now} />}
      {tab === "teach" && <Teach userId={userId} classes={classes} reloadClasses={reloadClasses} />}
      {tab === "insights" && <Insights userId={userId} stats={stats} classes={classes} />}
      {tab === "coach" && <Coach userId={userId} stats={stats} classes={classes} />}

      <BottomNav active={tab} onChange={setTab} />
    </div>
  );
}

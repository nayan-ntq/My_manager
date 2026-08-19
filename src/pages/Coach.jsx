import React, { useState, useRef, useEffect } from "react";
import { Send, Sparkles } from "lucide-react";
import * as db from "../lib/db";

function addDays(d, n) { const c = new Date(d); c.setDate(c.getDate() + n); return c; }
function toKey(d) { return d.toISOString().slice(0, 10); }

const SUGGESTIONS = ["How's my week looking?", "Where should I focus next?", "How is a class doing overall?", "One small change to try tomorrow"];

export default function Coach({ userId, stats, classes }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, loading]);

  const buildContext = async () => {
    const today = toKey(new Date());
    const from = toKey(addDays(new Date(), -13));
    const [todayTasks, rangeRows] = await Promise.all([
      db.fetchTasksForDate(userId, today),
      db.fetchTasksInRange(userId, from, today),
    ]);
    return {
      stats,
      todayTasks: todayTasks.map((t) => ({ title: t.title, category: t.category, status: t.status, important: t.important })),
      last14Days: rangeRows,
      classes: classes.map((c) => ({ name: c.name, subject: c.subject, studentCount: c.students.length })),
    };
  };

  const send = async (text) => {
    const userText = text ?? input;
    if (!userText.trim() || loading) return;
    setInput("");
    const next = [...messages, { role: "user", content: userText }];
    setMessages(next);
    setLoading(true);
    try {
      const context = messages.length === 0 ? await buildContext() : undefined;
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, context }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `Request failed (${res.status})`);
      }
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: "error", content: `Couldn't reach the coach: ${err.message}` }]);
    } finally { setLoading(false); }
  };

  return (
    <div className="page" style={{ display: "flex", flexDirection: "column", minHeight: "calc(100vh - 140px)" }}>
      <h2 className="page-title">Coach</h2>
      <div className="chat-scroll" style={{ flex: 1 }}>
        {messages.length === 0 && (
          <div className="card">
            <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 6 }}><Sparkles size={14} /> Ask about your patterns</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {SUGGESTIONS.map((s) => <button key={s} className="chip-btn" onClick={() => send(s)}>{s}</button>)}
            </div>
          </div>
        )}
        {messages.map((m, i) => <div key={i} className={`msg ${m.role}`}>{m.content}</div>)}
        {loading && <div className="msg assistant"><div className="typing-dots"><span /><span /><span /></div></div>}
        <div ref={scrollRef} />
      </div>
      <div className="chat-input-row">
        <input className="input" placeholder="Ask anything\u2026" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
        <button className="btn btn-primary" style={{ padding: "0 16px" }} onClick={() => send()} disabled={loading}><Send size={16} /></button>
      </div>
    </div>
  );
}

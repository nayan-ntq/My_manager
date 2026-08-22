import React, { useState, useRef, useEffect } from "react";
import { Send, Sparkles } from "lucide-react";
import * as db from "../lib/db";

const SUGGESTIONS = [
  "How's my week looking?",
  "Which class needs the most attention right now?",
  "Who's improving and who's falling behind?",
  "What concepts are students weakest on?",
];

export default function Coach({ userId, stats }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, loading]);

  const send = async (text) => {
    const userText = text ?? input;
    if (!userText.trim() || loading) return;
    setInput("");
    const next = [...messages, { role: "user", content: userText }];
    setMessages(next);
    setLoading(true);
    try {
      // Full app snapshot only needs to be pulled and sent once per conversation  - 
      // the model keeps it in context for the rest of the thread.
      const context = messages.length === 0 ? await db.fetchFullAppData(userId) : undefined;
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
        <input className="input" placeholder="Ask anything..." value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
        <button className="btn btn-primary" style={{ padding: "0 16px" }} onClick={() => send()} disabled={loading}><Send size={16} /></button>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { Check, AlertCircle } from "lucide-react";

let listeners = [];
export function toast(message, type = "success") {
  const id = Math.random().toString(36).slice(2);
  listeners.forEach((l) => l({ id, message, type }));
}

export function ToastHost() {
  const [toasts, setToasts] = useState([]);
  useEffect(() => {
    const handler = (t) => {
      setToasts((prev) => [...prev, t]);
      setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), 2200);
    };
    listeners.push(handler);
    return () => { listeners = listeners.filter((l) => l !== handler); };
  }, []);
  if (toasts.length === 0) return null;
  return (
    <div className="toast-host">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          {t.type === "error" ? <AlertCircle size={14} /> : <Check size={14} />}
          {t.message}
        </div>
      ))}
    </div>
  );
}

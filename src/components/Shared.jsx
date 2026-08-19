import React from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";

function toKey(d) { return d.toISOString().slice(0, 10); }
function addDays(d, n) { const c = new Date(d); c.setDate(c.getDate() + n); return c; }

export function DateStrip({ selectedDate, onChange }) {
  const selected = new Date(selectedDate + "T00:00:00");
  const start = addDays(selected, -3);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const todayKey = toKey(new Date());
  return (
    <div className="date-strip">
      <button className="btn btn-icon" onClick={() => onChange(toKey(addDays(selected, -1)))}><ChevronLeft size={16} /></button>
      <div className="date-strip-days">
        {days.map((d) => {
          const key = toKey(d);
          return (
            <button key={key} className={`date-chip ${key === selectedDate ? "selected" : ""} ${key === todayKey ? "is-today" : ""}`} onClick={() => onChange(key)}>
              <span className="date-chip-dow">{d.toLocaleDateString([], { weekday: "short" })}</span>
              <span className="date-chip-num">{d.getDate()}</span>
            </button>
          );
        })}
      </div>
      <button className="btn btn-icon" onClick={() => onChange(toKey(addDays(selected, 1)))}><ChevronRight size={16} /></button>
      <label className="btn btn-icon" style={{ position: "relative" }}>
        <CalendarDays size={16} />
        <input type="date" value={selectedDate} onChange={(e) => e.target.value && onChange(e.target.value)}
          style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }} />
      </label>
    </div>
  );
}

export function Segmented({ options, value, onChange }) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button key={o.value} className={`segmented-btn ${value === o.value ? "active" : ""}`} onClick={() => onChange(o.value)}>
          {o.icon && <o.icon size={13} />} {o.label}
        </button>
      ))}
    </div>
  );
}

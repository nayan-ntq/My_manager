import React from "react";
import { Home, School, BarChart3, Sparkles } from "lucide-react";

const TABS = [
  { key: "today", label: "Today", icon: Home },
  { key: "teach", label: "Teach", icon: School },
  { key: "insights", label: "Insights", icon: BarChart3 },
  { key: "coach", label: "Coach", icon: Sparkles },
];

export default function BottomNav({ active, onChange }) {
  return (
    <nav className="bottom-nav">
      <div className="bottom-nav-inner">
        {TABS.map((t) => (
          <button key={t.key} className={`nav-btn ${active === t.key ? "active" : ""}`} onClick={() => onChange(t.key)}>
            <t.icon size={19} strokeWidth={active === t.key ? 2.4 : 2} />{t.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

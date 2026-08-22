import React from "react";
import { Check, X, Minus } from "lucide-react";

const ICONS = { check: Check, x: X, minus: Minus };

/** Renders a correction/understanding/concept mark as an icon (safe everywhere) or short text. */
export default function GridMark({ mark, size = 13 }) {
  if (!mark) return null;
  if (mark.icon) {
    const Icon = ICONS[mark.icon];
    return <Icon size={size} />;
  }
  return <span>{mark.text}</span>;
}

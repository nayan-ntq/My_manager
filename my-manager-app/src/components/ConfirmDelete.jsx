import React, { useState, useRef, useEffect } from "react";
import { Trash2, Check } from "lucide-react";

export default function ConfirmDelete({ onConfirm, size = 13 }) {
  const [confirming, setConfirming] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const handleClick = (e) => {
    e.stopPropagation();
    if (confirming) {
      clearTimeout(timer.current);
      setConfirming(false);
      onConfirm();
    } else {
      setConfirming(true);
      timer.current = setTimeout(() => setConfirming(false), 2500);
    }
  };

  return (
    <button type="button" className={`btn btn-icon confirm-delete ${confirming ? "confirming" : ""}`} onClick={handleClick} title={confirming ? "Tap again to confirm" : "Delete"}>
      {confirming ? <Check size={size} /> : <Trash2 size={size} />}
    </button>
  );
}

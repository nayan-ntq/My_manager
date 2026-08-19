import React, { useRef, useState } from "react";
import { X, Camera } from "lucide-react";
import { compressImage } from "../lib/images";

export default function PhotoStrip({ photos, onAdd, onRemove, max = 4 }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []).slice(0, Math.max(0, max - photos.length));
    e.target.value = "";
    if (!files.length) return;
    setBusy(true);
    for (const f of files) {
      try { const dataUrl = await compressImage(f); onAdd(dataUrl); } catch (err) {}
    }
    setBusy(false);
  };

  return (
    <div className="photo-strip">
      {photos.map((p, i) => (
        <div className="photo-thumb" key={i}>
          <img src={p} alt="" />
          <button type="button" onClick={() => onRemove(i)}><X size={11} /></button>
        </div>
      ))}
      {photos.length < max && (
        <button type="button" className="photo-add" onClick={() => inputRef.current?.click()} disabled={busy}>
          <Camera size={16} />
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleFiles} />
    </div>
  );
}

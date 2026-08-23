import React, { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { visionImport } from "../lib/visionImport";
import { toast } from "./Toast";

export default function PhotoImportButton({ kind, context, onResult, label = "Import from photo" }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const result = await visionImport(file, kind, context);
      onResult(result);
    } catch (err) {
      toast(err.message || "Couldn't read that photo", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className="chip-btn photo-import-btn" onClick={() => inputRef.current?.click()} disabled={busy}>
        {busy ? <Loader2 size={13} className="spin-icon" /> : <Camera size={13} />} {busy ? "Reading photo..." : label}
      </button>
      <input ref={inputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handleFile} />
    </>
  );
}

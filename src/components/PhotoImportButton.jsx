import React, { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { visionImport } from "../lib/visionImport";
import { toast } from "./Toast";

export default function PhotoImportButton({ kind, context, onResult, label = "Import from photo", multiple = true }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    setBusy(true);
    try {
      const result = await visionImport(files, kind, context);
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
        {busy ? <Loader2 size={13} className="spin-icon" /> : <Camera size={13} />} {busy ? "Reading photo(s)..." : label}
      </button>
      <input ref={inputRef} type="file" accept="image/*" multiple={multiple} style={{ display: "none" }} onChange={handleFiles} />
    </>
  );
}

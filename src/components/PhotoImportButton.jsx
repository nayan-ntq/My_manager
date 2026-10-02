import React, { useRef, useState } from "react";
import { Camera, Image, Loader2 } from "lucide-react";
import { visionImport } from "../lib/visionImport";
import { toast } from "./Toast";

/** Takes a photo directly (capture="environment") or picks from the library - either way,
 *  routes through the same Gemini extraction. Two explicit buttons instead of relying on
 *  the device's default file-picker choice, since that choice isn't consistent everywhere. */
export default function PhotoImportButton({ kind, context, onResult, label = "Import from photo", multiple = true }) {
  const cameraRef = useRef(null);
  const libraryRef = useRef(null);
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
      <button type="button" className="chip-btn photo-import-btn" onClick={() => cameraRef.current?.click()} disabled={busy} title="Take a photo">
        {busy ? <Loader2 size={13} className="spin-icon" /> : <Camera size={13} />} {busy ? "Reading photo(s)..." : "Camera"}
      </button>
      <button type="button" className="chip-btn photo-import-btn" onClick={() => libraryRef.current?.click()} disabled={busy} title="Choose from library">
        {busy ? <Loader2 size={13} className="spin-icon" /> : <Image size={13} />} {busy ? "Reading photo(s)..." : label}
      </button>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" multiple={multiple} style={{ display: "none" }} onChange={handleFiles} />
      <input ref={libraryRef} type="file" accept="image/*" multiple={multiple} style={{ display: "none" }} onChange={handleFiles} />
    </>
  );
}

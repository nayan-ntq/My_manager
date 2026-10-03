import { compressForOCR } from "./images";

/**
 * Compresses one or more photos and sends them to /api/vision-import for
 * Gemini to extract structured data. Returns { data } for JSON kinds
 * (planner, workout) or { csv } for list kinds (roster, correction,
 * performance, timetable).
 */
export async function visionImport(files, kind, context) {
  const fileArray = Array.isArray(files) ? files : [files];
  const images = await Promise.all(fileArray.map((f) => compressForOCR(f)));
  const res = await fetch("/api/vision-import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ images, mimeType: "image/jpeg", kind, context }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Import failed (${res.status})`);
  return body;
}

/** Minimal CSV parser \u2014 handles quoted fields with commas, good enough for Gemini's own CSV output. */
export function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  const parseLine = (line) => {
    const out = []; let cur = ""; let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === "," && !inQuotes) { out.push(cur.trim()); cur = ""; continue; }
      cur += ch;
    }
    out.push(cur.trim());
    return out;
  };
  const headers = parseLine(lines[0]).map((h) => h.toLowerCase());
  const rows = lines.slice(1).map((line) => {
    const cells = parseLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ""]));
  });
  return { headers, rows };
}

/** Fuzzy-matches an OCR'd name against a known roster (case-insensitive, tolerant of extra whitespace). */
export function matchStudentName(name, students) {
  const norm = (s) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const target = norm(name);
  let match = students.find((s) => norm(s.name) === target);
  if (match) return match;
  match = students.find((s) => norm(s.name).includes(target) || target.includes(norm(s.name)));
  return match || null;
}

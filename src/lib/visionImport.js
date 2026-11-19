import { compressForOCR } from "./images";

/**
 * Compresses one or more photos and sends them to /api/vision-import for
 * Gemini to extract structured data. Returns { data } for JSON kinds
 * (planner, workout) or { csv } for list kinds (roster, correction,
 * performance, timetable).
 */
async function importOne(image, kind, context) {
  const res = await fetch("/api/vision-import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ images: [image], mimeType: "image/jpeg", kind, context }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Import failed (${res.status})`);
  return body;
}

export async function visionImport(files, kind, context) {
  const fileArray = Array.isArray(files) ? files : [files];
  const images = await Promise.all(fileArray.map((f) => compressForOCR(f)));

  // one photo per request, two at a time: each request is small and stays well under the time limit
  const results = [];
  for (let i = 0; i < images.length; i += 2) {
    const batch = images.slice(i, i + 2);
    const settled = await Promise.allSettled(batch.map((img) => importOne(img, kind, context)));
    settled.forEach((s, j) => {
      if (s.status === "rejected") throw new Error(`Photo ${i + j + 1}: ${s.reason?.message || "failed"}`);
      results.push(s.value);
    });
  }

  if (results.length === 1) return results[0];
  if (results[0].csv !== undefined) {
    const [first, ...rest] = results.map((r) => r.csv);
    return { csv: [first, ...rest.map((c) => c.split(/\r?\n/).slice(1).join("\n"))].filter(Boolean).join("\n") };
  }
  if (kind === "workout") return { data: { exercises: results.flatMap((r) => r.data?.exercises || []) } };
  return { data: { entries: results.flatMap((r) => r.data?.entries || (r.data ? [r.data] : [])) } };
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

/** Fuzzy-matches an OCR'd section/class label (e.g. "6 A", "Grade 6-B") against the teacher's
 *  actual classes - strips spaces/punctuation so "6A" matches "6 - A" etc. Returns the class or null. */
export function matchClassName(label, classes) {
  if (!label) return null;
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const target = norm(label);
  if (!target) return null;
  let match = classes.find((c) => norm(c.name) === target);
  if (match) return match;
  match = classes.find((c) => norm(c.name).includes(target) || target.includes(norm(c.name)));
  return match || null;
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

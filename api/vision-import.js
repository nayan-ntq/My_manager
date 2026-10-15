// Vercel serverless function (Node.js runtime).
// Uses Gemini's vision capability to turn a photo (or several photos, e.g. a
// multi-page weekly planner) of a physical record into structured data the
// app can import. JSON-shaped kinds (planner, workout) come back as JSON for
// direct pre-fill/review; list-shaped kinds (roster, correction, performance,
// timetable) come back as CSV text so the teacher can review/edit before
// anything is written to the database.

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

const PROMPTS = {
  planner: (ctx) => `Read these photo(s) of one or more lesson planner pages - they may list lessons by
LECTURE NUMBER (e.g. "Lec 12", "L-12", "Period 12", a plain running number per class) rather than by date,
covering a single lecture or a whole run of them, AND they may cover MORE THAN ONE class/section on the
same page or across the photos (e.g. a teacher plans 6A, 6B and 6C in the same notebook, as separate rows,
columns, or clearly labeled blocks). Extract EVERY distinct lesson as its own entry - one entry per
(lecture, class/section) combination, never merging two different sections' plans into one entry even if
they're for the same lecture number and chapter. Return JSON with this exact shape:
{"entries": [{"lecture_number": integer|null, "date": "YYYY-MM-DD"|null, "class_label": string|null,
"chapter_number": string|null, "chapter": string|null, "objectives": string|null, "methodology": string|null,
"resources": string|null, "assignment": string|null,
"classwork_items": [{"exercise": string|null, "text": string, "medium": "notebook"|"textbook"|"worksheet"|"folder"|null, "important": boolean}],
"homework_items": [{"exercise": string|null, "text": string, "medium": "notebook"|"textbook"|"worksheet"|"folder"|null, "important": boolean}]}]}.
"lecture_number" is the lecture/period number as written on the page for that entry - prefer this over a
date whenever the page gives one; use null only if the page gives no lecture numbering at all.
"class_label" is the exact section/class name as written on the page for that entry (e.g. "6A", "7B",
"Grade 6 - B") - use null only if the page genuinely shows just one undivided class/section throughout.
${ctx?.allClassNames?.length ? `This teacher's known classes are: ${JSON.stringify(ctx.allClassNames)} - if a row's label clearly matches one of these (even abbreviated or reordered), use that exact known name as class_label.` : ""}
classwork_items/homework_items follow a Chapter -> Exercise -> Question structure: "exercise" is the
exercise or worksheet name a question belongs to (e.g. "Ex 3.1", "W/S-2", "Ex 8.3") - use null only if
the page genuinely gives no exercise/worksheet grouping for that item. "text" is just that one question
within it (e.g. "Q1-4", "B9", "whole" for the entire exercise assigned as one unit) - never fold the
exercise name into "text". "medium" is which physical medium that item is done in, if the page notes one
(shorthand like "NB"/"nb" means notebook, "TB" means textbook, "WS" or "W/S" means worksheet, "folder" or
"fd" means folder) - map any such shorthand to exactly one of the four canonical values shown, or null if
the page doesn't indicate a medium for that item. Split out of the Methodology text for classwork_items,
the Assignment text for homework_items. Set "important" true only if the page itself marks/underlines/stars
that item as important - otherwise false, never guess. Only fill "date" if the page genuinely shows a real
date or day name instead of (or alongside) a lecture number - if it's a day name (Monday, Tuesday...),
compute the real date using today = ${ctx?.today || "unknown"} (a ${ctx?.todayDow || ""}) and resolve it to
the nearest upcoming or matching occurrence of that weekday. Use null for any field you can't read
confidently - never invent content. If the photo(s) show only a single lesson for a single class, return an
"entries" array with just one item. Return ONLY the JSON object, no other text.
${ctx?.classHint ? `Context: if class_label can't be determined for an entry, assume it's for "${ctx.classHint}".` : ""}`,

  roster: () => `Read this photo of a student roster/list. Extract every student as CSV with header
"name,roll_no" - one row per student, roll_no blank if not shown. Preserve names exactly as written
(fix obvious OCR errors only, don't guess new names). Return ONLY the CSV text, no other commentary, no
markdown code fences.`,

  correction: (ctx) => `Read this photo of a correction/completion register (ticks, "ab" for absent, "ic"
for incomplete, or similar marks per student). Extract as CSV with header "student_name,status" where
status is one of: done, ab, ic, ns (not submitted), blank. Match each row to the closest name in this
known class roster if possible: ${JSON.stringify(ctx?.students || [])}. Return ONLY the CSV text, no
commentary, no markdown code fences.`,

  performance: (ctx) => `Read this photo of a test marks/performance sheet. Extract as CSV with header
"student_name,marks" (marks as a plain number, blank if absent or illegible - never guess a number).
Match each row to the closest name in this known class roster if possible: ${JSON.stringify(ctx?.students || [])}.
Return ONLY the CSV text, no commentary, no markdown code fences.`,

  workout: () => `Read this photo or description of a workout plan. Extract as JSON with this exact shape:
{"exercises": [{"name": string, "sets": [{"reps": number|null, "weight": number|null}]}]}. If specific
numbers aren't visible, use null rather than guessing. Return ONLY the JSON object, no other text.`,

  syllabus: () => `Read this photo of a syllabus or table-of-contents page listing chapters/units for a
grade. Extract every chapter as CSV with header "chapter_number,chapter_name" - one row per chapter, in
the order they appear on the page. Preserve names exactly as written (fix obvious OCR errors only, don't
invent chapters). Return ONLY the CSV text, no commentary, no markdown code fences.`,

  holidays: (ctx) => `Read these photo(s) of a yearly school calendar (or an academic-calendar page) with
holidays marked - by highlighting, circling, a legend/color-code, or a separate holidays list. Extract
every marked holiday as CSV with header "date,label" - one row per date, date in YYYY-MM-DD format. If a
holiday spans a range of consecutive days (e.g. a week-long break), list EVERY individual date in that
range as its own row, all with the same label. The calendar may not show the year explicitly on each
page/month - use ${ctx?.calendarYearHint || "the year(s) shown on the page, or infer from context"} to
resolve full dates. "label" is the holiday's name as written (e.g. "Diwali", "Summer break") - use an
empty label only if genuinely no name is given. Don't invent holidays that aren't actually marked. Return
ONLY the CSV text, no commentary, no markdown code fences.`,

  timetable: () => `Read this photo of a weekly class timetable. Extract as CSV with header
"day_of_week,start_time,end_time,class_name,label" where day_of_week is 0-6 (0=Sunday) and times are in
24-hour HH:MM format. One row per period. Return ONLY the CSV text, no commentary, no markdown code fences.`,
};

const JSON_KINDS = new Set(["planner", "workout"]);
const MAX_IMAGES = 8;

function stripCodeFence(text) {
  return text.replace(/^```[a-z]*\n?/i, "").replace(/```$/, "").trim();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Vision import needs GEMINI_API_KEY set in your Vercel project settings." });
    return;
  }

  const { image, images, mimeType, kind, context } = req.body || {};
  const imageList = (images && images.length ? images : image ? [image] : []).slice(0, MAX_IMAGES);
  if (!imageList.length || !PROMPTS[kind]) {
    res.status(400).json({ error: `images (1-${MAX_IMAGES}) and a valid kind (${Object.keys(PROMPTS).join(", ")}) are required` });
    return;
  }

  const enrichedContext = kind === "planner"
    ? { ...context, today: new Date().toISOString().slice(0, 10), todayDow: new Date().toLocaleDateString([], { weekday: "long" }) }
    : context;
  const prompt = PROMPTS[kind](enrichedContext);
  const isJson = JSON_KINDS.has(kind);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
    const imageParts = imageList.map((img) => ({
      inline_data: { mime_type: mimeType || "image/jpeg", data: img.includes(",") ? img.split(",")[1] : img },
    }));
    const body = {
      contents: [{ role: "user", parts: [...imageParts, { text: prompt }] }],
    };
    if (isJson) body.generationConfig = { responseMimeType: "application/json" };

    const upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(body),
    });
    const data = await upstream.json();
    if (!upstream.ok) throw new Error(data?.error?.message || `Gemini API error (${upstream.status})`);

    const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text).join("\n").trim();
    if (!text) throw new Error("Gemini returned an empty response (it may have blocked an image)");

    if (isJson) {
      let parsed;
      try { parsed = JSON.parse(stripCodeFence(text)); }
      catch (e) { throw new Error("Gemini's response wasn't valid JSON - try a clearer photo"); }
      res.status(200).json({ data: parsed });
    } else {
      res.status(200).json({ csv: stripCodeFence(text) });
    }
  } catch (err) {
    res.status(500).json({ error: err.message || "Unexpected server error" });
  }
}

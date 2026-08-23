// Vercel serverless function (Node.js runtime).
// Uses Gemini's vision capability to turn a photo of a physical record (lesson
// planner page, class roster, correction register, marks sheet, workout plan,
// or timetable) into structured data the app can import. JSON-shaped kinds
// (planner, workout) come back as JSON for direct form pre-fill; list-shaped
// kinds (roster, correction, performance, timetable) come back as CSV text so
// the teacher can review/edit before anything is written to the database.

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

const PROMPTS = {
  planner: (ctx) => `Read this photo of a lesson planner page. Extract the lesson plan as JSON with this
exact shape: {"chapter_number": string|null, "chapter": string|null, "objectives": string|null,
"methodology": string|null, "resources": string|null, "assignment": string|null, "reflection": string|null,
"concepts": string[], "exercise_list": string[]}. Concepts and exercise_list should be short items split
out from the methodology/assignment text (e.g. individual topic names, "Ex 3.1"). Use null for any field
you can't read confidently \u2014 never invent content. Return ONLY the JSON object, no other text.
${ctx?.classHint ? `Context: this is for class "${ctx.classHint}".` : ""}`,

  roster: () => `Read this photo of a student roster/list. Extract every student as CSV with header
"name,roll_no" \u2014 one row per student, roll_no blank if not shown. Preserve names exactly as written
(fix obvious OCR errors only, don't guess new names). Return ONLY the CSV text, no other commentary, no
markdown code fences.`,

  correction: (ctx) => `Read this photo of a correction/completion register (ticks, "ab" for absent, "ic"
for incomplete, or similar marks per student). Extract as CSV with header "student_name,status" where
status is one of: done, ab, ic, ns (not submitted), blank. Match each row to the closest name in this
known class roster if possible: ${JSON.stringify(ctx?.students || [])}. Return ONLY the CSV text, no
commentary, no markdown code fences.`,

  performance: (ctx) => `Read this photo of a test marks/performance sheet. Extract as CSV with header
"student_name,marks" (marks as a plain number, blank if absent or illegible \u2014 never guess a number).
Match each row to the closest name in this known class roster if possible: ${JSON.stringify(ctx?.students || [])}.
Return ONLY the CSV text, no commentary, no markdown code fences.`,

  workout: () => `Read this photo or description of a workout plan. Extract as JSON with this exact shape:
{"exercises": [{"name": string, "sets": [{"reps": number|null, "weight": number|null}]}]}. If specific
numbers aren't visible, use null rather than guessing. Return ONLY the JSON object, no other text.`,

  timetable: () => `Read this photo of a weekly class timetable. Extract as CSV with header
"day_of_week,start_time,end_time,class_name,label" where day_of_week is 0-6 (0=Sunday) and times are in
24-hour HH:MM format. One row per period. Return ONLY the CSV text, no commentary, no markdown code fences.`,
};

const JSON_KINDS = new Set(["planner", "workout"]);

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

  const { image, mimeType, kind, context } = req.body || {};
  if (!image || !PROMPTS[kind]) {
    res.status(400).json({ error: `image and a valid kind (${Object.keys(PROMPTS).join(", ")}) are required` });
    return;
  }

  const base64 = image.includes(",") ? image.split(",")[1] : image;
  const prompt = PROMPTS[kind](context);
  const isJson = JSON_KINDS.has(kind);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
    const body = {
      contents: [{
        role: "user",
        parts: [
          { inline_data: { mime_type: mimeType || "image/jpeg", data: base64 } },
          { text: prompt },
        ],
      }],
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
    if (!text) throw new Error("Gemini returned an empty response (it may have blocked the image)");

    if (isJson) {
      let parsed;
      try { parsed = JSON.parse(stripCodeFence(text)); }
      catch (e) { throw new Error("Gemini's response wasn't valid JSON \u2014 try a clearer photo"); }
      res.status(200).json({ data: parsed });
    } else {
      res.status(200).json({ csv: stripCodeFence(text) });
    }
  } catch (err) {
    res.status(500).json({ error: err.message || "Unexpected server error" });
  }
}

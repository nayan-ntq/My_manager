// Vercel serverless function (Node.js runtime).
// Keeps API keys server-side — never expose them in client code.
//
// Supports two providers so you can run on a free tier while testing:
//   - Anthropic (ANTHROPIC_API_KEY)  — ~$5 free trial credit on signup
//   - Gemini    (GEMINI_API_KEY)     — ongoing free tier, no card required
//
// Set AI_PROVIDER to "anthropic" or "gemini" to pick which one goes first.
// If both keys are set, the other one is used automatically as a fallback
// if the preferred provider errors out (e.g. free-tier rate limit hit).

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

const SYSTEM_PROMPT = `You are the Coach inside My Manager, an app that combines the user's personal
tasks/health/growth planner with a full teaching assistant (classes, lesson planner, attendance,
correction records, and test performance). You are given a full data snapshot: personal stats and
today's tasks, plus for every class - roster, planner entries with chapters/concepts taught,
attendance rate, correction-record completion (including incomplete/not-submitted counts), and test
performance with mean/median/mode/standard deviation, pass counts against each test's passing marks,
and per-concept understanding breakdowns where available. Ground every answer in that data - cite
specific numbers, student names, class names, or concepts when relevant, and say so plainly if the
data is too thin to support a claim. When asked about trends (who's improving, who's falling behind),
compare a student's or class's most recent results against their earlier ones in the data rather than
guessing. Keep replies under ~150 words unless asked for more depth. Be encouraging but honest; do not
flatter or manufacture positivity the data doesn't support. Plain sentences, minimal formatting, no
markdown headers.`;

async function callAnthropic(apiKey, normalizedMessages) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: normalizedMessages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Anthropic API error (${res.status})`);
  const reply = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  if (!reply) throw new Error("Anthropic returned an empty reply");
  return reply;
}

async function callGemini(apiKey, normalizedMessages) {
  const contents = normalizedMessages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Gemini API error (${res.status})`);
  const reply = (data.candidates?.[0]?.content?.parts || [])
    .map((p) => p.text)
    .join("\n")
    .trim();
  if (!reply) throw new Error("Gemini returned an empty reply (it may have blocked the response)");
  return reply;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { messages, context } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages array is required" });
    return;
  }

  // Only the first turn needs the full data context; later turns rely on
  // conversation history the model already has.
  const normalizedMessages = messages.map((m, i) => {
    const role = m.role === "assistant" ? "assistant" : "user";
    if (i === 0 && context) {
      return { role, content: `Context data (JSON, do not repeat verbatim to the user):\n${JSON.stringify(context)}\n\nUser: ${m.content}` };
    }
    return { role, content: m.content };
  });

  const preferred = (process.env.AI_PROVIDER || "anthropic").toLowerCase();
  const order = preferred === "gemini" ? ["gemini", "anthropic"] : ["anthropic", "gemini"];
  const available = order.filter(
    (p) => (p === "anthropic" && process.env.ANTHROPIC_API_KEY) || (p === "gemini" && process.env.GEMINI_API_KEY)
  );

  if (available.length === 0) {
    res.status(500).json({
      error: "No AI provider configured. Set ANTHROPIC_API_KEY and/or GEMINI_API_KEY in your Vercel project settings.",
    });
    return;
  }

  let lastError = null;
  for (const provider of available) {
    try {
      const reply =
        provider === "anthropic"
          ? await callAnthropic(process.env.ANTHROPIC_API_KEY, normalizedMessages)
          : await callGemini(process.env.GEMINI_API_KEY, normalizedMessages);
      res.status(200).json({ reply, provider });
      return;
    } catch (err) {
      lastError = err;
      // try the next available provider (if any) as a fallback
    }
  }

  res.status(502).json({ error: `All providers failed. Last error: ${lastError?.message || "unknown error"}` });
}

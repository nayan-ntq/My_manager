// Vercel serverless function. Lets a school admin set a temporary password for someone in
// their own school. Needs SUPABASE_SERVICE_ROLE_KEY in the Vercel project settings.
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://iupvyckoztcslgalbfyq.supabase.co";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return res.status(500).json({ error: "Setting passwords needs SUPABASE_SERVICE_ROLE_KEY in your Vercel project settings." });

  const token = (req.headers.authorization || "").replace(/^Bearer /i, "");
  const { userId, password } = req.body || {};
  if (!token || !userId || typeof password !== "string" || password.length < 8) {
    return res.status(400).json({ error: "A person and a password of at least 8 characters are required" });
  }

  const admin = createClient(SUPABASE_URL, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: caller, error: callerErr } = await admin.auth.getUser(token);
  if (callerErr || !caller?.user) return res.status(401).json({ error: "Not signed in" });

  // the caller must be an admin of a school that the target person belongs to
  const { data: adminRows } = await admin.from("school_members").select("school_id")
    .eq("user_id", caller.user.id).in("role", ["school_admin", "super_admin"]);
  const schoolIds = (adminRows || []).map((r) => r.school_id);
  if (schoolIds.length === 0) return res.status(403).json({ error: "Only a school admin can do this" });

  const { data: target } = await admin.from("school_members").select("id")
    .eq("user_id", userId).in("school_id", schoolIds).limit(1);
  if (!target?.length) return res.status(403).json({ error: "That person is not in your school" });

  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) return res.status(400).json({ error: error.message });
  return res.status(200).json({ ok: true });
}

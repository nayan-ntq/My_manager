import { supabase } from "./supabaseClient";

export async function isAppOwner(userId) {
  const { data, error } = await supabase.from("app_owners").select("user_id").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return !!data;
}

/** Every school on the platform - only returns real rows for an app owner (RLS-gated). */
export async function fetchAllSchools() {
  const { data, error } = await supabase.from("schools").select("*").order("name");
  if (error) throw error;
  return data || [];
}

export async function updateSchoolModules(schoolId, modules) {
  const { error } = await supabase.from("schools").update({ enabled_modules: modules }).eq("id", schoolId);
  if (error) throw error;
}

export async function fetchAppOwners() {
  const { data, error } = await supabase.from("app_owners").select("user_id, added_at, profiles(email, full_name)").order("added_at");
  if (error) throw error;
  return data || [];
}

export async function addAppOwnerByEmail(email) {
  const { data: profile, error: findErr } = await supabase.from("profiles").select("id").eq("email", email.trim()).maybeSingle();
  if (findErr) throw findErr;
  if (!profile) throw new Error("No account found with that email - they need to sign up first");
  const { error } = await supabase.from("app_owners").insert({ user_id: profile.id });
  if (error) throw error;
}

export async function removeAppOwner(userId) {
  const { error } = await supabase.from("app_owners").delete().eq("user_id", userId);
  if (error) throw error;
}

/** How many members/classes each school has - for the owner's at-a-glance list. */
export async function fetchSchoolStats(schoolId) {
  const [members, classes] = await Promise.all([
    supabase.from("school_members").select("id", { count: "exact", head: true }).eq("school_id", schoolId),
    supabase.from("classes").select("id", { count: "exact", head: true }).eq("school_id", schoolId),
  ]);
  return { memberCount: members.count || 0, classCount: classes.count || 0 };
}

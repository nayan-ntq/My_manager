import { supabase } from "./supabaseClient";

/**
 * Teacher mode is scoped to a school. A user's school comes from their row in
 * school_members (role: teacher | coordinator | school_admin | super_admin).
 * The teacher who creates a school becomes its school_admin, so they can
 * immediately build the hierarchy and invite others.
 */

/** The school this user belongs to, or null if they haven't set one up yet. */
export async function fetchMySchool(userId) {
  const { data, error } = await supabase
    .from("school_members")
    .select("role, division_id, schools(id, name, correction_types, test_types)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data?.schools) return null;
  return {
    id: data.schools.id, name: data.schools.name, role: data.role, divisionId: data.division_id,
    correctionTypes: data.schools.correction_types || [], testTypes: data.schools.test_types || [],
  };
}

/** Updates the school's uniform preset lists (correction type / exam type) - any member can edit these. */
export async function updateSchoolTypeLists(schoolId, patch) {
  const dbPatch = {};
  if (patch.correctionTypes) dbPatch.correction_types = patch.correctionTypes;
  if (patch.testTypes) dbPatch.test_types = patch.testTypes;
  const { error } = await supabase.from("schools").update(dbPatch).eq("id", schoolId);
  if (error) throw error;
}

/**
 * First-time setup: creates the school, makes the founder its school_admin, and
 * attaches any classes they already had (from before school scoping existed).
 * New classes pick up the school automatically via a database trigger.
 */
export async function createSchoolAndJoin(userId, name) {
  const clean = (name || "").trim();
  if (!clean) throw new Error("Enter your school's name");

  const { data: school, error } = await supabase
    .from("schools").insert({ name: clean, created_by: userId }).select().single();
  if (error) throw error;

  const { error: memberErr } = await supabase
    .from("school_members").insert({ school_id: school.id, user_id: userId, role: "school_admin" });
  if (memberErr) throw memberErr;

  const { error: classErr } = await supabase
    .from("classes").update({ school_id: school.id }).eq("user_id", userId).is("school_id", null);
  if (classErr) throw classErr;

  return {
    id: school.id, name: school.name, role: "school_admin", divisionId: null,
    correctionTypes: school.correction_types || [], testTypes: school.test_types || [],
  };
}

/** Joins an existing school with an invite code from its admin. */
export async function redeemInvite(code) {
  const clean = (code || "").trim();
  if (!clean) throw new Error("Enter your invite code");
  const { data, error } = await supabase.rpc("redeem_school_invite", { invite_code: clean });
  if (error) throw new Error(error.message || "That code didn't work");
  const row = data?.[0];
  if (!row) throw new Error("That code didn't work");
  return { id: row.school_id, name: row.school_name, role: row.role, divisionId: null };
}

/* ---------- hierarchy (divisions) ---------- */

export async function fetchDivisions(schoolId) {
  const { data, error } = await supabase.from("divisions").select("*").eq("school_id", schoolId).order("position");
  if (error) throw error;
  return data || [];
}
export async function createDivision(schoolId, parentId, name, position) {
  const { data, error } = await supabase.from("divisions")
    .insert({ school_id: schoolId, parent_id: parentId || null, name, position }).select().single();
  if (error) throw error;
  return data;
}
export async function renameDivision(id, name) {
  const { error } = await supabase.from("divisions").update({ name }).eq("id", id);
  if (error) throw error;
}
export async function deleteDivision(id) {
  const { error } = await supabase.from("divisions").delete().eq("id", id);
  if (error) throw error;
}
export async function setClassDivision(classId, divisionId) {
  const { error } = await supabase.from("classes").update({ division_id: divisionId || null }).eq("id", classId);
  if (error) throw error;
}

/* ---------- school roster + invites (school_admin only) ---------- */

export async function fetchSchoolMembers(schoolId) {
  const { data, error } = await supabase.from("school_members")
    .select("*, profiles(email, full_name, subjects_taught)").eq("school_id", schoolId).order("created_at");
  if (error) throw error;
  return data || [];
}
export async function updateMemberRole(memberId, role, divisionId) {
  const { error } = await supabase.from("school_members").update({ role, division_id: divisionId || null }).eq("id", memberId);
  if (error) throw error;
}
/** Sets a person's display name - an admin can do this for anyone in their school, or a person for themself. */
export async function updateProfileName(userId, fullName) {
  const { error } = await supabase.from("profiles").update({ full_name: fullName.trim() || null }).eq("id", userId);
  if (error) throw error;
}
export async function fetchMyProfile(userId) {
  const { data, error } = await supabase.from("profiles").select("full_name, subjects_taught, email").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data;
}
/** Self-service profile update - name and the subjects a teacher declares they teach
 *  (shown to the admin in People, so they know what to assign before classes exist yet). */
export async function updateMyProfile(userId, patch) {
  const dbPatch = {};
  if ("fullName" in patch) dbPatch.full_name = patch.fullName.trim() || null;
  if ("subjectsTaught" in patch) dbPatch.subjects_taught = patch.subjectsTaught.trim() || null;
  const { error } = await supabase.from("profiles").update(dbPatch).eq("id", userId);
  if (error) throw error;
}
export async function removeMember(memberId) {
  const { error } = await supabase.from("school_members").delete().eq("id", memberId);
  if (error) throw error;
}

function generateInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I - easier to read aloud
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}
export async function createInvite(schoolId, createdBy, role, divisionId, maxUses = 1) {
  const { data, error } = await supabase.from("school_invites")
    .insert({ school_id: schoolId, code: generateInviteCode(), role, division_id: divisionId || null, created_by: createdBy, max_uses: maxUses })
    .select().single();
  if (error) throw error;
  return data;
}
export async function fetchInvites(schoolId) {
  const { data, error } = await supabase.from("school_invites").select("*, divisions(name)")
    .eq("school_id", schoolId).order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}
export async function deleteInvite(id) {
  const { error } = await supabase.from("school_invites").delete().eq("id", id);
  if (error) throw error;
}

/* ---------- planner sign-off (coordinators + school_admin) ---------- */

/** Planner entries awaiting review, scoped to whatever this reviewer can see via RLS. */
export async function fetchPendingSignoffs(schoolId) {
  const { data, error } = await supabase.from("planner_entries")
    .select("*, classes(name, division_id)")
    .eq("signoff_status", "pending")
    .order("date", { ascending: false });
  if (error) throw error;
  return (data || []).filter((r) => r.classes); // RLS already scoped this to the reviewer's school/division
}
export async function submitForSignoff(id) {
  const { error } = await supabase.from("planner_entries").update({ signoff_status: "pending" }).eq("id", id);
  if (error) throw error;
}
export async function reviewSignoff(id, approve, note, reviewerId) {
  const { error } = await supabase.from("planner_entries").update({
    signoff_status: approve ? "approved" : "rejected", signoff_by: reviewerId,
    signoff_at: new Date().toISOString(), signoff_note: note || null,
  }).eq("id", id);
  if (error) throw error;
}


/* ---------- school structure: grades, sections, subjects ---------- */

export async function fetchStructure(schoolId) {
  const [g, s, sub, ss] = await Promise.all([
    supabase.from("grades").select("*").eq("school_id", schoolId),
    supabase.from("sections").select("*").eq("school_id", schoolId),
    supabase.from("subjects").select("*").eq("school_id", schoolId),
    supabase.from("section_subjects").select("*").eq("school_id", schoolId),
  ]);
  for (const r of [g, s, sub, ss]) if (r.error) throw r.error;
  return { grades: g.data || [], sections: s.data || [], subjects: sub.data || [], sectionSubjects: ss.data || [] };
}
export async function addGrade(schoolId, name) {
  const { error } = await supabase.from("grades").insert({ school_id: schoolId, name });
  if (error) throw error;
}
export async function deleteGrade(id) {
  const { error } = await supabase.from("grades").delete().eq("id", id);
  if (error) throw error;
}
export async function addSubject(schoolId, name) {
  const { error } = await supabase.from("subjects").insert({ school_id: schoolId, name });
  if (error) throw error;
}
export async function deleteSubject(id) {
  const { error } = await supabase.from("subjects").delete().eq("id", id);
  if (error) throw error;
}
/** Adds a section; if copyFromSectionId is given, the new section gets the same subjects. */
export async function addSection(schoolId, gradeId, name, copyFromSectionId) {
  const { data: sec, error } = await supabase.from("sections").insert({ school_id: schoolId, grade_id: gradeId, name }).select().single();
  if (error) throw error;
  if (copyFromSectionId) {
    const { data: rows, error: e2 } = await supabase.from("section_subjects").select("subject_id").eq("section_id", copyFromSectionId);
    if (e2) throw e2;
    if (rows?.length) {
      const { error: e3 } = await supabase.from("section_subjects").insert(rows.map((r) => ({ school_id: schoolId, section_id: sec.id, subject_id: r.subject_id })));
      if (e3) throw e3;
    }
  }
  return sec;
}
export async function deleteSection(id) {
  const { error } = await supabase.from("sections").delete().eq("id", id);
  if (error) throw error;
}
/** Turns one subject on or off for a list of sections at once. */
export async function setSubjectForSections(schoolId, sectionIds, subjectId, on) {
  if (!sectionIds.length) return;
  if (on) {
    const { error } = await supabase.from("section_subjects").upsert(
      sectionIds.map((id) => ({ school_id: schoolId, section_id: id, subject_id: subjectId })),
      { onConflict: "section_id,subject_id", ignoreDuplicates: true }
    );
    if (error) throw error;
  } else {
    const { error } = await supabase.from("section_subjects").delete().in("section_id", sectionIds).eq("subject_id", subjectId);
    if (error) throw error;
  }
}


/** Assign (or change) the teacher for one section + subject. Coordinator and above only. */
export async function assignTeacher(sectionId, subjectId, teacherId) {
  const { error } = await supabase.rpc("assign_class_teacher", { p_section_id: sectionId, p_subject_id: subjectId, p_teacher_id: teacherId });
  if (error) throw new Error(error.message);
}
